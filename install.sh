#!/usr/bin/env bash
# Grimport — Installation Wizard
# Usage:
#   Install:   curl -fsSL https://raw.githubusercontent.com/YOUR/grimport/main/install.sh | bash
#   Update:    curl -fsSL https://raw.githubusercontent.com/YOUR/grimport/main/install.sh | bash -s -- --update
#   Uninstall: curl -fsSL https://raw.githubusercontent.com/YOUR/grimport/main/install.sh | bash -s -- --uninstall

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/boeldner/grimport.git"
DEFAULT_INSTALL_DIR="$HOME/grimport"
MIN_DOCKER_VERSION="20"

# ── Colors ─────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET="\033[0m";    C_BOLD="\033[1m";    C_DIM="\033[2m"
  C_INDIGO="\033[38;5;124m"  # deep blood red (primary)
  C_VIOLET="\033[38;5;160m"  # bright crimson (highlight)
  C_MAGENTA="\033[38;5;196m" # hot red (alert)
  C_CYAN="\033[38;5;208m"    # dark orange (prompt marker)
  C_GREEN="\033[38;5;114m"
  C_YELLOW="\033[38;5;221m"
  C_RED="\033[38;5;203m"
  C_WHITE="\033[38;5;230m"   # warm bone white
  C_GRAY="\033[38;5;238m"    # very dark warm gray
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_INDIGO=""; C_VIOLET=""; C_MAGENTA=""
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_WHITE=""; C_GRAY=""
fi

# ── Layout ─────────────────────────────────────────────────────────────────────
cols()    { tput cols 2>/dev/null || echo 80; }
rows()    { tput lines 2>/dev/null || echo 24; }

# Prefix every stdin line with N spaces
_pad_lines() {
  local n=$1 pfx=""
  (( n > 0 )) && printf -v pfx "%${n}s" ""
  while IFS= read -r line; do printf "%s%s\n" "$pfx" "$line"; done
}

# Center a block of given content_width characters
center_block() {
  local content_width=$1
  local w; w=$(cols)
  local pad=$(( (w - content_width) / 2 ))
  (( pad < 0 )) && pad=0
  _pad_lines "$pad"
}

