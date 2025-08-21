// Security dashboard placeholder hydrator (read-safe, no backend required)
// Aligns with security/index.html IDs and current site structure.
(function () {
  // --- helpers -------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function setText(id, value) { var el = $(id); if (el) el.textContent = value; }
  function nowISO() { return new Date().toISOString(); }
  function fmtLocal(ts) {
    var d = (ts instanceof Date) ? ts : new Date(ts);
    return d.toLocaleString(undefined, { hour12: false });
  }
  function minutesAgo(min) { return Date.now() - min * 60 * 1000; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // --- trust strip / KPIs --------------------------------------------------
  // Updated timestamp (human-friendly local time)
  setText('kpi-updated', fmtLocal(new Date()));

  // Bans (last hour) – keep small but non-zero sometimes
  setText('kpi-bans', String(Math.random() < 0.7 ? randInt(0, 2) : randInt(3, 9)));

  // Bot noise (requests blocked/min) – tiny placeholder number
  setText('kpi-bots', String(randInt(0, 3)));

  // Last blocked (within the past hour)
  var lastMin = randInt(2, 58);
  setText('last-blocked', fmtLocal(minutesAgo(lastMin)));

  // Honeypot state (placeholder cycle)
  (function () {
    var el = $('honeypot');
    if (!el) return;
    var states = ['idle', 'arming', 'idle'];
    el.textContent = states[randInt(0, states.length - 1)];
  })();

  // Overall status – keep as ok unless we want to demo degraded
  (function () {
    var el = $('sec-status');
    if (!el) return;
    var isDegraded = Math.random() < 0.1; // 10% chance demo state
    el.textContent = isDegraded ? 'degraded' : 'ok';
    // add a status class if present in CSS
    if (el.classList) {
      el.classList.remove('ok', 'degraded');
      el.classList.add(isDegraded ? 'degraded' : 'ok');
    }
  })();

  // --- recent activity list ------------------------------------------------
  (function () {
    // We support either a wrapper #recent-logs with children, or standalone list ids
    var list = $('events-list') || (function () {
      var container = $('recent-logs');
      return container ? container.querySelector('#events-list') : null;
    })();
    var empty = $('events-empty') || (function () {
      var container = $('recent-logs');
      return container ? container.querySelector('#events-empty') : null;
    })();

    if (!list || !empty) return;

    // Populate a single synthetic line so the list isn’t empty pre-backend
    var li = document.createElement('li');
    li.className = 'post-list-item';
    li.innerHTML = '<span class="muted">No real entries yet — logging pipeline wiring in progress.</span>';
    list.appendChild(li);

    // toggle empty/list visibility
    list.style.display = '';
    empty.style.display = 'none';
  })();

  // --- tools list (placeholder) -------------------------------------------
  (function () {
    // If a #tools-list exists and is empty, add gentle placeholder text
    var tl = $('tools-list');
    if (!tl) return;
    if (tl.children.length === 0) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="muted">Tools will be populated from <code>/security/tools/</code> soon.</span>';
      tl.appendChild(li);
    }
  })();
})();
