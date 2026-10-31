// Poltergeist background service worker.
// Responsibilities:
//  - Talk to the Poltergeist proxy on Render for all ghost text (Groq) + voice
//    (ElevenLabs). The proxy holds the API keys server-side, so neither the
//    extension nor its users ever handle a key.
//  - Cache the last generated response per URL so repeat haunts are fast.
//
// Page text goes to the proxy (which forwards it to Groq). ElevenLabs only ever
// receives the ghost's own generated line, never page content.

// FILL IN after deploying: your Render service URL (no trailing slash).
const PROXY_BASE = "https://poltergeist-proxy.onrender.com";

const SYSTEM_PROMPTS = {
  whisper:
    "You are a mischievous ghost haunting this web page. Write ONE short, eerie, funny whisper (max 25 words) about this specific page's content. No emojis.",
  headlines:
    "You are a mischievous ghost. Rewrite each headline below into a short, spooky version. Respond with ONLY a JSON array of strings, one per headline, same order. No markdown, no commentary.",
  compliment:
    "You are a mischievous but friendly ghost. Write ONE short spooky compliment (max 25 words) about the web page content given. No emojis.",
  funFact:
    "You are a mischievous ghost. Give ONE short, spooky fun fact (max 30 words) related to the web page content given. No emojis.",
  ghostWords:
    "You are a mischievous ghost. Pick 5 distinctive words that appear on this web page that would be fun to hide in. Respond with ONLY a JSON array of 5 lowercase single words that literally appear in the text. No markdown, no commentary.",
};

// Cache helpers -----------------------------------------------------------

async function cacheGet(key) {
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function cacheSet(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// Text generation via the Render proxy (Groq behind it).
async function gemma(system, prompt, cacheKey, temperature) {
  if (cacheKey) {
    const cached = await cacheGet("poltergeist:cache:" + cacheKey);
    if (cached) return cached;
  }

  let resp;
  try {
    resp = await fetch(PROXY_BASE + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        prompt,
        temperature: typeof temperature === "number" ? temperature : 0.7,
      }),
    });
  } catch (e) {
    throw new Error("PROXY_UNREACHABLE");
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error("PROXY_" + resp.status + " " + (data.error || ""));
  }

  const text = (data.text || "").trim();
  if (!text) throw new Error("PROXY_EMPTY");

  if (cacheKey) await cacheSet("poltergeist:cache:" + cacheKey, text);
  return text;
}

// Voice via the Render proxy (ElevenLabs behind it). Returns base64 + mime.
async function tts(text) {
  let resp;
  try {
    resp = await fetch(PROXY_BASE + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    throw new Error("PROXY_UNREACHABLE");
  }

  if (!resp.ok) {
    let msg = "HTTP " + resp.status;
    try {
      const d = await resp.json();
      if (d && d.error) msg = d.error;
    } catch (e) {}
    throw new Error("PROXY_TTS_" + resp.status + " " + msg);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return {
    base64: btoa(binary),
    mime: resp.headers.get("Content-Type") || "audio/mpeg",
  };
}

// Robust JSON array parsing: strips code fences, extracts first [ ... ].
function parseJsonArray(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr;
  } catch (e) {
    /* fall through */
  }
  return null;
}

function pickLongWords(text, count) {
  const words = (text || "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\w'-]/g, ""))
    .filter((w) => w.length >= 6 && /[a-zA-Z]/.test(w));
  if (!words.length) return [];
  const uniq = [...new Set(words)];
  const out = [];
  while (out.length < count && uniq.length) {
    const i = Math.floor(Math.random() * uniq.length);
    out.push(uniq.splice(i, 1)[0]);
  }
  return out;
}

// Message handlers --------------------------------------------------------

async function handlePossess(msg) {
  const text = (msg.text || "").slice(0, 2000);
  const prompt =
    `Page title: ${msg.title || ""}\n` +
    `Headings: ${(msg.headings || []).slice(0, 3).join(" | ")}\n` +
    `Excerpt:\n${text}`;

  const whisper = await gemma(SYSTEM_PROMPTS.whisper, prompt, "whisper:" + msg.url);

  let audio = null;
  let voiceError = null;
  try {
    audio = await tts(whisper);
  } catch (e) {
    // Fallback handled by content script via speechSynthesis.
    voiceError = e.message;
    audio = null;
  }

  return { whisper, audio, voiceError };
}

async function handleHeadlines(msg) {
  const prompt = (msg.headlines || []).join("\n");
  const raw = await gemma(SYSTEM_PROMPTS.headlines, prompt, null, 0.9);
  const arr = parseJsonArray(raw);
  if (!arr) return { versions: null };
  return { versions: arr };
}

async function handleCompliment(msg) {
  const text = await gemma(
    SYSTEM_PROMPTS.compliment,
    "Page content excerpt:\n" + (msg.text || "").slice(0, 2000),
    null,
    1.0
  );
  return { text };
}

async function handleFunFact(msg) {
  const text = await gemma(
    SYSTEM_PROMPTS.funFact,
    "Page content excerpt:\n" + (msg.text || "").slice(0, 2000),
    null,
    1.0
  );
  return { text };
}

async function handleGhostWords(msg) {
  const raw = await gemma(
    SYSTEM_PROMPTS.ghostWords,
    "Page content excerpt:\n" + (msg.text || "").slice(0, 3000),
    null,
    0.7
  );
  const arr = parseJsonArray(raw);
  if (arr) return { words: arr };
  const fallback = pickLongWords(msg.text || "", 5);
  return { words: fallback };
}

async function handleSpeak(msg) {
  const audio = await tts(msg.text || "");
  return { audio };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const run = async () => {
    try {
      switch (msg.type) {
        case "possess":
          return await handlePossess(msg);
        case "headlines":
          return await handleHeadlines(msg);
        case "compliment":
          return await handleCompliment(msg);
        case "funfact":
          return await handleFunFact(msg);
        case "ghostwords":
          return await handleGhostWords(msg);
        case "speak":
          return await handleSpeak(msg);
        default:
          throw new Error("UNKNOWN_TYPE");
      }
    } catch (e) {
      return { error: e.message || String(e) };
    }
  };

  run().then(sendResponse);
  return true; // keep the message channel open for async sendResponse
});
