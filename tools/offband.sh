#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOG_INDEX="$ROOT/blog/index.html"
SITEMAP="$ROOT/sitemap.xml"

slugify() {
  # lower, spaces->-, strip bad chars
  printf "%s" "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-+|-+$//g'
}

add_to_sitemap() {
  local url="$1"
  if ! grep -q "<loc>$url</loc>" "$SITEMAP"; then
    # insert before closing </urlset>
    tmp="$SITEMAP.tmp"
    awk -v u="$url" '
      /<\/urlset>/ && !done { print "  <url><loc>" u "</loc></url>"; done=1 }
      { print }
    ' "$SITEMAP" > "$tmp" && mv "$tmp" "$SITEMAP"
    echo "sitemap: added $url"
  else
    echo "sitemap: $url already present"
  fi
}

add_post_to_blog_index() {
  local title="$1" slug="$2"
  if ! grep -q "/blog/posts/$slug.html" "$BLOG_INDEX"; then
    tmp="$BLOG_INDEX.tmp"
    awk -v line="  <li><a href=\"/blog/posts/$slug.html\">$title</a> <small>— $(date '+%Y-%m-%d')</small></li>" '
      /<ul>/ { print; printed=1; print line; next }
      { print }
    ' "$BLOG_INDEX" > "$tmp" && mv "$tmp" "$BLOG_INDEX"
    echo "blog index: added $slug"
  else
    echo "blog index: $slug already listed"
  fi
}

cmd="${1:-}"
shift || true

case "$cmd" in
  new:page)
    # usage: offband.sh new:page "Title" about.html "Short description"
    title="${1:-}"; path="${2:-}"; desc="${3:-Short page.}"
    [[ -z "$title" || -z "$path" ]] && { echo "usage: $0 new:page \"Title\" path.html [desc]"; exit 1; }
    out="$ROOT/$path"
    body="<p>Coming soon…</p>"
    mkdir -p "$(dirname "$out")"
    sed -e "s|{{TITLE}}|$title|g" \
        -e "s|{{PATH}}|$path|g" \
        -e "s|{{DESC}}|$desc|g" \
        -e "s|{{BODY}}|$body|g" \
        "$ROOT/templates/page.html" > "$out"
    echo "created page: $out"
    add_to_sitemap "https://offband.dev/$path"
    ;;

  new:post)
    # usage: offband.sh new:post "Title" "Short description"
    title="${1:-}"; desc="${2:-Post."}"
    [[ -z "$title" ]] && { echo "usage: $0 new:post \"Title\" [desc]"; exit 1; }
    slug="$(slugify "$title")"
    date="$(date '+%Y-%m-%d')"
    out="$ROOT/blog/posts/$slug.html"
    mkdir -p "$(dirname "$out")"
    body="<p>Draft…</p>"
    sed -e "s|{{TITLE}}|$title|g" \
        -e "s|{{SLUG}}|$slug|g" \
        -e "s|{{DESC}}|$desc|g" \
        -e "s|{{DATE}}|$date|g" \
        -e "s|{{BODY}}|$body|g" \
        "$ROOT/templates/post.html" > "$out"
    echo "created post: $out"
    add_post_to_blog_index "$title" "$slug"
    add_to_sitemap "https://offband.dev/blog/posts/$slug.html"
    ;;

  serve)
    # local preview at http://127.0.0.1:8000
    cd "$ROOT"
    echo "serving at http://127.0.0.1:8000"
    python3 -m http.server 8000
    ;;

  help|"")
    cat <<EOF
usage:
  $0 new:page "Title" path.html ["Short description"]
  $0 new:post "Title" ["Short description"]
  $0 serve   # local preview server
EOF
    ;;
esac
