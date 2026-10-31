// Poltergeist content script. Haunts the current page.
(() => {
  if (window.__poltergeistLoaded) return;
  window.__poltergeistLoaded = true;

  // Fallback SVG string constants in case assets.js was not injected prior
  const GHOST =
    typeof GHOST_SVG !== "undefined"
      ? GHOST_SVG
      : (typeof globalThis !== "undefined" && globalThis.GHOST_SVG) ||
        `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" class="pg-ghost-svg">
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

  const MINI_GHOST =
    typeof MINI_GHOST_SVG !== "undefined"
      ? MINI_GHOST_SVG
      : (typeof globalThis !== "undefined" && globalThis.MINI_GHOST_SVG) ||
        `<svg viewBox="0 0 100 120" width="28" xmlns="http://www.w3.org/2000/svg" class="pg-ghost-svg">
  <path fill="#f3eaff" d="M10 60 C10 25 30 8 50 8 C70 8 90 25 90 60 L90 108 L78 96 L66 110 L54 96 L42 110 L30 96 L18 110 L10 100 Z"/>
  <ellipse class="pg-eye" cx="36" cy="52" rx="7" ry="10" fill="#1a0f2e"/>
  <ellipse class="pg-eye" cx="64" cy="52" rx="7" ry="10" fill="#1a0f2e"/>
  <ellipse class="pg-mouth" cx="50" cy="76" rx="7" ry="9" fill="#1a0f2e"/>
</svg>`;

  const CANDY =
    typeof CANDY_SVG !== "undefined"
      ? CANDY_SVG
      : (typeof globalThis !== "undefined" && globalThis.CANDY_SVG) ||
        `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
  <polygon points="0,4 10,12 0,20" fill="#ff8a1f"/>
  <polygon points="40,4 30,12 40,20" fill="#ff8a1f"/>
  <ellipse cx="20" cy="12" rx="11" ry="9" fill="#a855f7"/>
  <path d="M13 8 Q20 14 27 8" stroke="#f3eaff" stroke-width="2" fill="none"/>
</svg>`;

  const PUMPKIN =
    typeof PUMPKIN_SVG !== "undefined"
      ? PUMPKIN_SVG
      : (typeof globalThis !== "undefined" && globalThis.PUMPKIN_SVG) ||
        `<svg viewBox="0 0 48 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="22" y="2" width="5" height="8" rx="2" fill="#5b8c3a"/>
  <ellipse cx="24" cy="26" rx="21" ry="16" fill="#ff8a1f"/>
  <ellipse cx="14" cy="26" rx="7" ry="15" fill="#e8740f" opacity="0.5"/>
  <ellipse cx="34" cy="26" rx="7" ry="15" fill="#e8740f" opacity="0.5"/>
  <polygon points="14,22 20,22 17,28" fill="#2a1500"/>
  <polygon points="28,22 34,22 31,28" fill="#2a1500"/>
  <path d="M15 33 L19 30 L22 33 L26 30 L29 33 L33 31" stroke="#2a1500" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
</svg>`;

  const P = {
    candy: 0,
    possessed: false,
    hunting: false,
    els: {},
    undoStack: [],
    listeners: [],
    timers: [],
    audio: null,
    cursorGhost: null,
    cursorGhostStop: null,
    flashlightStop: null,
  };

  const TAUNTS = [
    "Found me! But I was only warming up.",
    "Ooh, you are good at this.",
    "That tickles. Fine, you caught me.",
    "I was hiding in plain sight.",
  ];

  const originalHeadlines = new WeakMap();
  let typewriterTimer = null;

  // ---------- messaging ----------
  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => resolve(res || {}));
      } catch (e) {
        resolve({ error: "NO_BACKGROUND" });
      }
    });
  }

  // ---------- audio ----------
  function b64ToBlobUrl(b64, mime) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime || "audio/mpeg" }));
  }

  function setTalking(isTalking) {
    const shadow = P.els.shadow;
    if (!shadow) return;
    const ghostEl = shadow.querySelector(".pg-ghost");
    if (!ghostEl) return;
    if (isTalking) {
      ghostEl.classList.add("pg-talking");
    } else {
      ghostEl.classList.remove("pg-talking");
    }
  }

  function stopAudio() {
    if (P.audio) {
      try {
        P.audio.pause();
        P.audio.src = "";
      } catch (e) {}
      P.audio = null;
    }
    try {
      speechSynthesis.cancel();
    } catch (e) {}
    setTalking(false);
  }

  function speechFallback(text, onDone) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 0.7;
      u.onstart = () => setTalking(true);
      u.onend = () => {
        setTalking(false);
        if (onDone) onDone();
      };
      u.onerror = () => {
        setTalking(false);
        if (onDone) onDone();
      };
      speechSynthesis.speak(u);
    } catch (e) {
      setTalking(false);
      if (onDone) onDone();
    }
  }

  function playBase64(b64, mime, onFail, onDone) {
    const url = b64ToBlobUrl(b64, mime);
    const audio = new Audio(url);
    P.audio = audio;
    audio.onplay = () => setTalking(true);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (P.audio === audio) P.audio = null;
      setTalking(false);
      if (onDone) onDone();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (P.audio === audio) P.audio = null;
      setTalking(false);
      if (onFail) onFail();
    };
    audio.play().catch(() => {
      setTalking(false);
      if (onFail) onFail();
    });
  }

  async function speak(text) {
    if (!text) return;
    stopAudio();
    setTalking(true);

    const done = () => setTalking(false);

    try {
      const res = await send({ type: "speak", text });
      if (res && res.audio && res.audio.base64) {
        playBase64(
          res.audio.base64,
          res.audio.mime,
          () => speechFallback(text, done),
          done
        );
        return;
      }
    } catch (e) {}
    speechFallback(text, done);
  }

  // ---------- extraction ----------
  function extractContent() {
    const title = document.title || "";
    const headings = [];
    document.querySelectorAll("h1, h2").forEach((h) => {
      const t = (h.innerText || "").trim();
      if (t && headings.length < 5) headings.push(t);
    });
    return { title, headings, text: extractVisibleText() };
  }

  function extractVisibleText() {
    const skipSel =
      "INPUT, TEXTAREA, SELECT, SCRIPT, STYLE, NOSCRIPT, IFRAME, SVG, CANVAS, IMG, VIDEO, AUDIO, HEADER, NAV, FOOTER";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || p.id === "poltergeist-root" || p.closest("#poltergeist-root") || p.closest(skipSel))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const out = [];
    let count = 0;
    let node;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue.trim();
      if (!t) continue;
      out.push(t);
      count += t.length;
      if (count > 1600) break;
    }
    return out.join(" ").slice(0, 1500);
  }

  // ---------- Shadow DOM root ----------
  function getOrCreateRoot() {
    if (P.els.shadow && P.els.host && document.contains(P.els.host)) {
      return P.els.shadow;
    }

    let host = document.getElementById("poltergeist-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "poltergeist-root";
      host.style.position = "fixed";
      host.style.top = "0";
      host.style.left = "0";
      host.style.width = "0";
      host.style.height = "0";
      host.style.zIndex = "2147483647";
      host.style.pointerEvents = "none";
      host.style.overflow = "visible";
      document.documentElement.appendChild(host);
    }

    let shadow = host.shadowRoot;
    if (!shadow) {
      shadow = host.attachShadow({ mode: "open" });
    }

    // Attach stylesheet inside shadow root
    if (!shadow.querySelector("link[data-pg-style]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("content.css");
      link.setAttribute("data-pg-style", "true");
      shadow.appendChild(link);

      // Also inline style block for instantaneous render without waiting for link
      fetch(chrome.runtime.getURL("content.css"))
        .then((r) => r.text())
        .then((css) => {
          if (!shadow.querySelector("style[data-pg-style]")) {
            const style = document.createElement("style");
            style.setAttribute("data-pg-style", "true");
            style.textContent = css;
            shadow.appendChild(style);
          }
        })
        .catch(() => {});
    }

    P.els.host = host;
    P.els.shadow = shadow;
    return shadow;
  }

  function removeEl(key) {
    if (P.els[key]) {
      try {
        P.els[key].remove();
      } catch (e) {}
      delete P.els[key];
    }
  }

  // ---------- Speech bubble & typewriter ----------
  function showBubble(text, kind) {
    const shadow = getOrCreateRoot();
    removeEl("bubble");

    let container = shadow.querySelector(".pg-bubble-container");
    if (!container) {
      if (P.els.widget) {
        container = document.createElement("div");
        container.className = "pg-bubble-container";
        P.els.widget.insertBefore(container, P.els.widget.firstChild);
      } else {
        container = shadow;
      }
    }

    const b = document.createElement("div");
    b.className = "pg-bubble" + (kind === "error" ? " pg-error" : "");

    const close = document.createElement("button");
    close.className = "pg-close";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Close");
    close.onclick = (e) => {
      e.stopPropagation();
      removeEl("bubble");
    };
    b.appendChild(close);

    const body = document.createElement("div");
    body.className = "pg-bubble-text";
    b.appendChild(body);

    container.appendChild(b);
    P.els.bubble = b;

    if (kind === "error") {
      body.innerHTML = text;
      return body;
    }

    // Typewriter effect: reveal bubble text char by char at ~25ms per char while audio plays
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      body.textContent = text;
      return body;
    }

    let charIndex = 0;
    body.textContent = "";
    typewriterTimer = setInterval(() => {
      charIndex++;
      body.textContent = text.slice(0, charIndex);
      if (charIndex >= text.length) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
      }
    }, 25);
    P.timers.push(() => {
      if (typewriterTimer) clearInterval(typewriterTimer);
    });

    return body;
  }

  function appendHint(text) {
    if (!P.els.bubble) return;
    const hint = document.createElement("div");
    hint.className = "pg-hint";
    hint.textContent = text;
    P.els.bubble.appendChild(hint);
  }

  // ---------- HUD ----------
  function showHud() {
    const shadow = getOrCreateRoot();
    removeEl("hud");

    const hud = document.createElement("div");
    hud.className = "pg-hud";
    hud.innerHTML = `
      <div class="pg-hud-item pg-hud-candy-item">
        ${CANDY}
        <span class="pg-candy">0</span>
      </div>
      <div class="pg-hud-item pg-hud-hunt-item" style="display: none; align-items: center; gap: 8px;">
        <span class="pg-hunt-timer">30s</span>
        <button class="pg-btn pg-hint-btn" style="padding: 3px 10px; font-size: 11px;">Hint</button>
      </div>
    `;

    shadow.appendChild(hud);
    P.els.hud = hud;
    updateHud();
  }

  function updateHud() {
    if (P.els.hud) {
      const c = P.els.hud.querySelector(".pg-candy");
      if (c) c.textContent = P.candy;
    }
  }

  function addCandy(n) {
    P.candy += n;
    updateHud();
    if (P.els.hud) {
      const c = P.els.hud.querySelector(".pg-candy");
      if (c) {
        c.classList.remove("pg-bump");
        void c.offsetWidth;
        c.classList.add("pg-bump");
      }
    }
  }

  // ---------- Widget ----------
  function showWidget() {
    const shadow = getOrCreateRoot();
    removeEl("widget");

    const w = document.createElement("div");
    w.className = "pg-widget";
    w.innerHTML = `
      <div class="pg-bubble-container"></div>
      <div class="pg-ghost" role="button" aria-label="Ghost">
        ${GHOST}
      </div>
      <div class="pg-actions">
        <button class="pg-btn pg-btn-primary pg-trick" title="Trick or Treat">
          ${PUMPKIN}
          <span>Trick or Treat</span>
        </button>
        <button class="pg-btn pg-hunt" title="Ghost Hunt">
          <span>Ghost Hunt</span>
        </button>
        <button class="pg-btn pg-exorcise" title="Exorcise">
          <span>Exorcise</span>
        </button>
      </div>
    `;

    shadow.appendChild(w);
    P.els.widget = w;

    const ghostEl = w.querySelector(".pg-ghost");
    ghostEl.addEventListener("click", () => {
      speak("Boo! Care for a trick or a treat?");
    });

    w.querySelector(".pg-trick").onclick = trickOrTreat;
    w.querySelector(".pg-hunt").onclick = ghostHunt;
    w.querySelector(".pg-exorcise").onclick = exorcise;
  }

  // ---------- undo + cleanup ----------
  function registerUndo(fn) {
    P.undoStack.push(fn);
  }

  function addListener(target, type, fn) {
    target.addEventListener(type, fn);
    P.listeners.push({ target, type, fn });
  }

  function clearTimers() {
    P.timers.forEach((t) => {
      if (typeof t === "function") {
        try { t(); } catch (e) {}
      } else {
        clearTimeout(t);
      }
    });
    P.timers = [];
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    P.timers.push(id);
    return id;
  }

  // ---------- FEATURE 1: POSSESS ----------
  async function possess() {
    if (P.possessed) return;
    const { title, headings, text } = extractContent();
    const res = await send({
      type: "possess",
      url: location.href,
      title,
      headings,
      text,
    });

    if (res.error) {
      showGemmaError(res.error);
      return;
    }

    P.possessed = true;
    showHud();
    showWidget();

    showBubble(res.whisper, "whisper");
    if (res.audio && res.audio.base64) {
      playBase64(
        res.audio.base64,
        res.audio.mime,
        () => speechFallback(res.whisper)
      );
    } else {
      speechFallback(res.whisper);
    }

    if (res.voiceError) {
      appendHint(
        "Using browser voice \u2014 the ElevenLabs voice is unavailable (check the proxy's ELEVENLABS_API_KEY)."
      );
    }
  }

  function showGemmaError(code) {
    let msg;
    if (code === "PROXY_UNREACHABLE") {
      msg =
        "The ghost can't reach its proxy on Render. Is the service deployed, and is the URL in <code>background.js</code> correct?";
    } else if (code === "PROXY_EMPTY") {
      msg = "The ghost's brain returned nothing. Try again in a moment.";
    } else {
      msg =
        "The ghost's brain errored (<code>" +
        code +
        "</code>). Check that the Render proxy is running and its <code>GROQ_API_KEY</code> is set.";
    }
    showBubble(msg, "error");
  }

  // ---------- FEATURE 2: TRICK OR TREAT ----------
  async function trickOrTreat() {
    const treat = Math.random() < 0.5;
    if (treat) {
      const r = Math.floor(Math.random() * 3);
      if (r === 0) {
        const n = 1 + Math.floor(Math.random() * 3);
        addCandy(n);
        await speak("A treat! You earned " + n + " candy.");
      } else if (r === 1) {
        await complimentTreat();
      } else {
        await funFactTreat();
      }
    } else {
      const r = Math.floor(Math.random() * 4);
      if (r === 0) await headlineTrick();
      else if (r === 1) flickerTrick();
      else if (r === 2) cursorGhostTrick();
      else flashlightTrick();
    }
  }

  async function complimentTreat() {
    const { text } = extractContent();
    const res = await send({ type: "compliment", url: location.href, text });
    const line = res && res.text ? res.text : "This page is positively boo-tiful.";
    showBubble(line, "whisper");
    await speak(line);
  }

  async function funFactTreat() {
    const { text } = extractContent();
    const res = await send({ type: "funfact", url: location.href, text });
    const line =
      res && res.text
        ? res.text
        : "Fun fact: ghosts are allergic to sunlight and to closing your tab.";
    showBubble(line, "whisper");
    await speak(line);
  }

  // Spooky headline swap: adds class pg-spooked, stores in WeakMap, Exorcise restores
  async function headlineTrick() {
    const els = [...document.querySelectorAll("h1, h2, h3")].filter(
      (h) => (h.innerText || "").trim().length > 3
    );
    if (els.length === 0) {
      flickerTrick();
      return;
    }
    const targets = els.slice(0, 3);
    const res = await send({
      type: "headlines",
      url: location.href,
      headlines: targets.map((h) => h.innerText.trim()),
    });
    if (!res || !res.versions || res.versions.length !== targets.length) {
      flickerTrick();
      return;
    }
    targets.forEach((h, i) => {
      if (!originalHeadlines.has(h)) {
        originalHeadlines.set(h, h.innerText);
      }
      h.innerText = res.versions[i];
      h.classList.add("pg-spooked");
      registerUndo(() => {
        if (originalHeadlines.has(h)) {
          h.innerText = originalHeadlines.get(h);
        }
        h.classList.remove("pg-spooked");
      });
    });
    await speak("Your headlines are mine now. Heh heh.");
  }

  // Flicker trick: html.pg-flicker body
  function flickerTrick() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      speak("Boo!");
      return;
    }
    document.documentElement.classList.add("pg-flicker");
    registerUndo(() => document.documentElement.classList.remove("pg-flicker"));
    later(() => document.documentElement.classList.remove("pg-flicker"), 4000);
    speak("Boo!");
  }

  // Cursor follower ghost: MINI_GHOST_SVG, lerp toward cursor with 0.12 easing, horizontal flip
  function cursorGhostTrick() {
    stopCursorGhost();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      speak("I am right behind you.");
      return;
    }

    const shadow = getOrCreateRoot();
    const g = document.createElement("div");
    g.className = "pg-cursor-ghost";
    g.innerHTML = MINI_GHOST;
    shadow.appendChild(g);
    P.cursorGhost = g;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;
    let facingRight = true;
    let rafId = null;

    const move = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    addListener(window, "mousemove", move);

    const loop = () => {
      const dx = mouseX - currentX;
      const dy = mouseY - currentY;
      currentX += dx * 0.12;
      currentY += dy * 0.12;

      if (Math.abs(dx) > 0.5) {
        facingRight = dx >= 0;
      }
      const scaleX = facingRight ? 1 : -1;
      g.style.transform = `translate3d(${currentX - 14}px, ${currentY - 16}px, 0) scaleX(${scaleX})`;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    P.cursorGhostStop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", move);
      if (g.parentNode) g.remove();
      P.cursorGhost = null;
      P.cursorGhostStop = null;
    };

    registerUndo(() => stopCursorGhost());
    speak("I am right behind you.");
    later(() => stopCursorGhost(), 10000);
  }

  function stopCursorGhost() {
    if (P.cursorGhostStop) {
      P.cursorGhostStop();
    } else if (P.cursorGhost) {
      try {
        P.cursorGhost.remove();
      } catch (e) {}
      P.cursorGhost = null;
    }
  }

  // Flashlight / Dim trick: html.pg-dim::before, updating --pg-x and --pg-y on mousemove via RAF
  function flashlightTrick() {
    stopFlashlight();
    document.documentElement.classList.add("pg-dim");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dimRaf = null;

    document.documentElement.style.setProperty("--pg-x", mouseX + "px");
    document.documentElement.style.setProperty("--pg-y", mouseY + "px");

    const move = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!dimRaf) {
        dimRaf = requestAnimationFrame(() => {
          document.documentElement.style.setProperty("--pg-x", mouseX + "px");
          document.documentElement.style.setProperty("--pg-y", mouseY + "px");
          dimRaf = null;
        });
      }
    };

    addListener(window, "mousemove", move);

    P.flashlightStop = () => {
      if (dimRaf) cancelAnimationFrame(dimRaf);
      window.removeEventListener("mousemove", move);
      document.documentElement.classList.remove("pg-dim");
      document.documentElement.style.removeProperty("--pg-x");
      document.documentElement.style.removeProperty("--pg-y");
      P.flashlightStop = null;
    };

    registerUndo(() => stopFlashlight());
    speak("The lights are going out...");
    later(() => stopFlashlight(), 8000);
  }

  function stopFlashlight() {
    if (P.flashlightStop) {
      P.flashlightStop();
    } else {
      document.documentElement.classList.remove("pg-dim");
      document.documentElement.style.removeProperty("--pg-x");
      document.documentElement.style.removeProperty("--pg-y");
    }
  }

  // ---------- FEATURE 3: GHOST HUNT ----------
  async function ghostHunt() {
    if (P.hunting) return;
    P.hunting = true;

    const { text } = extractContent();
    let words = [];
    const res = await send({ type: "ghostwords", url: location.href, text });
    if (res && Array.isArray(res.words) && res.words.length) {
      words = res.words.filter((w) => typeof w === "string" && w.trim());
    }
    if (!words.length) words = pickLongWords(text, 5);
    words = words.slice(0, 5);

    const huntItems = [];
    for (const word of words) {
      const item = wrapOccurrence(word);
      if (item) huntItems.push(item);
    }
    if (!huntItems.length) {
      P.hunting = false;
      showBubble("The ghost couldn't find a hiding place here.", "whisper");
      return;
    }

    let caught = 0;
    let won = false;

    // Show hunt controls in HUD
    let huntItemEl = null;
    let timerSpan = null;
    let hintBtn = null;
    if (P.els.hud) {
      huntItemEl = P.els.hud.querySelector(".pg-hud-hunt-item");
      if (huntItemEl) {
        huntItemEl.style.display = "flex";
        timerSpan = huntItemEl.querySelector(".pg-hunt-timer");
        hintBtn = huntItemEl.querySelector(".pg-hint-btn");
      }
    }

    let remaining = 30;
    if (timerSpan) timerSpan.textContent = "Hunt: " + remaining + "s";

    const tick = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(tick);
        endHunt();
        if (!won) showBubble("Time's up! The ghosts got away...", "whisper");
      } else {
        if (timerSpan) timerSpan.textContent = "Hunt: " + remaining + "s";
      }
    }, 1000);
    P.timers.push(() => clearInterval(tick));

    // Hint button: pulses one uncaught ghost to opacity 1 for 1.5s
    const triggerHint = () => {
      const uncaught = huntItems
        .map((i) => i.ghost)
        .filter((g) => g && !g.classList.contains("pg-caught"));
      if (!uncaught.length) return;
      const target = uncaught[Math.floor(Math.random() * uncaught.length)];
      target.classList.add("pg-hinting");
      setTimeout(() => {
        if (target) target.classList.remove("pg-hinting");
      }, 1500);
    };

    if (hintBtn) {
      hintBtn.onclick = (e) => {
        e.stopPropagation();
        triggerHint();
      };
    }

    function catchGhost(ghostEl, spanEl) {
      if (ghostEl.classList.contains("pg-caught")) return;
      ghostEl.classList.add("pg-caught");
      caught++;
      speak(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
      if (caught >= huntItems.length) {
        won = true;
        endHunt();
        addCandy(1);
        showBubble("You caught all the ghosts! +1 candy.", "whisper");
        speak("You caught every last one of us. Bravo.");
      }
    }

    function endHunt() {
      clearInterval(tick);
      if (huntItemEl) huntItemEl.style.display = "none";
      huntItems.forEach(({ ghost, span }) => {
        if (ghost) ghost.onclick = null;
        if (span) span.onclick = null;
      });
      P.hunting = false;
    }

    huntItems.forEach(({ ghost, span }) => {
      ghost.onclick = (e) => {
        e.stopPropagation();
        catchGhost(ghost, span);
      };
      span.onclick = (e) => {
        e.stopPropagation();
        catchGhost(ghost, span);
      };
    });

    speak("Five of us are hiding on this page. Find us!");
  }

  function wrapOccurrence(word) {
    const lower = word.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || p.id === "poltergeist-root" || p.closest("#poltergeist-root"))
          return NodeFilter.FILTER_REJECT;
        if (p.closest("SCRIPT, STYLE, NOSCRIPT, INPUT, TEXTAREA, SELECT"))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const val = node.nodeValue || "";
      const idx = val.toLowerCase().indexOf(lower);
      if (idx === -1) continue;
      const isBoundary = (i) => !val[i] || /\W/.test(val[i]);
      if (!isBoundary(idx - 1) || !isBoundary(idx + lower.length)) continue;

      const match = val.slice(idx, idx + lower.length);
      const span = document.createElement("span");
      span.className = "pg-hunt-word";
      span.textContent = match;

      const ghost = document.createElement("span");
      ghost.className = "pg-hunt-ghost";
      ghost.title = "Boo!";
      ghost.innerHTML = MINI_GHOST;
      span.appendChild(ghost);

      const parent = node.parentNode;
      parent.insertBefore(document.createTextNode(val.slice(0, idx)), node);
      parent.insertBefore(span, node);
      parent.insertBefore(document.createTextNode(val.slice(idx + lower.length)), node);
      parent.removeChild(node);

      registerUndo(() => {
        if (span.parentNode) {
          span.parentNode.replaceChild(document.createTextNode(match), span);
        }
      });
      return { span, ghost };
    }
    return null;
  }

  function pickLongWords(text, count) {
    const words = (text || "")
      .split(/\s+/)
      .map((w) => w.replace(/[^\w'-]/g, ""))
      .filter((w) => w.length >= 6 && /[a-zA-Z]/.test(w));
    const uniq = [...new Set(words)];
    const out = [];
    while (out.length < count && uniq.length) {
      const i = Math.floor(Math.random() * uniq.length);
      out.push(uniq.splice(i, 1)[0]);
    }
    return out;
  }

  // ---------- FEATURE 4: EXORCISE ----------
  function exorcise() {
    stopAudio();
    clearTimers();
    while (P.undoStack.length) {
      try {
        P.undoStack.pop()();
      } catch (e) {}
    }
    stopCursorGhost();
    stopFlashlight();

    // Clean up HTML-level effect classes
    document.documentElement.classList.remove("pg-flicker", "pg-dim");
    document.documentElement.style.removeProperty("--pg-x");
    document.documentElement.style.removeProperty("--pg-y");
    document.body.classList.remove("pg-flicker");

    // Restore any swapped headlines from WeakMap
    document.querySelectorAll(".pg-spooked").forEach((el) => {
      if (originalHeadlines.has(el)) {
        el.innerText = originalHeadlines.get(el);
      }
      el.classList.remove("pg-spooked");
    });

    // Remove any remaining ghost hunt wrappers
    document.querySelectorAll(".pg-hunt-word").forEach((span) => {
      const ghost = span.querySelector(".pg-hunt-ghost");
      if (ghost) ghost.remove();
      const text = span.textContent;
      if (span.parentNode) {
        span.parentNode.replaceChild(document.createTextNode(text), span);
      }
    });

    P.listeners.forEach(({ target, type, fn }) => {
      try {
        target.removeEventListener(type, fn);
      } catch (e) {}
    });
    P.listeners = [];

    // Remove Shadow DOM host
    const host = document.getElementById("poltergeist-root");
    if (host) {
      try {
        host.remove();
      } catch (e) {}
    }

    P.els = {};
    P.candy = 0;
    P.possessed = false;
    P.hunting = false;
  }

  // ---------- messages from popup ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "pg-ping") {
      sendResponse({ pong: true });
    } else if (msg.type === "pg-possess") {
      possess().then(() => sendResponse({ ok: true }));
      return true;
    } else if (msg.type === "pg-exorcise") {
      exorcise();
      sendResponse({ ok: true });
    }
  });
})();