# Center a single line of text (strip ANSI to measure)
center_line() {
  local text="$1"
  local raw; raw=$(printf "%s" "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local len=${#raw}
  local w; w=$(cols)
  local pad=$(( (w - len) / 2 ))
  (( pad < 0 )) && pad=0
  printf "%${pad}s%b\n" "" "$text"
}

# ── Print Helpers ──────────────────────────────────────────────────────────────
print()    { printf "%b\n" "$*"; }
info()     { center_line "  ${C_INDIGO}▸${C_RESET} $*"; }
ok()       { center_line "  ${C_GREEN}✓${C_RESET} $*"; }
warn()     { center_line "  ${C_YELLOW}⚠${C_RESET}  $*"; }
error()    { center_line "  ${C_RED}✗${C_RESET} $*" >&2; }
fatal()    { error "$*"; exit 1; }

# All ask* functions write to REPLY (never use inside $(...))
ask() {
  local prompt="$1" default="${2:-}"
  if [[ -n "$default" ]]; then
    printf "%b" "  ${C_CYAN}?${C_RESET} ${C_WHITE}${prompt}${C_RESET} ${C_GRAY}[${default}]${C_RESET} "
  else
    printf "%b" "  ${C_CYAN}?${C_RESET} ${C_WHITE}${prompt}${C_RESET} "
  fi
  IFS= read -r REPLY </dev/tty
  REPLY="${REPLY:-$default}"
}

ask_secret() {
  local prompt="$1"
  printf "%b" "  ${C_CYAN}?${C_RESET} ${C_WHITE}${prompt}${C_RESET} "
  IFS= read -rs REPLY </dev/tty; echo
}

ask_yn() {
  local prompt="$1" default="${2:-y}" hint="Y/n"
  [[ "$default" == "n" ]] && hint="y/N"
  printf "%b" "  ${C_CYAN}?${C_RESET} ${C_WHITE}${prompt}${C_RESET} ${C_GRAY}(${hint})${C_RESET} "
  IFS= read -r REPLY </dev/tty
  REPLY="${REPLY:-$default}"
  [[ "$REPLY" =~ ^[Yy] ]]
}

divider() {
  local w; w=$(cols); local inner=$(( w - 4 ))
  (( inner < 10 )) && inner=40
  printf "%b" "${C_DIM}${C_GRAY}"
  printf "  "
  printf '─%.0s' $(seq 1 "$inner")
  printf "%b\n" "${C_RESET}"
}

# Repeat a character N times (works with multi-byte Unicode)
_rep() {
  local char="$1" n="$2" s="" i
  for (( i=0; i<n; i++ )); do s+="$char"; done
  printf "%s" "$s"
}

# run_with_progress "Label" estimated_seconds command [args...]
# Shows animated progress bar + ETA while command runs in background.
run_with_progress() {
  local label="$1" estimate="$2"; shift 2
  local BAR_W=26

  local tmp; tmp=$(mktemp)
  "$@" >"$tmp" 2>&1 &
  local pid=$! t0; t0=$(date +%s)

  while kill -0 "$pid" 2>/dev/null; do
    local elapsed=$(( $(date +%s) - t0 ))
    local pct=$(( elapsed * 100 / estimate ))
    (( pct > 95 )) && pct=95
    local fill=$(( pct * BAR_W / 100 )) empty=$(( BAR_W - fill ))
    local eta_s
    (( elapsed < estimate )) && eta_s="~$(( estimate - elapsed ))s left" || eta_s="finishing…"

    printf "\r  %b▸%b %-22s %b[%b%s%b%s%b]%b %3d%%  %b%s%b  " \
      "$C_CYAN" "$C_RESET" "$label" \
      "$C_INDIGO" "$C_VIOLET" "$(_rep █ $fill)" "$C_DIM$C_GRAY" "$(_rep ░ $empty)" "$C_INDIGO" "$C_RESET" \
      "$pct" "$C_GRAY" "$eta_s" "$C_RESET"
    sleep 0.12
  done

  wait "$pid"; local rc=$?
  local elapsed=$(( $(date +%s) - t0 ))

  if (( rc == 0 )); then
    printf "\r  %b✓%b %-22s %b[%b%s%b]%b %b100%%%b  %bdone in %ds%b\n" \
      "$C_GREEN" "$C_RESET" "$label" \
      "$C_INDIGO" "$C_GREEN" "$(_rep █ $BAR_W)" "$C_INDIGO" "$C_RESET" \
      "$C_GREEN$C_BOLD" "$C_RESET" "$C_GRAY" "$elapsed" "$C_RESET"
  else
    printf "\r  %b✗%b %-22s %b[%b%s%b]%b %bFAILED%b\n" \
      "$C_RED" "$C_RESET" "$label" \
      "$C_INDIGO" "$C_RED" "$(_rep ▪ $BAR_W)" "$C_INDIGO" "$C_RESET" \
      "$C_RED$C_BOLD" "$C_RESET"
    [[ -s "$tmp" ]] && { printf "%b" "$C_DIM$C_GRAY"; sed 's/^/    /' "$tmp" | head -20; printf "%b\n" "$C_RESET"; }
    rm -f "$tmp"; return $rc
  fi
  rm -f "$tmp"
}

# ── Banner ─────────────────────────────────────────────────────────────────────
draw_banner() {
  clear
  local w; w=$(cols)

  # Rune strip — dark fantasy flavour
  local stars="  ᚷ   ·   ᚱ   ·   ᛁ   ·   ᛗ   ·   ᛈ   ·   ᛟ   ·   ᚱ   ·   ᛏ   ·   ᚷ"
  printf "%b%s%b\n\n" "${C_DIM}${C_INDIGO}" "${stars:0:$w}" "${C_RESET}"

  # GRIMPORT block letters — max line width 66 chars
  local logo=(
    "██████╗ ██████╗ ██╗███╗   ███╗██████╗  ██████╗ ██████╗ ████████╗"
    "██╔════╝ ██╔══██╗██║████╗ ████║██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝"
    "██║  ███╗██████╔╝██║██╔████╔██║██████╔╝██║   ██║██████╔╝   ██║   "
    "██║   ██║██╔══██╗██║██║╚██╔╝██║██╔═══╝ ██║   ██║██╔══██╗   ██║   "
    "╚██████╔╝██║  ██║██║██║ ╚═╝ ██║██║     ╚██████╔╝██║  ██║   ██║   "
    " ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   "
  )
  local LOGO_W=66

  # Dark wraith — 6 lines next to the logo
  local D="${C_VIOLET}${C_BOLD}" G="${C_INDIGO}${C_DIM}" X="${C_RESET}"
  local wiz=(
    "${G}   ·  ·  ·   ${X}"
    "${D}  ╔▓══▓══▓╗  ${X}"
    "${D}  ║ ▒  ▒  ║  ${X}"
    "${D}  ╚▄▄▄▄▄▄▄╝  ${X}"
    "${D}   ╲▓▓▓▓▓╱   ${X}"
    "${G}  ·  ╲·╱  ·  ${X}"
  )
  local WIZ_W=13
  local GAP=5
  local BLOCK_W=$(( LOGO_W + GAP + WIZ_W ))

  if (( w >= BLOCK_W + 4 )); then
    # ── Wide terminal: logo + wizard side-by-side ──
    local outer=$(( (w - BLOCK_W) / 2 ))
    (( outer < 0 )) && outer=0
    local pfx=""; (( outer > 0 )) && printf -v pfx "%${outer}s" ""
    local gap_str=""; printf -v gap_str "%${GAP}s" ""

    printf "%b" "${C_INDIGO}${C_BOLD}"
    for i in "${!logo[@]}"; do
      local line="${logo[$i]}"
      local len=${#line}
      local pad_needed=$(( LOGO_W - len ))
      local padded="$line"
      (( pad_needed > 0 )) && printf -v padded "%s%${pad_needed}s" "$line" ""
      printf "%s%s%s%b\n" "$pfx" "$padded" "$gap_str" "${wiz[$i]:-}${X}"
    done
    printf "%b" "${C_RESET}"
  else
    # ── Narrow terminal: logo only, centered ──
    printf "%b" "${C_INDIGO}${C_BOLD}"
    for line in "${logo[@]}"; do
      local pad=$(( (w - LOGO_W) / 2 ))
      (( pad < 0 )) && pad=0
      printf "%${pad}s%s\n" "" "$line"
    done
    printf "%b" "${C_RESET}"
  fi

  printf "\n"
  center_line "${C_GRAY}Self‑hosted static site publishing${C_RESET}"
  printf "\n\n"
}

draw_wizard() { :; }  # wizard now lives inside draw_banner

draw_success_portal() {
  printf "%b" "${C_INDIGO}"
  cat << 'SUCCESS' | center_block 36
     ᚷ  ·  ᚱ  ·  ᛁ  ·  ᛗ  ·  ᛈ  ·  ᛟ  ·  ᚱ
        ╔══════════════════════════╗
        ║  ▓                  ▓   ║
        ║    G R I M P O R T      ║
        ║  ▓    summoned.     ▓   ║
        ╚══════════════════════════╝
SUCCESS
  printf "%b\n" "${C_RESET}"
}

# ── Resize handler ─────────────────────────────────────────────────────────────
# Redraws the static banner if the terminal is resized (during non-interactive phases)
_BANNER_PHASE=false
_handle_winch() {
  if [[ "$_BANNER_PHASE" == "true" ]]; then
    draw_banner
    draw_wizard
  fi
}
trap '_handle_winch' WINCH

# ── Requirements ───────────────────────────────────────────────────────────────
check_requirements() {
  center_line "${C_BOLD}${C_WHITE}Checking requirements${C_RESET}"
  divider

  if ! command -v docker &>/dev/null; then
    error "Docker not found."
    print
    center_line "Install from: ${C_CYAN}https://docs.docker.com/get-docker/${C_RESET}"
    fatal "Please install Docker and re-run."
  fi
  local dver; dver=$(docker version --format '{{.Server.Version}}' 2>/dev/null | cut -d. -f1 || echo 0)
  (( dver < MIN_DOCKER_VERSION )) && fatal "Docker ≥ ${MIN_DOCKER_VERSION} required (found ${dver})."
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)"

  if docker compose version &>/dev/null 2>&1; then
    ok "Docker Compose $(docker compose version --short 2>/dev/null)"
    COMPOSE="docker compose"
  elif command -v docker-compose &>/dev/null; then
    ok "docker-compose (standalone)"
    COMPOSE="docker-compose"
  else
    error "Docker Compose not found."
    center_line "Install: ${C_CYAN}https://docs.docker.com/compose/install/${C_RESET}"
    fatal "Please install Docker Compose and re-run."
  fi

  if command -v git &>/dev/null; then
    ok "git $(git --version | awk '{print $3}')"
    USE_GIT=true
  else
    warn "git not found — required for clone. Please install git."
    USE_GIT=false
  fi

  print
}

# ── Configure ──────────────────────────────────────────────────────────────────
configure() {
  center_line "${C_BOLD}${C_WHITE}Configuration${C_RESET}"
  divider
  print

  if [[ "${DEV_MODE:-false}" == "true" ]]; then
    INSTALL_DIR="$DEFAULT_INSTALL_DIR"
    ok "Install directory: ${INSTALL_DIR}"
  else
    ask "Install directory?" "$DEFAULT_INSTALL_DIR"; INSTALL_DIR="${REPLY/#\~/$HOME}"
  fi
  print

  center_line "${C_GRAY}Dashboard domain (local: grimport.localhost — prod: panel.yourdomain.com)${C_RESET}"
  ask "Dashboard domain?" "grimport.localhost"; SUPERVISOR_DOMAIN="$REPLY"
  print

  center_line "${C_GRAY}Auto-subdomain base (e.g. sites.yourdomain.com) — leave blank to skip${C_RESET}"
  ask "Site base domain?" ""; SITE_BASE_DOMAIN="$REPLY"
  print

  local gen; gen=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#%^&*' </dev/urandom 2>/dev/null | head -c 32 \
                   || openssl rand -hex 16)
  center_line "${C_GRAY}Dashboard login password — leave blank to auto-generate${C_RESET}"
  ask_secret "Password:"; SUPERVISOR_SECRET="$REPLY"
  if [[ -z "$SUPERVISOR_SECRET" ]]; then
    SUPERVISOR_SECRET="$gen"
    ok "Auto-generated secure password"
  fi
  print

  center_line "${C_GRAY}Let's Encrypt email for HTTPS — leave blank for local HTTP-only dev${C_RESET}"
  ask "ACME / Let's Encrypt email?" ""; ACME_EMAIL="$REPLY"
  print

  ask "HTTP port?"  "80";  HTTP_PORT="$REPLY"
  ask "HTTPS port?" "443"; HTTPS_PORT="$REPLY"
  print
}

