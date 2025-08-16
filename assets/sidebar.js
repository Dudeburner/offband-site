(function(){
  function setExpanded(el, val){
    el.setAttribute('aria-expanded', String(val));
    const icon = el.querySelector('.twisty');
    if(icon) icon.textContent = val ? '▾' : '▸';
  }

  function initTree(root){
    root.querySelectorAll('.folder').forEach(folder=>{
      const btn = folder.querySelector('.twisty');
      const startOpen = folder.dataset.open === 'true';
      setExpanded(folder, !!startOpen);
      btn?.addEventListener('click', (e)=>{
        e.preventDefault();
        const open = folder.getAttribute('aria-expanded') === 'true';
        setExpanded(folder, !open);
      });
      // keyboard support when row is focused
      const row = folder.querySelector('.row');
      row?.addEventListener('keydown', (e)=>{
        if(e.key === 'ArrowRight'){ setExpanded(folder, true); }
        if(e.key === 'ArrowLeft'){ setExpanded(folder, false); }
      });
    });
  }

  // NEW: highlight current path and expand containing folders
  function highlightActive(root){
    // normalize paths: treat / and /index.html the same; drop trailing slash (except root)
    let p = location.pathname;
    if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length);
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

    // find best match (exact first, then with/without trailing slash)
    const links = Array.from(root.querySelectorAll('a[href]'));
    let best = links.find(a => new URL(a.getAttribute('href'), location.origin).pathname === p);
    if (!best && !p.endsWith('/')) {
      best = links.find(a => new URL(a.getAttribute('href'), location.origin).pathname === (p + '/'));
    }
    if (!best && p.endsWith('/')) {
      best = links.find(a => new URL(a.getAttribute('href'), location.origin).pathname === p.slice(0,-1));
    }

    if (best) {
      best.classList.add('active');
      const row = best.closest('.row');
      row?.classList.add('active');

      // expand any parent folders so the active item is visible
      let f = best.closest('.folder');
      while (f) {
        setExpanded(f, true);
        f = f.parentElement?.closest('.folder') || null;
      }
    }
  }

  // expose
  window.__initSidebarTree = initTree;
  window.__highlightActive = highlightActive;
})();
