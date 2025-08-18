// Client-side search + tag filtering for /writeups
(function () {
  const q = document.getElementById('wu-q');
  const list = document.getElementById('wu-list');
  const meta = document.getElementById('wu-meta');
  const pills = Array.from(document.querySelectorAll('#wu-filters .pill'));

  if (!q || !list) return;

  function norm(s) { return (s || '').toLowerCase(); }
  function activeTags() {
    return pills.filter(p => p.getAttribute('aria-pressed') === 'true')
                .map(p => p.dataset.tag);
  }
  function matches(item, query, tags) {
    const text = norm(item.textContent);
    const itemTags = norm(item.getAttribute('data-tags') || '');
    const qOk = !query || text.includes(query);
    const tOk = tags.length === 0 || tags.every(t => itemTags.includes(t));
    return qOk && tOk;
  }
  function apply() {
    const query = norm(q.value.trim());
    const tags = activeTags();
    let shown = 0;

    Array.from(list.children).forEach(li => {
      const ok = matches(li, query, tags);
      li.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });

    if (meta) {
      const parts = [];
      if (query) parts.push(`search: “${q.value}”`);
      if (tags.length) parts.push(`tags: ${tags.join(', ')}`);
      meta.textContent = `${shown} result${shown === 1 ? '' : 's'}${parts.length ? ' — ' + parts.join(' • ') : ''}`;
    }
  }
  q.addEventListener('input', apply);
  pills.forEach(p => p.addEventListener('click', () => {
    const pressed = p.getAttribute('aria-pressed') === 'true';
    p.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    apply();
  }));
  apply();
})();
