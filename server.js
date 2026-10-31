// Poltergeist proxy — a tiny Render web service.
// Holds the real Groq + ElevenLabs keys server-side and forwards requests, so
// the Chrome extension (and its users) never touch a key directly.
//
// Endpoints:
//   GET  /             health check
//   POST /api/generate  { system, prompt }        -> { text }
//   POST /api/tts       { text }                  -> audio/mpeg bytes
//
// Environment (set in Render):
//   GROQ_API_KEY          required — Groq key for text generation
//   GROQ_MODEL            optional — default openai/gpt-oss-120b
//   ELEVENLABS_API_KEY    optional — enables the voice
//   ELEVENLABS_VOICE_ID   optional — default 21m00Tcm4TlvDq8ikWAM

const http = require("http");

const PORT = process.env.PORT || 10000;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject({ status: 400, message: "invalid JSON body" });
      }
    });
    req.on("error", reject);
  });
}

async function handleGenerate(body) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw { status: 503, message: "GROQ_API_KEY not set on server" };

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: body.system || "" },
        { role: "user", content: body.prompt || "" },
      ],
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    throw { status: 502, message: "Groq upstream HTTP " + resp.status };
  }

  const data = await resp.json();
  const text = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
  if (!text) throw { status: 502, message: "Groq returned empty content" };

  return { text };
}

async function handleTts(body) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (!key) throw { status: 503, message: "ELEVENLABS_API_KEY not set on server" };

  const resp = await fetch(`${ELEVENLABS_URL}/${encodeURIComponent(voice)}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: body.text || "",
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!resp.ok) {
    throw { status: 502, message: "ElevenLabs upstream HTTP " + resp.status };
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get("Content-Type") || "audio/mpeg";
  return { audio: buf, mime };
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    sendJson(res, 200, { ok: true, service: "poltergeist-proxy" });
    return;
  }

  try {
    const body = await readBody(req);

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const out = await handleGenerate(body);
      sendJson(res, 200, out);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tts") {
      const out = await handleTts(body);
      res.writeHead(200, {
        "Content-Type": out.mime,
        "Content-Length": out.audio.length,
      });
      res.end(out.audio);
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    const message = e && e.message ? e.message : "internal error";
    sendJson(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log("poltergeist-proxy listening on port " + PORT);
});
