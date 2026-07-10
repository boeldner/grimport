#!/usr/bin/env bash
# Requires a running supervisor at $BASE (default http://localhost:3000)
# and two cookies: $ADMIN_COOKIE and $VIEWER_COOKIE (wh.sid values).
set -u
BASE=${BASE:-http://localhost:3000}
fail=0
check() { # desc method path cookie expected
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$2" \
    -H "Cookie: wh.sid=$4" "$BASE$3")
  if [ "$code" != "$5" ]; then echo "FAIL: $1 (got $code want $5)"; fail=1
  else echo "ok: $1 ($code)"; fi
}
check "viewer cannot create token" POST /api/settings/tokens "$VIEWER_COOKIE" 403
check "admin can list tokens"      GET  /api/settings/tokens "$ADMIN_COOKIE" 200
check "viewer cannot list webhooks" GET /api/settings/webhooks "$VIEWER_COOKIE" 403
check "viewer cannot update"       POST /api/update/check     "$VIEWER_COOKIE" 403
exit $fail
