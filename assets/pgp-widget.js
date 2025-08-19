// /assets/pgp-widget.js (standardized)
(function () {
  // IDs expected in the markup (must match connect/index.html)
  const IDS = {
    recipient: 'pgp-recipient',   // <select>
    plain:     'pgp-plain',       // <textarea>
    output:    'pgp-armored',     // <textarea>
    encBtn:    'pgp-encrypt',     // <button>
    copyBtn:   'pgp-copy',        // <button>
    dlBtn:     'pgp-download',    // <button>
    mailBtn:   'pgp-email'        // <a>
  };

  // Conservative safe length for mailto bodies (encoded)
  const MAILTO_SAFE_LIMIT = 1800;

  // Helper shorthands
  function byId(id) { return document.getElementById(id); }
  function val(el)  { return (el?.value || '').trim(); }

  function enableActionButtons(enabled) {
    [IDS.copyBtn, IDS.dlBtn, IDS.mailBtn].forEach(id => {
      const el = byId(id);
      if (el) el.disabled = !enabled;
    });
  }

  // Load key once (from the path used on the connect page)
  let cachedKey = null;
  async function getKey() {
    if (cachedKey) return cachedKey;
    const res = await fetch('/assets/pgp/offband.asc', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch public key');
    const asc = await res.text();
    cachedKey = await openpgp.readKey({ armoredKey: asc });
    return cachedKey;
  }

  async function encryptMessage(text) {
    const message = await openpgp.createMessage({ text });
    return await openpgp.encrypt({ message, encryptionKeys: await getKey() });
  }

  function bind() {
    const rcpt   = byId(IDS.recipient);
    const plain  = byId(IDS.plain);
    const output = byId(IDS.output);
    const encBtn = byId(IDS.encBtn);
    const copyBtn= byId(IDS.copyBtn);
    const dlBtn  = byId(IDS.dlBtn);
    const mailBtn= byId(IDS.mailBtn);

    if (!plain || !output || !encBtn) return; // not on this page

    // Prevent accidental form submits
    [encBtn, copyBtn, dlBtn].forEach(b => { if (b) b.type = 'button'; });

    // Disabled until first successful encrypt
    enableActionButtons(false);

    // Encrypt
    encBtn.addEventListener('click', async () => {
      try {
        if (typeof openpgp === 'undefined') throw new Error('OpenPGP not loaded');
        const text = val(plain);
        if (!text) {
          alert('Write a message to encrypt.');
          return;
        }
        const armored = await encryptMessage(text);
        output.value = armored;

        // Enable Copy / Download / Email now that we have ciphertext
        enableActionButtons(true);
      } catch (e) {
        console.error('[pgp-widget] encrypt failed:', e);
        alert('Encrypt failed: ' + e.message);
        enableActionButtons(false);
      }
    });

    // Copy
    copyBtn?.addEventListener('click', async () => {
      const armored = val(output);
      if (!armored) { alert('Encrypt your message first.'); return; }
      try {
        await navigator.clipboard.writeText(armored);
        alert('Encrypted text copied to clipboard.');
      } catch (e) {
        try {
          output.select();
          document.execCommand('copy');
          alert('Encrypted text copied to clipboard.');
        } catch {
          alert('Copy blocked. Select the text and copy manually.');
        }
      }
    });

    // Download
    dlBtn?.addEventListener('click', () => {
      const armored = val(output);
      if (!armored) { alert('Encrypt your message first.'); return; }
      const blob = new Blob([armored], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'offband-message.asc';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    });

    // Open in email (clipboard‑first with size guard)
    mailBtn?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const armored = val(output);
      if (!armored) { alert('Encrypt your message first.'); return; }

      const to = rcpt?.value || 'connect@offband.dev';
      const subject = 'Encrypted message for Offband';

      // Try to copy full ciphertext to clipboard first
      try { await navigator.clipboard.writeText(armored); } catch {}

      // Encode body; if too big, send short instructions instead
      const crlfBody = armored.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
      const encodedBody = encodeURIComponent(crlfBody);

      let bodyParam;
      if (encodedBody.length > MAILTO_SAFE_LIMIT) {
        bodyParam = encodeURIComponent(
          'PGP message copied to your clipboard.\r\n\r\n' +
          'Paste it into the email body (or use the Download button to attach the .asc file).'
        );
      } else {
        bodyParam = encodedBody;
      }

      const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${bodyParam}`;
      window.location.href = href;
    });
  }

  // Bind after includes and on DOM ready
  document.addEventListener('includes:loaded', bind);
  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();