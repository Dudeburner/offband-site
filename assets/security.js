// Minimal fake-live pulse so the dashboard feels alive pre-backend.
// Safe to delete later when you wire real data.
(function () {
  function fmt(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { hour12: false });
  }

  // Last probe blocked: pretend something happened within the last hour
  const probeEl = document.getElementById('kpi-probe');
  if (probeEl) {
    const now = Date.now();
    const ago = now - Math.floor(Math.random() * 55 + 3) * 60 * 1000; // 3–58 min ago
    probeEl.textContent = fmt(ago);
  }

  // Incidents (24h): keep it low/zero, randomize occasionally
  const incEl = document.getElementById('kpi-incidents');
  if (incEl) {
    const v = Math.random() < 0.8 ? 0 : Math.floor(Math.random() * 3) + 1;
    incEl.textContent = v;
  }

  // Honeypot status rotation (idle → armed soon)
  const honey = document.getElementById('kpi-honey');
  if (honey) {
    const states = ['idle', 'arming', 'idle'];
    honey.textContent = states[Math.floor(Math.random()*states.length)];
  }

  // Recent events placeholder (one synthetic line so it isn't empty)
  const list = document.getElementById('events-list');
  const empty = document.getElementById('events-empty');
  if (list && empty) {
    const t = document.createElement('li');
    t.className = 'post-list-item';
    t.innerHTML = '<span class="muted">No real entries yet — logging pipeline wiring in progress.</span>';
    list.appendChild(t);
    list.style.display = '';
    empty.style.display = 'none';
  }
})();

(function () {
  const out = () => document.getElementById('pgp-armored')?.value?.trim() || '';

  // Copy to clipboard
  document.getElementById('pgp-copy')?.addEventListener('click', async () => {
    const text = out();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      alert('Encrypted text copied to clipboard.');
    } catch (e) {
      alert('Copy failed. Select the text and copy manually.');
    }
  });

  // Download as .asc
  document.getElementById('pgp-download')?.addEventListener('click', () => {
    const text = out();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'offband-message.asc';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  document.getElementById('pgp-email')?.addEventListener('click', async (ev) => {
    ev.preventDefault();

    // Pull the armored message safely
    const a = document.getElementById('pgp-armored');
    const armored = (a?.value || '').replace(/\r\n/g, '\n');
    if (!armored.trim()) {
      alert('Nothing to send yet. Click Encrypt first.');
      return;
    }

    const to = document.getElementById('pgp-recipient')?.value || 'connect@offband.dev';
    const subject = 'Encrypted message for Offband';

    // Normalize newlines to CRLF per RFC, then encode
    const crlf = armored.replace(/\n/g, '\r\n');
    const encodedBody = encodeURIComponent(crlf);

    // Some mail clients choke on large mailto bodies. Guard/fallback.
    const MAILTO_SAFE_LIMIT = 1800; // conservative
    if (encodedBody.length > MAILTO_SAFE_LIMIT) {
      // Best‑effort: copy to clipboard and attach short instructions
      try { await navigator.clipboard.writeText(armored); } catch {}
      const shortBody = encodeURIComponent(
        'PGP message copied to your clipboard.\r\n\r\n'
        + 'Paste it into the email body, or attach the downloaded .asc file.'
      );
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${shortBody}`;
      return;
    }

    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodedBody}`;
  });

  // Optional: bind encrypt button if your existing code expects a different id
  document.getElementById('pgp-encrypt')?.addEventListener('click', () => {
    // If your encrypt function is already wired elsewhere, you can remove this.
    // Otherwise, call your existing encrypt routine here.
    // e.g. window.offbandEncrypt && window.offbandEncrypt();
  });
})();
