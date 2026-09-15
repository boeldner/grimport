#!/bin/sh
# Grimport egress guard.
#
# Runs as a tiny sidecar with host networking and NET_ADMIN (see
# docker-compose.yml, service `egress-guard`). Every site container lives in a
# /24 carved from SITE_NET_POOL (default 10.99.0.0/16). Static sites use
# `internal` networks and cannot talk to anything but Traefik; app sites
# (php/node/python) need the internet but must not reach:
#   - private ranges (other containers, the panel, your LAN, the host)
#   - link-local / cloud metadata (169.254.0.0/16)
# and must not open connections at scanning speed.
#
# Rules live in the DOCKER-USER chain, which Docker evaluates before its own
# rules and leaves alone across daemon restarts. The script is idempotent:
# it re-applies every INTERVAL seconds and only touches its own chain.
#
# Not applicable on Docker Desktop (macOS/Windows): the daemon runs in a VM
# whose iptables the sidecar cannot reach. The guard then logs and idles.

set -eu

POOL="${SITE_NET_POOL:-10.99.0.0/16}"
INTERVAL="${EGRESS_GUARD_INTERVAL:-60}"
RATE="${EGRESS_NEW_CONN_PER_SEC:-50}"
CHAIN="GRIMPORT-EGRESS"

log() { echo "[egress-guard] $*"; }

apply() {
  # Own chain so re-applying never duplicates rules.
  iptables -w -N "$CHAIN" 2>/dev/null || iptables -w -F "$CHAIN"

  # Replies to connections Traefik (or anything else) opened are fine.
  iptables -w -A "$CHAIN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN

  # Site-to-site inside the pool: never.
  iptables -w -A "$CHAIN" -s "$POOL" -d "$POOL" -j DROP

  # Private ranges, link-local and metadata: never.
  for dst in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10 127.0.0.0/8; do
    iptables -w -A "$CHAIN" -s "$POOL" -d "$dst" -j DROP
  done

  # Scanning / spam speed: cap new outbound connections per source IP.
  if iptables -w -A "$CHAIN" -s "$POOL" -m conntrack --ctstate NEW \
       -m hashlimit --hashlimit-above "${RATE}/sec" --hashlimit-burst 100 \
       --hashlimit-mode srcip --hashlimit-name grimport-egress -j DROP 2>/dev/null; then :; else
    log "hashlimit not available, skipping new-connection rate limit"
  fi

  iptables -w -A "$CHAIN" -j RETURN

  # Hook the chain into DOCKER-USER exactly once, at the top.
  iptables -w -N DOCKER-USER 2>/dev/null || true
  if ! iptables -w -C DOCKER-USER -j "$CHAIN" 2>/dev/null; then
    iptables -w -I DOCKER-USER 1 -j "$CHAIN"
  fi
}

if ! iptables -w -L DOCKER-USER -n >/dev/null 2>&1 && ! iptables -w -L FORWARD -n >/dev/null 2>&1; then
  log "iptables not usable here (Docker Desktop or missing NET_ADMIN). Idling."
  exec sleep infinity
fi

log "guarding pool $POOL (re-applying every ${INTERVAL}s, new-connection cap ${RATE}/s per site)"
while true; do
  if apply; then
    log "rules applied"
  else
    log "failed to apply rules, retrying in ${INTERVAL}s"
  fi
  sleep "$INTERVAL"
done
