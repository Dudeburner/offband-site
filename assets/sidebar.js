// assets/sidebar.js
// Sidebar behavior (collapse sidebar) + separate tree controls.
// Minimal, theme-agnostic, idempotent. No layout/CSS changes here.

const SIDEBAR_STATE_KEY = "offband.sidebarCollapsed";
const BODY_COLLAPSE_CLASS = "sidebar-collapsed";

// --- Core state ---
function setSidebarCollapsed(collapsed) {
  const body = document.body;
  if (!body) return;

  if (collapsed) {
    body.classList.add(BODY_COLLAPSE_CLASS);
  } else {
    body.classList.remove(BODY_COLLAPSE_CLASS);
  }
  // Persist
  try { localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed)); } catch {}

  // Reflect state on the main sidebar toggle button if present
  const btn = document.getElementById("sidebar-toggle");
  if (btn) {
    btn.setAttribute("aria-expanded", String(!collapsed));
    // Avoid styling churn; only update accessible label/title
    const collapsedLabel = "Expand sidebar";
    const expandedLabel = "Collapse sidebar";
    const label = collapsed ? collapsedLabel : expandedLabel;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    // If your UI expects the button text to change, uncomment:
    // if (!btn.dataset.lockText) btn.textContent = label;
  }
}

function getInitialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
  } catch {
    return false;
  }
}

// --- Tree controls (operate ONLY on the nav tree) ---
function collapseTree() {
  document.querySelectorAll('#sidebar nav details[open]').forEach(d => { d.open = false; });
}
function expandTree() {
  document.querySelectorAll('#sidebar nav details').forEach(d => { d.open = true; });
}

// --- Wiring (idempotent) ---
function initSidebarOnce() {
  // Guard so re-imports don’t double-bind
  if (document.documentElement.dataset.sidebarInit === "1") return;
  document.documentElement.dataset.sidebarInit = "1";

  // Restore persisted state
  setSidebarCollapsed(getInitialCollapsed());

  // Sidebar toggle (collapses the whole sidebar)
  const toggle = document.getElementById("sidebar-toggle");
  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = "1";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isCollapsed = document.body.classList.contains(BODY_COLLAPSE_CLASS);
      setSidebarCollapsed(!isCollapsed);
    });
  }

  // Tree controls (do NOT touch sidebar width)
  const btnCollapseAll = document.getElementById("tree-collapse-all");
  const btnExpandAll = document.getElementById("tree-expand-all");

  if (btnCollapseAll && !btnCollapseAll.dataset.bound) {
    btnCollapseAll.dataset.bound = "1";
    btnCollapseAll.addEventListener("click", (e) => { e.preventDefault(); collapseTree(); });
  }
  if (btnExpandAll && !btnExpandAll.dataset.bound) {
    btnExpandAll.dataset.bound = "1";
    btnExpandAll.addEventListener("click", (e) => { e.preventDefault(); expandTree(); });
  }
}

// Initialize when DOM is ready (safe if this file loads in <head> or end of <body>)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidebarOnce, { once: true });
} else {
  initSidebarOnce();
}
