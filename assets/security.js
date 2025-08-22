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

// Security dashboard hydrator (reads sanitized artifacts)
// Fetches /security/totals.json, /security/daily.csv, /security/daily/<UTC-YYYY-MM-DD>.ndjson
// Safe fallbacks if files are missing. No backend execution required.
(function(){
  const $ = id => document.getElementById(id);
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const toLocal = iso => { try { return new Date(iso).toLocaleString(undefined, {hour12:false}); } catch { return iso || "—"; } };
  const utcToday = () => new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const fetchJSON = url => fetch(url, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(()=>null);
  const fetchText = url => fetch(url, {cache:"no-store"}).then(r => r.ok ? r.text() : "").catch(()=>"");
  const parseCSV = txt => {
    const lines = (txt||"").trim().split(/\r?\n/).filter(Boolean);
    if(!lines.length) return [];
    const head = lines[0].split(",");
    return lines.slice(1).map(line => {
      const cols = line.split(",");
      const row = {};
      head.forEach((h,i)=> row[h]=cols[i]);
      return row;
    });
  };
  const renderEvent = ev => {
    const li = document.createElement("li");
    li.className = "post-list-item";
    let desc = "";
    if (ev.source==="nginx" && ev.kind==="probe") {
      desc = `HTTP probe ${ev.st||""} ${ev.p||""}`.trim();
    } else if (ev.source==="nginx" && String(ev.kind).startsWith("tls_")) {
      desc = `TLS ${ev.kind.replace("tls_","").replace(/_/g," ")}`;
    } else if (ev.source==="firewall") {
      desc = `Firewall ${ev.kind} ${ev.proto||""}${ev.dpt? " :"+ev.dpt:""}`.trim();
    } else if (ev.source==="fail2ban") {
      desc = `Fail2ban ${ev.kind}${ev.jail? " ("+ev.jail+")":""}`;
    } else if (ev.source==="sshd") {
      desc = `SSH ${ev.kind}`;
    } else {
      desc = `${ev.source||"event"} ${ev.kind||""}`.trim();
    }
    li.innerHTML = `<span class="muted">${toLocal(ev.ts||new Date().toISOString())}</span> · <strong>${desc}</strong>`;
    return li;
  };

  async function hydrateTiles(){
    const totals = await fetchJSON("/security/totals.json");
    if(totals && totals.totals){
      setText("kpi-updated", toLocal(totals.updated||""));
      setText("kpi-bans", Number(totals.totals.bans||0).toLocaleString());
      setText("kpi-bots", Number(totals.totals.bot_hits||0).toLocaleString());
    }
  }

  async function hydrateRecent(){
    const list = $("recent-logs");
    if(!list) return;
    const today = utcToday();
    const nd = await fetchText(`/security/daily/${today}.ndjson`);
    list.innerHTML = "";
    if(!nd){
      const li = document.createElement("li");
      li.className="post-list-item";
      li.innerHTML = `<span class="muted">No events published yet for ${today} (UTC).</span>`;
      list.appendChild(li);
      // also mirror last-blocked to last update if available
      const up = $("kpi-updated");
      if(up) setText("last-blocked", up.textContent || "—");
      return;
    }
    const rows = nd.trim().split(/\r?\n/).filter(Boolean).slice(-10)
      .map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
    if(!rows.length){
      const li=document.createElement("li"); li.className="post-list-item"; li.innerHTML=`<span class="muted">No events parsed for ${today}.</span>`; list.appendChild(li);
      return;
    }
    rows.reverse().forEach(ev => list.appendChild(renderEvent(ev)));
    const newest = rows[0];
    if(newest && $("last-blocked")) setText("last-blocked", toLocal(newest.ts));
  }

  async function load(){
    await hydrateTiles();
    await hydrateRecent();
  }

  window.addEventListener("DOMContentLoaded", load);
  setInterval(load, 5*60*1000);
})();