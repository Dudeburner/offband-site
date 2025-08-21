// assets/sidebar.js
// Sidebar behavior + tree initialization for dynamically injected markup.
// Single source of truth for sidebar logic. Idempotent. Theme-agnostic.

(function(){
  const COLLAPSE_KEY = 'offband.sidebarCollapsed';
  const TREE_STATE_KEY = 'sidebar.v1'; // matches prior storage
  const BODY_COLLAPSE_CLASS = 'sidebar-collapsed';
  const WU = (typeof window !== 'undefined' && window.WriteupsData) ? window.WriteupsData : null;

  // Lazy-load the shared writeups-data module if not present
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  async function ensureWriteupsData() {
    if (window.WriteupsData) return;
    try { await loadScript('/assets/writeups-data.js'); } catch {}
  }

  // ---------------- Core collapse state ----------------
  function setSidebarCollapsed(collapsed) {
    const body = document.body;
    if (!body) return;
    body.classList.toggle(BODY_COLLAPSE_CLASS, !!collapsed);
    try { localStorage.setItem(COLLAPSE_KEY, String(!!collapsed)); } catch {}
  }
  function getInitialCollapsed() {
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; }
  }

  // Apply saved collapse state early
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setSidebarCollapsed(getInitialCollapsed()); }, { once: true });
  } else {
    setSidebarCollapsed(getInitialCollapsed());
  }

  // ---------------- Tree helpers (scoped to a root) ----------------
  function persistTreeState(nav) {
    const state = {};
    nav.querySelectorAll('.folder').forEach((li, idx) => {
      state[idx] = li.getAttribute('aria-expanded') === 'true';
    });
    try { localStorage.setItem(TREE_STATE_KEY, JSON.stringify(state)); } catch {}
  }
  function restoreTreeState(nav) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(TREE_STATE_KEY) || '{}'); } catch {}
    nav.querySelectorAll('.folder').forEach((li, idx) => {
      const open = (saved && saved[idx] !== undefined) ? !!saved[idx] : li.hasAttribute('data-open');
      setOpen(li, open);
    });
  }
  function setOpen(li, open) {
    li.setAttribute('aria-expanded', open ? 'true' : 'false');
    li.dataset.open = open ? 'true' : 'false';
    const twisty = li.querySelector('.twisty');
    if (twisty) twisty.textContent = open ? '▾' : '▸';
  }
  function toggleFolder(li, nav) {
    const next = li.getAttribute('aria-expanded') !== 'true';
    setOpen(li, next);
    persistTreeState(nav);
  }
  function collapseAll(nav) {
    nav.querySelectorAll('.folder').forEach((li) => setOpen(li, false));
    persistTreeState(nav);
  }
  function expandAll(nav) {
    nav.querySelectorAll('.folder').forEach((li) => setOpen(li, true));
    persistTreeState(nav);
  }

  function anyOpen(nav) {
    return !!nav.querySelector('.folder[aria-expanded="true"]');
  }

  // ---------------- Active link highlight ----------------
  function normPath(p){
    const u = (p || '/').split('#')[0].split('?')[0];
    return u.replace(/\/+$/, '/') || '/';
  }
  function highlightActive(root){
    const nav = root ? root.querySelector('nav.sidebar') : document.querySelector('nav.sidebar');
    if (!nav) return;
    const here = normPath(location.pathname);
    nav.querySelectorAll('a[href]').forEach((a) => {
      const href = normPath(a.getAttribute('href'));
      if (here === href || (href !== '/' && here.startsWith(href))) {
        a.classList.add('active');
        const parent = a.closest('.folder');
        if (parent) setOpen(parent, true);
      }
    });
  }

  // ---------------- Auto-populate helpers ----------------
  async function getLinks(url, filterFn, max=5) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('fetch failed: ' + url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href]'))
      .map(a => ({ href: a.getAttribute('href'), text: (a.textContent||'').trim() }))
      .filter(({href, text}) => href && filterFn(href, text));
    const norm = (h) => (/^https?:\/\//i.test(h)) ? h : new URL(h, url).pathname;
    return links.slice(0, max).map(({href, text}) => ({ href: norm(href), text }));
  }
  function insertItems(placeholder, items) {
    if (!placeholder || !items || !items.length) return;
    const frag = document.createDocumentFragment();
    items.forEach(({href, text}) => {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'row';
      const a = document.createElement('a');
      a.href = href; a.textContent = text || href;
      row.appendChild(a); li.appendChild(row); frag.appendChild(li);
    });
    placeholder.replaceWith(frag);
  }

  // Build Writeups tree from shared data (categories -> posts)
  async function populateWriteupsFromShared(nav){
    await ensureWriteupsData();
    const WU = window.WriteupsData;
    if (!WU || typeof WU.listPosts !== 'function' || typeof WU.groupByCategory !== 'function') return;
    // Find the Writeups folder by its anchor
    const folderLink = nav.querySelector('.tree .folder > .row a[href="/writeups/"]');
    if (!folderLink) return;
    const folder = folderLink.closest('.folder');
    const list = folder && folder.querySelector(':scope > ul');
    if (!list) return;
    try {
      const posts = await WU.listPosts();
      const grouped = WU.groupByCategory(posts);
      // Clear existing (placeholder) items
      list.innerHTML = '';
      for (const [cat, items] of grouped.entries()) {
        const li = document.createElement('li');
        li.className = 'folder';
        li.setAttribute('aria-expanded', 'false');
        // category header row
        const row = document.createElement('div');
        row.className = 'row';
        const span = document.createElement('span');
        span.className = 'label';
        span.textContent = cat;
        row.appendChild(span);
        li.appendChild(row);
        // children list
        const ul = document.createElement('ul');
        items.forEach(p => {
          const cli = document.createElement('li');
          const a = document.createElement('a');
          a.href = p.href;
          a.textContent = p.title || p.href.split('/').pop();
          cli.appendChild(a);
          ul.appendChild(cli);
        });
        li.appendChild(ul);
        list.appendChild(li);
      }
      // Wire toggles on the new category folders
      list.querySelectorAll(':scope > li.folder > .row').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target && e.target.tagName === 'A') return;
          const parent = row.parentElement;
          const open = parent.getAttribute('aria-expanded') === 'true';
          parent.setAttribute('aria-expanded', open ? 'false' : 'true');
        });
        row.addEventListener('keydown', (e) => {
          const parent = row.parentElement;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const open = parent.getAttribute('aria-expanded') === 'true'; parent.setAttribute('aria-expanded', open ? 'false' : 'true'); }
          if (e.key === 'ArrowRight') { parent.setAttribute('aria-expanded', 'true'); }
          if (e.key === 'ArrowLeft')  { parent.setAttribute('aria-expanded', 'false'); }
        });
      });
      // Ensure the parent Writeups folder is open so categories are visible on first render
      setOpen(folder, true);
      persistTreeState(nav);
    } catch (_) {
      // Silent fail; sidebar can remain static
    }
  }

  async function autoPopulate(nav){
    try {
      let usedShared = false;
      try { await populateWriteupsFromShared(nav); usedShared = true; } catch(_) {}
      if (!usedShared) {
        try {
          const writeups = await getLinks('/writeups/', (href) => /\/writeups\//.test(href) && !(/\/?index\.html?$/i.test(href)), 5);
          insertItems(nav.querySelector('.auto-writeups'), writeups);
        } catch(_){}
      }
      // Logs remain simple: pull latest few from the logs index page
      try {
        const logs = await getLinks('/security/logs/', (href) => /\/security\/logs\//.test(href) && !(/\/?index\.html?$/i.test(href)), 5);
        insertItems(nav.querySelector('.auto-logs'), logs);
      } catch(_){}
    } catch(_){}
  }

  // ---------------- Public initializer (called after HTML inject) ----------------
  function initSidebarTree(root){
    const mount = root || document;
    const nav = mount.querySelector('nav.sidebar');
    if (!nav || nav.dataset.bound === '1') return; // idempotent
    nav.dataset.bound = '1';

    // Restore tree state
    restoreTreeState(nav);

    // Toolbar caret toggle
    const caret = nav.querySelector('#tree-toggle');
    const updateCaret = () => {
      if (!caret) return;
      const open = anyOpen(nav);
      caret.textContent = open ? '▾' : '▸';
      caret.setAttribute('aria-pressed', String(open));
    };
    if (caret && !caret.dataset.bound) {
      caret.dataset.bound = '1';
      caret.addEventListener('click', (e) => {
        e.preventDefault();
        anyOpen(nav) ? collapseAll(nav) : expandAll(nav);
        updateCaret();
      });
      updateCaret();
    }

    // Sidebar collapse toggle (− button in toolbar)
    const sbToggle = nav.querySelector('#sidebar-toggle');
    if (sbToggle && !sbToggle.dataset.bound) {
      sbToggle.dataset.bound = '1';
      sbToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isCollapsed = document.body.classList.contains(BODY_COLLAPSE_CLASS);
        setSidebarCollapsed(!isCollapsed);
        // Reflect ARIA state
        sbToggle.setAttribute('aria-expanded', String(isCollapsed));
      });
      // Reflect persisted state on load
      sbToggle.setAttribute('aria-expanded', String(!document.body.classList.contains(BODY_COLLAPSE_CLASS)));
    }

    // Folder rows: click + keyboard
    nav.querySelectorAll('.folder > .row').forEach((row) => {
      const li = row.parentElement;
      if (row.dataset.bound === '1') return;
      row.dataset.bound = '1';
      row.addEventListener('click', (e) => {
        if (e.target && e.target.tagName === 'A') return; // let links pass
        toggleFolder(li, nav);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFolder(li, nav); }
        if (e.key === 'ArrowRight') { setOpen(li, true); persistTreeState(nav); }
        if (e.key === 'ArrowLeft')  { setOpen(li, false); persistTreeState(nav); }
      });
    });

    // Active highlight
    highlightActive(mount);

    // Auto-populate
    autoPopulate(nav);
  }

  // Expose globals used by sidebar-init.js
  window.__initSidebarTree = initSidebarTree;
  window.__highlightActive = highlightActive;

})();
