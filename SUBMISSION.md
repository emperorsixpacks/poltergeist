_This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26)_

## What I Built

Poltergeist is a Chrome Manifest V3 extension that literally haunts whatever web page you're on. Click **Possess this page** and a ghost appears, reads the page's title, headings and a ~1,500-character excerpt of visible text, then whispers a short, eerie, funny observation about _that exact page_ in a floating speech bubble — voiced aloud.

It doesn't stop at one trick:

- **Possess** — a ghost whisper about the page's content.
- **Trick or Treat** — a random trick (spooky headline rewrites, a page glitch, a ghost that follows your cursor, a flashlight dim) or treat (candy points, a ghostly compliment, a spooky fun fact).
- **Ghost Hunt** — 5 words are hidden on the page with a subtle ghost hint; catch them all against a 30s timer, with a taunt in the ghost's voice on each catch.
- **Exorcise** — reverts every DOM change and silences the ghost.

Everything is vanilla JS with no build step. The ghost is pure CSS / inline SVG — no image assets.

## Demo

Full 1080p demo walkthrough with ElevenLabs voiceover: [`poltergeist-demo`](https://youtu.be/hetrSxxsRDk) (features the ghost possessing the page, typewriter whispers, headline mutations, screen flicker, flashlight dimming, cursor follower, and ghost hunt mini-game).

## Code

https://github.com/emperorsixpacks/poltergeist

## How I Built It

Open-weight AI is the brain: **gpt-oss-120b** (OpenAI's MIT-licensed open model) served through **Groq**. A system prompt — _"You are a mischievous ghost haunting this web page…"_ — turns the extracted page text into the ghost's lines.

Architecture:

- A tiny **zero-dependency Node service on Render** proxies all AI calls and holds the Groq + ElevenLabs keys server-side. Users install the extension with **zero configuration** — nobody pastes their own key.
- The extension's service worker calls the Render proxy (`/api/generate`, `/api/tts`) and caches the last response per URL.
- A content script renders everything in an isolated **Shadow DOM** (page CSS can't break the ghost, ghost CSS can't leak), keeps an undo stack so Exorcise fully restores the page, and falls back to the browser's `speechSynthesis` if the voice is unavailable.

Privacy matters for a tool that reads the page: form, password and payment fields are excluded from extraction entirely, and ElevenLabs only ever receives the ghost's generated line — never the page content.

## Why Does Open Innovation Matter?

Because the "personality" of this thing — the ghost — is just a model plus a system prompt. Open weights let me swap the brain freely (originally local Ollama, now gpt-oss via Groq) without rewriting anything, run it with no vendor lock-in, and ship it to anyone without asking them to paste an API key. If the model were a black box, the ghost would be stuck in someone's data center behind a subscription. Open means the haunting can be self-hosted, inspected and remixed.

## My Agent Session

<!-- Optional: save your session with DevRelay and embed with the agent_session tag, or link to it -->

## The Spirit of It

It lands the moment the ghost says something only someone who actually read _that page_ would know — it isn't a canned joke, it's a whisper about the thing on your screen right now. That's "ghost in the machine" made literal: an open model reading the page alongside you, just for a second.

## Prize Categories

- Best Use of Render
- Best Use of Gemma
- Best Use of ElevenLabs
