fetch('/components/sidebar.html')
  .then(r => r.text())
  .then(html => {
    const sb = document.getElementById('sb');
    if (!sb) return;
    sb.innerHTML = '<h3>Navigate</h3>' + html;
    if (window.__initSidebarTree) window.__initSidebarTree(sb);
    if (window.__highlightActive) window.__highlightActive(sb);
  });
