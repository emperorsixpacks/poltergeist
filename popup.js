// Popup logic: inject the content script and trigger possess / exorcise.

const statusEl = document.getElementById("status");
const avatarEl = document.getElementById("ghost-avatar");

// Render ghost at top of popup
if (avatarEl && typeof GHOST_SVG !== "undefined") {
  avatarEl.innerHTML = GHOST_SVG;
}

function setStatus(msg, isWarning = false) {
  statusEl.textContent = msg || "";
  statusEl.className = isWarning ? "warning" : "";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "pg-ping" });
    if (res && res.pong) return;
  } catch (e) {
    // not injected yet
  }
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["assets.js", "content.js"],
  });
}

document.getElementById("possess").addEventListener("click", async () => {
  setStatus("Summoning...");
  try {
    const tab = await activeTab();
    if (!tab || !tab.id) throw new Error("no active tab");

    // Browser-internal pages (chrome://, edge://, the Web Store, etc.) can't be
    // injected into. Fail fast with a clear message instead of a cryptic error.
    if (tab.url && !/^https?:/i.test(tab.url)) {
      setStatus(
        "Can't haunt this page. Open a real website (http/https) — browser pages like chrome:// are off-limits.",
        true
      );
      return;
    }

    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "pg-possess" });
    window.close();
  } catch (e) {
    setStatus("Haunt failed: " + (e && e.message ? e.message : e), true);
  }
});

document.getElementById("exorcise").addEventListener("click", async () => {
  try {
    const tab = await activeTab();
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "pg-exorcise" });
    }
    setStatus("Page cleansed.");
    setTimeout(() => window.close(), 400);
  } catch (e) {
    setStatus("Nothing to exorcise.", true);
  }
});

document.getElementById("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
