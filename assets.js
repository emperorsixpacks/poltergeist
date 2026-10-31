// Poltergeist SVG Assets
// String constants injected inline by content.js without external requests.

const GHOST_SVG = `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" class="pg-ghost-svg">
  <defs>
    <radialGradient id="pgBody" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#d9c6ff"/>
    </radialGradient>
    <filter id="pgGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path filter="url(#pgGlow)" fill="url(#pgBody)" d="M10 60 C10 25 30 8 50 8 C70 8 90 25 90 60 L90 108 L78 96 L66 110 L54 96 L42 110 L30 96 L18 110 L10 100 Z"/>
  <ellipse class="pg-eye" cx="36" cy="52" rx="7" ry="10" fill="#1a0f2e"/>
  <ellipse class="pg-eye" cx="64" cy="52" rx="7" ry="10" fill="#1a0f2e"/>
  <ellipse class="pg-mouth" cx="50" cy="76" rx="7" ry="9" fill="#1a0f2e"/>
  <ellipse cx="26" cy="68" rx="6" ry="3.5" fill="#ff8ac8" opacity="0.45"/>
  <ellipse cx="74" cy="68" rx="6" ry="3.5" fill="#ff8ac8" opacity="0.45"/>
</svg>`;

const MINI_GHOST_SVG = `<svg viewBox="0 0 100 120" width="28" xmlns="http://www.w3.org/2000/svg" class="pg-ghost-svg">
  <path fill="#f3eaff" d="M10 60 C10 25 30 8 50 8 C70 8 90 25 90 60 L90 108 L78 96 L66 110 L54 96 L42 110 L30 96 L18 110 L10 100 Z"/>
  <ellipse class="pg-eye" cx="36" cy="52" rx="7" ry="10" fill="#1a0f2e"/>
  <ellipse class="pg-eye" cx="64" cy="52" rx="7" ry="10" fill="#1a0f2e"/>
  <ellipse class="pg-mouth" cx="50" cy="76" rx="7" ry="9" fill="#1a0f2e"/>
</svg>`;

const CANDY_SVG = `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
  <polygon points="0,4 10,12 0,20" fill="#ff8a1f"/>
  <polygon points="40,4 30,12 40,20" fill="#ff8a1f"/>
  <ellipse cx="20" cy="12" rx="11" ry="9" fill="#a855f7"/>
  <path d="M13 8 Q20 14 27 8" stroke="#f3eaff" stroke-width="2" fill="none"/>
</svg>`;

const PUMPKIN_SVG = `<svg viewBox="0 0 48 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="22" y="2" width="5" height="8" rx="2" fill="#5b8c3a"/>
  <ellipse cx="24" cy="26" rx="21" ry="16" fill="#ff8a1f"/>
  <ellipse cx="14" cy="26" rx="7" ry="15" fill="#e8740f" opacity="0.5"/>
  <ellipse cx="34" cy="26" rx="7" ry="15" fill="#e8740f" opacity="0.5"/>
  <polygon points="14,22 20,22 17,28" fill="#2a1500"/>
  <polygon points="28,22 34,22 31,28" fill="#2a1500"/>
  <path d="M15 33 L19 30 L22 33 L26 30 L29 33 L33 31" stroke="#2a1500" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
</svg>`;

if (typeof globalThis !== "undefined") {
  globalThis.GHOST_SVG = GHOST_SVG;
  globalThis.MINI_GHOST_SVG = MINI_GHOST_SVG;
  globalThis.CANDY_SVG = CANDY_SVG;
  globalThis.PUMPKIN_SVG = PUMPKIN_SVG;
}

if (typeof window !== "undefined") {
  window.GHOST_SVG = GHOST_SVG;
  window.MINI_GHOST_SVG = MINI_GHOST_SVG;
  window.CANDY_SVG = CANDY_SVG;
  window.PUMPKIN_SVG = PUMPKIN_SVG;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GHOST_SVG,
    MINI_GHOST_SVG,
    CANDY_SVG,
    PUMPKIN_SVG,
  };
}
