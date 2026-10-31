// Options page: Groq key + model, ElevenLabs key + voice id, with a voice test.

const modelEl = document.getElementById("model");
const gkeyEl = document.getElementById("gkey");
const keyEl = document.getElementById("key");
const voiceEl = document.getElementById("voice");
const statusEl = document.getElementById("status");
const avatarEl = document.getElementById("header-avatar");

if (avatarEl && typeof GHOST_SVG !== "undefined") {
  avatarEl.innerHTML = GHOST_SVG;
}

function setStatus(msg, ok) {
  statusEl.textContent = msg || "";
  statusEl.className = ok === true ? "ok" : ok === false ? "err" : "";
}

function load() {
  chrome.storage.local.get(
    {
      groqKey: "",
      groqModel: "openai/gpt-oss-120b",
      elevenKey: "",
      voiceId: "",
    },
    (items) => {
      gkeyEl.value = items.groqKey;
      modelEl.value = items.groqModel;
      keyEl.value = items.elevenKey;
      voiceEl.value = items.voiceId;
    }
  );
}

function save() {
  chrome.storage.local.set(
    {
      groqKey: gkeyEl.value.trim(),
      groqModel: modelEl.value.trim() || "openai/gpt-oss-120b",
      elevenKey: keyEl.value.trim(),
      voiceId: voiceEl.value.trim(),
    },
    () => setStatus("Saved settings.", true)
  );
}

document.getElementById("save").addEventListener("click", save);

document.getElementById("test").addEventListener("click", async () => {
  const key = keyEl.value.trim();
  const voice = voiceEl.value.trim();
  if (!key || !voice) {
    setStatus("Enter your ElevenLabs key and voice ID first.", false);
    return;
  }
  // Persist before testing so the background worker uses fresh values.
  chrome.storage.local.set(
    { elevenKey: key, voiceId: voice },
    async () => {
      setStatus("Testing voice...");
      try {
        const res = await new Promise((resolve) =>
          chrome.runtime.sendMessage(
            { type: "speak", text: "Boo! The ghost is awake." },
            resolve
          )
        );
        if (res && res.error) {
          setStatus("Voice error: " + res.error, false);
          return;
        }
        if (res && res.audio && res.audio.base64) {
          play(res.audio.base64, res.audio.mime);
          setStatus("Voice works. Listen for the ghost.", true);
        } else {
          setStatus("No audio returned.", false);
        }
      } catch (e) {
        setStatus("Test failed: " + (e.message || e), false);
      }
    }
  );
});

function play(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime || "audio/mpeg" }));
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play().catch(() => {});
}

load();