# ── .env writer ────────────────────────────────────────────────────────────────
write_env() {
  cat > "$INSTALL_DIR/.env" << ENV
# Generated by Grimport installer — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
SUPERVISOR_DOMAIN=${SUPERVISOR_DOMAIN}
SITE_BASE_DOMAIN=${SITE_BASE_DOMAIN}
SUPERVISOR_SECRET=${SUPERVISOR_SECRET}
ACME_EMAIL=${ACME_EMAIL}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
NODE_ENV=production
ENV
  ok ".env written"
}

# ── Install ────────────────────────────────────────────────────────────────────
do_install() {
  center_line "${C_BOLD}${C_WHITE}Installing Grimport${C_RESET}"
  divider

  if [[ "${DEV_MODE:-false}" == "true" ]]; then
    ok "Dev mode — using existing directory: ${INSTALL_DIR}"
  elif [[ -d "$INSTALL_DIR" ]] && [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
    warn "Found existing install at ${INSTALL_DIR}. Run with ${C_YELLOW}--update${C_RESET} to upgrade."
    exit 0
  elif [[ "${USE_GIT}" == "true" ]]; then
    run_with_progress "Cloning repository" 15 git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    ok "Cloned to ${INSTALL_DIR}"
  else
    fatal "git is required to clone the repository. Please install git."
  fi

  cd "$INSTALL_DIR"
  write_env

  mkdir -p data/sites data/certs traefik/dynamic
  ok "Data directories created"

  if [[ -n "$ACME_EMAIL" ]]; then
    cat > traefik/dynamic/tls.yml << TLS
certificatesResolvers:
  letsencrypt:
    acme:
      email: "${ACME_EMAIL}"
      storage: /certs/acme.json
      httpChallenge:
        entryPoint: web
TLS
    ok "Let's Encrypt configured for ${ACME_EMAIL}"
  fi

  run_with_progress "Pulling images" 45 sh -c "$COMPOSE pull --quiet" || true
  run_with_progress "Building & starting" 90 sh -c "$COMPOSE up -d --build"
  print
  ok "${C_BOLD}Stack is running${C_RESET}"
  print
}

# ── Update ─────────────────────────────────────────────────────────────────────
do_update() {
  center_line "${C_BOLD}${C_WHITE}Updating Grimport${C_RESET}"
  divider

  [[ ! -d "$INSTALL_DIR" ]] && fatal "No install found at ${INSTALL_DIR}."

  cd "$INSTALL_DIR"

  if [[ -d ".git" ]]; then
    run_with_progress "Pulling latest code" 15 git pull --ff-only
  else
    warn "Not a git repo — skipping code pull."
  fi

  COMPOSE="docker compose"
  command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1 && COMPOSE="docker-compose"

  run_with_progress "Pulling images" 45 sh -c "$COMPOSE pull --quiet" || true
  run_with_progress "Rebuilding stack" 90 sh -c "$COMPOSE up -d --build"

  print; ok "${C_BOLD}Grimport updated and running${C_RESET}"; print
}

# ── Uninstall ──────────────────────────────────────────────────────────────────
do_uninstall() {
  center_line "${C_BOLD}${C_WHITE}Uninstall Grimport${C_RESET}"
  divider; print

  if [[ ! -d "$INSTALL_DIR" ]]; then
    warn "No install found at ${INSTALL_DIR}."; exit 0
  fi

  warn "This will stop all Grimport containers."
  center_line "Install dir: ${C_WHITE}${INSTALL_DIR}${C_RESET}"; print

  ask_yn "Are you sure?" "n" || { print "  Cancelled."; exit 0; }

  cd "$INSTALL_DIR"

  COMPOSE="docker compose"
  command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1 && COMPOSE="docker-compose"

  run_with_progress "Stopping containers" 10 sh -c "$COMPOSE down --remove-orphans" || true
  ok "Containers stopped"

  ask_yn "Also delete all site data and certificates?" "n" \
    && { rm -rf "$INSTALL_DIR/data"; ok "Data deleted"; } \
    || ok "Data preserved at ${INSTALL_DIR}/data"

  # Safety: never delete if this script lives inside the target directory
  local script_dir; script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ "$script_dir" == "$INSTALL_DIR"* ]]; then
    warn "Skipping directory deletion — install.sh is inside ${INSTALL_DIR}"
    warn "Delete it manually if you're sure: ${C_WHITE}rm -rf ${INSTALL_DIR}${C_RESET}"
  else
    ask_yn "Delete the install directory (${INSTALL_DIR})?" "n" \
      && { rm -rf "$INSTALL_DIR"; ok "Directory removed"; }
  fi

  print; center_line "${C_BOLD}The portal is closed. Farewell.${C_RESET}"; print; exit 0
}

