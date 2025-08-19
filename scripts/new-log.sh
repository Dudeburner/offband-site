#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   tools/new-log.sh "Short title" --date YYYY-MM-DD --time HH:MM --body "One-line plain update"
# Defaults: --date = today (local), --time = current, --body = "Updated"

TITLE="${1:-}"
if [[ -z "$TITLE" ]]; then
  echo "Error: title is required" >&2
  echo "Usage: tools/new-log.sh \"Short title\" [--date YYYY-MM-DD] [--time HH:MM] [--body \"message\"]" >&2
  exit 1
fi
shift || true

DATE="$(date +%F)"
TIME="$(date +%H:%M)"
BODY="Updated"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date) DATE="$2"; shift 2 ;;
    --time) TIME="$2"; shift 2 ;;
    --body) BODY="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Slug from title: lowercase, spaces->-, strip non-alnum/dash
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
FNAME="${DATE}-${SLUG}.html"
DST="security/logs/${FNAME}"

TEMPLATE="security/logs/_template.html"
[[ -f "$TEMPLATE" ]] || { echo "Template not found at $TEMPLATE" >&2; exit 1; }

# Render from template
TMP="$(mktemp)"
sed \
  -e "s|{{DATE}}|${DATE}|g" \
  -e "s|{{TITLE}}|${TITLE}|g" \
  -e "s|{{DATETIME}}|${DATE} ${TIME}|g" \
  -e "s|{{BODY}}|${BODY}|g" \
  "$TEMPLATE" > "$TMP"

mv "$TMP" "$DST"
echo "Created $DST"

# Update index listing: insert at top between markers
INDEX="security/logs/index.html"
if [[ -f "$INDEX" ]]; then
  LI="<li><a href=\"/${DST}\">${DATE} — ${TITLE}</a></li>"
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