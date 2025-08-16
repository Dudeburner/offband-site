(function () {
  function init() {
    var mount = document.getElementById('sb');
    if (!mount) return;

    fetch('/components/sidebar.html', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (html) {
        mount.innerHTML = '<h3>Navigate</h3>' + html;
        try { window.__initSidebarTree && window.__initSidebarTree(mount); } catch (e) {}
        try { window.__highlightActive && window.__highlightActive(mount); } catch (e) {}
      })
      .catch(function () {
        // minimal fallback so the sidebar is never blank
        mount.innerHTML =
          '<h3>Navigate</h3>' +
          '<ul class="tree">' +
          '  <li><a href="/">Home</a></li>' +
          '  <li><a href="/about.html">About</a></li>' +
          '  <li><a href="/blog/">Blog</a></li>' +
          '  <li><a href="/status.html">Status (soon)</a></li>' +
          '</ul>';
      });
  }

  // be safe about load order
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