# ── Summary ────────────────────────────────────────────────────────────────────
show_summary() {
  draw_success_portal

  local url="http://${SUPERVISOR_DOMAIN}"
  [[ "$HTTP_PORT" != "80" ]] && url="http://${SUPERVISOR_DOMAIN}:${HTTP_PORT}"

  divider
  center_line "${C_BOLD}${C_WHITE}Your portal is ready${C_RESET}"
  divider
  print
  center_line "${C_GRAY}Dashboard URL${C_RESET}   ${C_CYAN}${C_BOLD}${url}${C_RESET}"
  center_line "${C_GRAY}Password     ${C_RESET}   ${C_YELLOW}${SUPERVISOR_SECRET}${C_RESET}"
  center_line "${C_GRAY}Location     ${C_RESET}   ${INSTALL_DIR}"
  print
  divider
  print
  center_line "${C_GRAY}Useful commands (run inside ${INSTALL_DIR}):${C_RESET}"
  center_line "${C_DIM}docker compose logs -f${C_RESET}   ${C_GRAY}← stream logs${C_RESET}"
  center_line "${C_DIM}docker compose down${C_RESET}      ${C_GRAY}← stop${C_RESET}"
  center_line "${C_DIM}docker compose up -d${C_RESET}     ${C_GRAY}← start${C_RESET}"
  print

  if [[ "$SUPERVISOR_DOMAIN" == *.localhost ]]; then
    center_line "${C_GRAY}Tip: .localhost domains resolve automatically — no /etc/hosts needed.${C_RESET}"
    print
  fi

  center_line "${C_DIM}${C_GRAY}Save your password — it's stored as a hash and cannot be recovered.${C_RESET}"
  print
  center_line "${C_DIM}${C_GRAY}Made with ✦ by Grimport${C_RESET}"
  print
}

