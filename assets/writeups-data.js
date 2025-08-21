'use strict';
/*
 * writeups-data.js — single source of truth for writeups discovery & metadata
 * Used by: /writeups/index.html and assets/sidebar.js
 *
 * Discovery order:
 *   1) /writeups/posts/index.json  -> ["/writeups/posts/2025-08-16-foo.html", ...]
 *   2) /sitemap.xml                -> <loc> entries under /writeups/posts/
 *   3) /writeups/posts/index.html  -> links on that page (if present)
 *   4) Fallback: any anchors already present on the current page
 *
 * Exposed API (on window.WriteupsData):
 *   - discoverPosts(): Promise<string[]>
 *   - hydratePost(href): Promise<Post>
 *   - listPosts(): Promise<Post[]>
 *   - groupByCategory(posts): Map<string, Post[]>
 *   - util: { norm, fetchHTML, unique, POSTS_DIR }
 */
(function(){
  const ORIGIN    = location.origin;
  const POSTS_DIR = '/writeups/posts/';

  /** Normalize to absolute pathname (no origin) */
  function norm(u){
    try { return new URL(u, ORIGIN).pathname; } catch (_) { return String(u || ''); }
  }

  /** Fetch & parse HTML into a Document */
  async function fetchHTML(path){
    const res = await fetch(path, { credentials: 'omit', cache: 'no-cache' });
    if (!res.ok) throw new Error(`fetch ${path} ${res.status}`);
    const text = await res.text();
    return new DOMParser().parseFromString(text, 'text/html');
  }

  const unique = arr => [...new Set(arr.filter(Boolean))];

  async function discoverPosts(){
    // 1) JSON manifest
    try {
      const res = await fetch(new URL('index.json', POSTS_DIR), { credentials: 'omit', cache: 'no-cache' });
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) {
          return unique(arr
            .filter(h => typeof h === 'string' && /\/writeups\/posts\/.+\.html?$/i.test(h))
            .map(h => norm(h))
          );
        }
      }
    } catch (_) {}

    // 2) sitemap.xml
    try {
      const doc = await fetchHTML('/sitemap.xml');
      const urls = Array.from(doc.querySelectorAll('url > loc, loc'))
        .map(el => (el.textContent || '').trim())
        .filter(h => h.includes('/writeups/posts/') && /\.html?$/i.test(h))
        .map(h => norm(h));
      if (urls.length) return unique(urls);
    } catch (_) {}

    // 3) /writeups/posts/index.html (if present)
    try {
      const doc = await fetchHTML(new URL('index.html', POSTS_DIR).pathname);
      const urls = Array.from(doc.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href'))
        .filter(h => h && /\.html?$/i.test(h) && !/\/?index\.html?$/i.test(h))
        .map(h => norm(new URL(h, new URL('index.html', POSTS_DIR)).pathname));
      if (urls.length) return unique(urls);
    } catch (_) {}

    // 4) fallback — anchors already in current page
    try {
      const root = document.getElementById('wu-list') || document;
      const urls = Array.from(root.querySelectorAll('a[href^="/writeups/posts/"]'))
        .map(a => norm(a.getAttribute('href')));
      return unique(urls);
    } catch (_) { return []; }
  }

  /**
   * hydratePost(href): fetch post & extract metadata
   * - title: <h1> text (fallback: <title>)
   * - date: <time datetime> or YYYY-MM-DD from filename
   * - tags: <meta name="tags"> comma-separated or article[data-tags]
   * - category: first tag, else first segment after posts/
   */
  async function hydratePost(href){
    const url = norm(href);
    const out = { href: url, title: '', date: '', tags: [], category: '' };
    try {
      const doc = await fetchHTML(url);
      // title
      const h1 = doc.querySelector('main h1, article h1, h1');
      out.title = (h1 && h1.textContent.trim()) || (doc.title || '').replace(/\s*[|–-].*$/, '').trim() || url.split('/').pop();
      // date
      const t = doc.querySelector('time[datetime]');
      if (t && t.getAttribute('datetime')) out.date = t.getAttribute('datetime');
      else {
        const m = url.match(/\/(\d{4}-\d{2}-\d{2})-/);
        if (m) out.date = m[1];
      }
      // tags
      const mt = doc.querySelector('meta[name="tags"]');
      if (mt && mt.content) {
        out.tags = mt.content.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        const art = doc.querySelector('article[data-tags]');
        if (art) out.tags = String(art.getAttribute('data-tags') || '').split(',').map(s => s.trim()).filter(Boolean);
      }
      // category heuristic
      out.category = out.tags[0] || (url.replace(POSTS_DIR, '').split('/')[0] || 'General');
    } catch (_) {
      out.title = out.title || url.split('/').pop();
    }
    return out;
  }

  async function listPosts(){
    const hrefs = await discoverPosts();
    const items = await Promise.all(hrefs.map(h => hydratePost(h)));
    // newest first when date is present
    return items.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }

  function groupByCategory(posts){
    const map = new Map();
    for (const p of posts) {
      const key = p.category || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return map;
  }

  // Publish API
  window.WriteupsData = {
    discoverPosts,
    hydratePost,
    listPosts,
    groupByCategory,
    util: { norm, fetchHTML, unique, POSTS_DIR }
  };
})();
