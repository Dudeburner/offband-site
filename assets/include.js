// Simple HTML include loader: replaces any [data-include] node with fetched HTML
(() => {
  const nodes = document.querySelectorAll('[data-include]');
  if (!nodes.length) return;

  Promise.all(
    [...nodes].map(async n => {
      const url = n.getAttribute('data-include');
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`include failed: ${url} -> ${res.status}`);
      const html = await res.text();
      // Replace the placeholder node with the fetched markup
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      n.replaceWith(frag);
    })
  ).then(() => {
    document.dispatchEvent(new Event('includes:loaded'));
  }).catch(err => {
    console.error(err);
  });
})();