# ── Mode picker (interactive menu shown after banner) ──────────────────────────
pick_mode() {
  local dir="$1"
  local installed=false version_hint=""

  if [[ -f "$dir/docker-compose.yml" ]]; then
    installed=true
    # Try to read a version from package.json if present
    if [[ -f "$dir/supervisor/package.json" ]]; then
      version_hint=$(grep '"version"' "$dir/supervisor/package.json" \
                      | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    fi
  fi

  print
  if [[ "$installed" == "true" ]]; then
    if [[ -n "$version_hint" ]]; then
      center_line "${C_GREEN}✓${C_RESET} ${C_GRAY}Grimport ${version_hint} detected at ${C_WHITE}${dir}${C_RESET}"
    else
      center_line "${C_GREEN}✓${C_RESET} ${C_GRAY}Existing install detected at ${C_WHITE}${dir}${C_RESET}"
    fi
  else
    center_line "${C_GRAY}No existing install found at ${C_WHITE}${dir}${C_RESET}"
  fi
  print

  # Print menu as a fixed-width block, centered once
  # Visible block width: 42 chars
  local BW=42
  local w; w=$(cols)
  local pad=$(( (w - BW) / 2 )); (( pad < 0 )) && pad=0
  local p=""; (( pad > 0 )) && printf -v p "%${pad}s" ""

  if [[ "$installed" == "true" ]]; then
    printf "%s%b\n" "$p" "  ${C_DIM}1)${C_RESET}  Install     ${C_DIM}(different location)${C_RESET}"
    printf "%s%b\n" "$p" "  ${C_INDIGO}${C_BOLD}2)  Update      ← recommended${C_RESET}"
    printf "%s%b\n" "$p" "  ${C_DIM}3)${C_RESET}  Uninstall"
    print
    ask "What would you like to do?" "2"
  else
    printf "%s%b\n" "$p" "  ${C_INDIGO}${C_BOLD}1)  Install     ← recommended${C_RESET}"
    printf "%s%b\n" "$p" "  ${C_DIM}2)${C_RESET}  Update       ${C_DIM}(requires existing install)${C_RESET}"
    printf "%s%b\n" "$p" "  ${C_DIM}3)${C_RESET}  Uninstall"
    print
    ask "What would you like to do?" "1"
  fi

  case "$REPLY" in
    1|i|I|install)   PICKED_MODE="install" ;;
    2|u|U|update)    PICKED_MODE="update" ;;
    3|x|X|uninstall) PICKED_MODE="uninstall" ;;
    *)
      [[ "$installed" == "true" ]] && PICKED_MODE="update" || PICKED_MODE="install"
      ;;
  esac
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  local mode="auto" dev=false
  for arg in "$@"; do
    case "$arg" in
      --install)   mode="install" ;;
      --update)    mode="update" ;;
      --uninstall) mode="uninstall" ;;
      --dev)       dev=true ;;
      --help|-h)   print "Usage: install.sh [--install|--update|--uninstall|--dev]"; exit 0 ;;
      *)           fatal "Unknown argument: $arg" ;;
    esac
  done
  # In dev mode: skip clone, use the directory where this script lives
  if [[ "$dev" == "true" ]]; then
    DEV_MODE=true
    DEFAULT_INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  fi

  draw_banner
  sleep 0.6

  # If no explicit mode from CLI flags, ask interactively
  if [[ "$mode" == "auto" ]]; then
    PICKED_MODE=""
    pick_mode "$DEFAULT_INSTALL_DIR"
    mode="$PICKED_MODE"
    print
    # After picking mode, ask for install dir (except install which asks in configure)
    if [[ "$mode" != "install" ]]; then
      ask "Grimport directory?" "$DEFAULT_INSTALL_DIR"; INSTALL_DIR="${REPLY/#\~/$HOME}"
      print
    fi
  fi

  case "$mode" in
    install)
      check_requirements
      configure
      do_install
      show_summary
      ;;
    update)
      if [[ -z "${INSTALL_DIR:-}" ]]; then ask "Grimport directory?" "$DEFAULT_INSTALL_DIR"; INSTALL_DIR="${REPLY/#\~/$HOME}"; print; fi
      do_update
      ;;
    uninstall)
      if [[ -z "${INSTALL_DIR:-}" ]]; then ask "Grimport directory?" "$DEFAULT_INSTALL_DIR"; INSTALL_DIR="${REPLY/#\~/$HOME}"; print; fi
      do_uninstall
      ;;
  esac
}

main "$@"
