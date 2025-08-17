<script>
(() => {
  const nodes = document.querySelectorAll('[data-include]');
  Promise.all([...nodes].map(async n => {
    const url = n.getAttribute('data-include');
    const res = await fetch(url, { cache: 'no-store' });
    n.outerHTML = await res.text();
  })).then(() => document.dispatchEvent(new Event('includes:loaded')));
})();
</script>
