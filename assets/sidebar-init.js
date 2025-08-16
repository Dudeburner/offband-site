# on your Mac repo (offband-site)
cat > assets/sidebar-init.js <<'JS'
(function(){
  const mount = document.getElementById('sb');
  if (!mount) return;

  fetch('/components/sidebar.html', {cache:'no-cache'})
    .then(r => r.ok ? r.text() : Promise.reject(r.status))
    .then(html => {
      mount.innerHTML = '<h3>Navigate</h3>' + html;
      try { window.__initSidebarTree && window.__initSidebarTree(mount); } catch(e){}
      try { window.__highlightActive && window.__highlightActive(mount); } catch(e){}
    })
    .catch(() => {
      mount.innerHTML = `
        <h3>Navigate</h3>
        <ul class="tree">
          <li><a href="/">Home</a></li>
          <li><a href="/about.html">About</a></li>
          <li><a href="/blog/">Blog</a></li>
          <li><a href="/status.html">Status (soon)</a></li>
        </ul>`;
    });
})();
JS

git add assets/sidebar-init.js
git commit -m "sidebar: add sidebar-init.js (robust loader + fallback)"
git push
