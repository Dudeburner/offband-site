// include.js — robust HTML include with cache-bust + script execution + logging
(function () {
  const VERSION = '2025-08-18a'; // bump when you change any included partials

  function ready(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  function execInlineScripts(container){
    const scripts = container.querySelectorAll('script');
    scripts.forEach((old) => {
      const s = document.createElement('script');
      [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
      s.text = old.textContent || '';
      old.replaceWith(s);
    });
  }

  ready(async () => {
    const hosts = [...document.querySelectorAll('[data-include]')];
    if (!hosts.length) return;

    console.log('[include.js] start, nodes:', hosts.length);

    await Promise.all(hosts.map(async (host) => {
      let url = host.getAttribute('data-include') || '';
      if (!url) return;

      // Cache-bust to defeat CDN/proxy stale copies
      url += (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(VERSION);

      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const html = await res.text();

        const tmp = document.createElement('div');
        tmp.innerHTML = html;

        const frag = document.createDocumentFragment();
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);

        host.replaceWith(frag);
        execInlineScripts(document);
        console.log('[include.js] included:', url);
      } catch (err) {
        console.error('[include.js] FAILED:', url, err);
        const fallback = document.createElement('div');
        fallback.textContent = `<!-- include failed: ${url} -->`;
        host.replaceWith(fallback);
      }
    }));

    document.dispatchEvent(new Event('includes:loaded'));
  });
})();
