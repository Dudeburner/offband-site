#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   tools/offband-email.sh set contact@offband.dev about.html [span_id=e]
#
# Writes a base64-obfuscated mailto block between <!--EMAIL_START--> and <!--EMAIL_END-->

cmd="${1:-}"; shift || true
case "$cmd" in
  set)
    addr="${1:-}"; file="${2:-}"; span_id="${3:-e}"
    [[ -z "${addr:-}" || -z "${file:-}" ]] && { echo "usage: $0 set EMAIL FILE [SPAN_ID]"; exit 1; }

    # split email into user, domain, tld (handles foo@bar.baz; for multi-label TLDs tweak below)
    user="${addr%@*}"
    domfull="${addr#*@}"
    tld="${domfull##*.}"
    domain="${domfull%.*}"

    # base64 encode parts (portable on macOS and Linux)
    b64() { printf "%s" "$1" | base64 | tr -d '\n'; }

    u_enc="$(b64 "$user")"
    d_enc="$(b64 "$domain")"
    t_enc="$(b64 "$tld")"

    js_block=$(cat <<'JS'
<p>Email: <span id="__SPAN_ID__"><!-- filled at runtime --></span></p>
<script>(function(){
  const parts = ["__U__","__D__","__T__"];
  const addr = atob(parts[0]) + "@" + atob(parts[1]) + "." + atob(parts[2]);
  const el = document.getElementById("__SPAN_ID__");
  el.innerHTML = '<a href="mailto:' + addr + '">' + addr + '</a>';
})();</script>
JS
)

    # substitute placeholders
    js_block="${js_block//__U__/$u_enc}"
    js_block="${js_block//__D__/$d_enc}"
    js_block="${js_block//__T__/$t_enc}"
    js_block="${js_block//__SPAN_ID__/$span_id}"

    # ensure markers exist
    if ! grep -q "<!--EMAIL_START-->" "$file"; then
      echo "ERROR: Marker <!--EMAIL_START--> not found in $file"
      echo "Add <!--EMAIL_START--> and <!--EMAIL_END--> around the contact section once, then rerun."
      exit 2
    fi
    if ! grep -q "<!--EMAIL_END-->" "$file"; then
      echo "ERROR: Marker <!--EMAIL_END--> not found in $file"
      exit 2
    fi

    # replace between markers (portable awk)
    tmp="${file}.tmp.$$"
    awk -v repl="$js_block" '
      BEGIN{inblk=0}
      /<!--EMAIL_START-->/ {print; print repl; inblk=1; next}
      /<!--EMAIL_END-->/ {inblk=0; print; next}
      { if(!inblk) print }
    ' "$file" > "$tmp" && mv "$tmp" "$file"

    echo "Updated obfuscated email in $file → $addr"
    ;;

  *)
    echo "usage: $0 set EMAIL FILE [SPAN_ID]"
    exit 1
    ;;
esac
