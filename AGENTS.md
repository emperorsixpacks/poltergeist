# AGENTS.md

Chrome MV3 extension ("Poltergeist") + a tiny Render proxy, in **one repo, two runtime targets**. Vanilla JS, no build step, no tests, no linter, no CI.

## Two targets (don't confuse them)

- **Extension** — `manifest.json`, `background.js` (service worker), `content.js`/`content.css` (injected), `popup.html`/`popup.js`, `assets.js`. Loaded **unpacked**; after editing, **Reload** in `brave://extensions` / `chrome://extensions`.
- **Render proxy** — `server.js` + `package.json`. Deploys separately; **auto-deploys on every push to `main`** (web service `poltergeist-proxy`, start command `node server.js`).

## Commands (all verification is manual)

- Syntax check (the only check): `node --check background.js content.js popup.js server.js assets.js`
- Validate manifest: `python3 -c "import json; json.load(open('manifest.json'))"`
- Local proxy smoke test:
  ```bash
  PORT=8791 GROQ_API_KEY=... ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node server.js
  curl localhost:8791/ ; curl -X POST localhost:8791/api/generate -d '{"system":"say boo","prompt":"hi"}' -H 'Content-Type: application/json'
  ```
- Deploy: commit → push to `main`. Render auto-deploys. Manual redeploy only via the Render dashboard/API.

## Architecture / data flow

```
content.js --message--> background.js --fetch--> Render proxy (PROXY_BASE) --+--> Groq (text)
                                                                              +--> ElevenLabs (voice)
```

- `background.js` sends `{system, prompt}` to `POST /api/generate` → `{text}`; `{text}` to `POST /api/tts` → audio/mpeg bytes, which it base64-encodes for `content.js`.
- Model is `openai/gpt-oss-120b` (a **reasoning model**): read only `choices[0].message.content` — there is a separate `reasoning` field you must ignore. The proxy already does this; keep parsing on `.content`.
- Voice model is `eleven_multilingual_v2`; voice selected by `ELEVENLABS_VOICE_ID` env on Render.

## Secrets — never in the extension

All keys live in **Render env vars** only: `GROQ_API_KEY`, `GROQ_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. `background.js`/`content.js` must contain **no keys** (a key was hardcoded once and reverted — do not reintroduce it). There is **no options page**; config is entirely server-side, so don't add a per-user key UI.

`PROXY_BASE` (top of `background.js`) is the single source for the Render URL; it must stay covered by `host_permissions: ["https://*.onrender.com/*"]`. Change both together.

## Content-script conventions

- Injection happens in `popup.js` `ensureInjected()`: `insertCSS(content.css)` then `executeScript(["assets.js", "content.js"])` — **order matters**: `assets.js` defines `GHOST_SVG`/`MINI_GHOST_SVG`/`CANDY_SVG`/`PUMPKIN_SVG` globals that `content.js` reads (with inline fallbacks). Guarded by `window.__poltergeistLoaded`.
- All ghost UI lives in an **open Shadow DOM** rooted at `<div id="poltergeist-root">`. Only page-level effects (flicker `pg-flicker`, dim, headline rewrites `.pg-spooked`, hunt wrappers) touch the host DOM.
- **Reversibility is mandatory**: `exorcise()` runs an undo stack (`registerUndo(fn)`). Any new DOM mutation to the host page must register an undo, and text-node wrapping (`wrapOccurrence`) must skip `#poltergeist-root` and skip `INPUT/TEXTAREA/SELECT/SCRIPT/...`.
- **Caching quirk**: only the `possess` whisper is cached (per-URL in `chrome.storage.local` under `poltergeist:cache:*`). Compliment/fun-fact/headlines/ghost-words are intentionally uncached (`null` cacheKey) so Trick-or-Treat regenerates fresh each click — do not add caching back there.

## Gotchas

- No `tabs` permission, so `tab.url` may be `undefined`; restricted pages (`chrome://`, `brave://`, `edge://`) are detected by matching the **error message**, not the URL. Internal pages can't be injected.
- `server.js` is **zero-dependency** (plain Node `http` + global `fetch`; `package.json` has no `dependencies`, `engines.node >= 18`). Don't add dependencies.
- ElevenLabs **free-tier** keys cannot use library/premade voices via API (HTTP 402); they need a custom voice ID.
- `SUBMISSION.md` is the Hacktoberfest DEV post (prose) — ignore it for engineering tasks.
- `README.md` is the canonical setup/architecture doc; keep it in sync with `manifest.json` and `background.js` when changing endpoints.
