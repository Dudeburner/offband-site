#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root so the script can run from any directory
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"

# Usage:
#   scripts/new-log.sh "Short title" --date YYYY-MM-DD --time HH:MM --body "One-line plain update"
# Defaults: --date = today (UTC), --time = current UTC, --body = "Updated"
# Notes: BODY can also be piped via STDIN if --body is omitted.

TITLE="${1:-}"
if [[ -z "$TITLE" ]]; then
  echo "Error: title is required" >&2
  echo "Usage: scripts/new-log.sh \"Short title\" [--date YYYY-MM-DD] [--time HH:MM] [--body \"message\"]" >&2
  exit 1
fi
shift || true

DATE="$(date -u +%F)"
TIME="$(date -u +%H:%M)"
BODY="Updated"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date) DATE="$2"; shift 2 ;;
    --time) TIME="$2"; shift 2 ;;
    --body) BODY="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# If BODY was not explicitly provided, allow piping content via STDIN
if [[ "$BODY" == "Updated" ]] && [ ! -t 0 ]; then
  BODY="$(cat)"
fi

# Slug from title: lowercase, spaces->-, strip non-alnum/dash
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
FNAME="${DATE}-${SLUG}.html"
DST="${REPO_ROOT}/security/logs/${FNAME}"

TEMPLATE="${REPO_ROOT}/security/logs/_template.html"
[[ -f "$TEMPLATE" ]] || { echo "Template not found at $TEMPLATE" >&2; exit 1; }

# Ensure destination directory exists
mkdir -p "$(dirname "$DST")"

# Basic HTML escape (then escape for sed replacement)
html_esc() {
  sed -e 's/&/&amp;/g' \
      -e 's/</\&lt;/g' \
      -e 's/>/\&gt;/g' \
      -e 's/"/\&quot;/g' \
      -e "s/'/&#39;/g"
}
esc_sed() { sed -e 's/[\\\/&|]/\\&/g'; }

E_DATE="$(printf '%s' "$DATE" | esc_sed)"
E_TITLE="$(printf '%s' "$TITLE" | html_esc | esc_sed)"
E_DATETIME="$(printf '%s' "${DATE} ${TIME}" | esc_sed)"
E_BODY="$(printf '%s' "$BODY" | html_esc | esc_sed)"

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
sed \
  -e "s|{{DATE}}|${E_DATE}|g" \
  -e "s|{{TITLE}}|${E_TITLE}|g" \
  -e "s|{{DATETIME}}|${E_DATETIME}|g" \
  -e "s|{{BODY}}|${E_BODY}|g" \
  "$TEMPLATE" > "$TMP"
mv "$TMP" "$DST"
trap - EXIT
echo "Created $DST"

# Update index listing: insert at top between markers (newest first)
INDEX="${REPO_ROOT}/security/logs/index.html"
if [[ -f "$INDEX" ]]; then
  WEB_HREF="/security/logs/${FNAME}"
  LI="<li><a href=\"${WEB_HREF}\">${DATE} — ${TITLE}</a></li>"
  if grep -q "<!-- LOGS:START -->" "$INDEX"; then
    awk -v li="$LI" '
      /<!-- LOGS:START -->/ {
        match($0, /^[ \t]*/);
        lead = substr($0, 1, RLENGTH);
        print;
        print lead li;
        next;
      }
      { print }
    ' "$INDEX" > "${INDEX}.tmp"
    mv "${INDEX}.tmp" "$INDEX"
    echo "Updated index: added ${FNAME}"
  else
    echo "LOGS:START marker not found in $INDEX; please add it manually." >&2
  fi
else
  echo "Index not found at $INDEX" >&2
fi

echo "Done."