// /assets/pgp-widget.js
(function () {
  // IDs expected in the markup
  const IDS = {
    recipient: 'pgp-recipient',     // <select>
    plain:     'pgp-plain',         // <textarea>
    output:    'pgp-output',        // <textarea>
    encBtn:    'pgp-encrypt',       // <button>
    copyBtn:   'pgp-copy',          // <button>
    dlBtn:     'pgp-download',      // <button>
    mailBtn:   'pgp-email'          // <a>
  };

  async function ensureKey() {
    // Adjust the path to match where your key really lives.
    // Your Network tab shows you fetching /offband.asc successfully.
    const res = await fetch('/offband.asc', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch public key');
    const asc = await res.text();
    return await openpgp.readKey({ armoredKey: asc });
  }

  async function encryptTo(key, text) {
    const message = await openpgp.createMessage({ text });
    return await openpgp.encrypt({ message, encryptionKeys: key });
  }

  function byId(id) { return document.getElementById(id); }
  function text(el) { return (el?.value || '').trim(); }

  function enableButtons(enabled) {
    [IDS.copyBtn, IDS.dlBtn, IDS.mailBtn].forEach(id => {
      const el = byId(id);
      if (el) el.disabled = !enabled;
    });
  }

  function bind() {
    const sel     = byId(IDS.recipient);
    const plainEl = byId(IDS.plain);
    const outEl   = byId(IDS.output);
    const encBtn  = byId(IDS.encBtn);
    const copyBtn = byId(IDS.copyBtn);
    const dlBtn   = byId(IDS.dlBtn);
    const mailBtn = byId(IDS.mailBtn);

    if (!encBtn || !plainEl || !outEl) {
      // Not on this page
      return;
    }

    // Prevent buttons inside a form from submitting
    [encBtn, copyBtn, dlBtn].forEach(b => { if (b) b.type = 'button'; });
    enableButtons(false);

    let pubKey = null; // cache after first fetch

    encBtn.addEventListener('click', async () => {
      try {
        if (typeof openpgp === 'undefined') {
          throw new Error('OpenPGP not loaded');
        }
        const msg = text(plainEl);
        if (!msg) {
          alert('Write a message to encrypt.');
          return;
        }
        pubKey = pubKey || await ensureKey();

        const armored = await encryptTo(pubKey, msg);
        outEl.value = armored;

        // Copy/Download/Email become active now
        enableButtons(true);

        // Update mailto link to selected recipient with the armored text
        const to = sel?.value || 'contact@offband.dev';
        const mailHref = 'mailto:' + encodeURIComponent(to)
          + '?subject=' + encodeURIComponent('Encrypted message')
          + '&body=' + encodeURIComponent(armored);
        if (mailBtn) mailBtn.href = mailHref;
      } catch (e) {
        console.error('[pgp-widget] encrypt failed:', e);
        alert('Encrypt failed: ' + e.message);
        enableButtons(false);
      }
    });

    copyBtn?.addEventListener('click', async () => {
      const val = text(outEl);
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
      } catch {
        // Fallback
        outEl.select();
        document.execCommand('copy');
      }
    });

    dlBtn?.addEventListener('click', () => {
      const val = text(outEl);
      if (!val) return;
      const blob = new Blob([val], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'offband-encrypted.asc.txt';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    });
  }

  // Wait for your HTML partials to finish loading (include.js fires this)
  document.addEventListener('includes:loaded', bind);
  // And also bind on DOM ready (in case the widget lives in the base page)
  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();