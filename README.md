# 🔥 Extinction Atlas — Frontend

**NASA Space Apps Challenge 2026 · Flame in Freefall** | React · TypeScript · Vite · three.js · WebGL2 · Recharts · Cloudflare Workers

> An atlas of what NASA has already burned in microgravity — and of what it hasn't.

> [!IMPORTANT]
> **This project has two repositories, and this frontend does not work on its own.**
>
> | Repository | Role |
> |---|---|
> | **[atlas-fire-extintion-front](https://github.com/stars-beyond/atlas-fire-extintion-front)** (this one) | Interface: React app, 3D stage and flame lab. Renders only |
> | **[atlas-fire-extintion-backend](https://github.com/stars-beyond/atlas-fire-extintion-backend)** | Main backend: database, PSI ingestion, embeddings, RAG, models and the Go API that does every calculation |
>
> Every screen reads its data from the backend API. To run the project locally, start the backend first
> (see [Running locally](#running-locally-backend--frontend-step-by-step)). The live site uses the production API at <https://api.atlas-stars-beyond.tech>.

This is the **interface** of the Extinction Atlas. It only renders: every calculation (verdict, ranking, predictions,
flammability limits, chart-builder data, CSV) is done by the Go API in
[`atlas-fire-extintion-backend`](https://github.com/stars-beyond/atlas-fire-extintion-backend). It is published on
**Cloudflare Workers & Pages** as a static site.

## 🌠 Overview

The Atlas reads NASA's PSI combustion collection, places every test on a map of **oxygen × pressure × gravity**, and
answers one question for any crewed environment: **what experimental evidence exists for this scenario?**

The interface works like a **car configurator with a test drive**: a large stage shows the scenario, the side panel
offers one choice at a time, and the bottom bar summarizes what has been built.

Users can:

🏠 Pick a habitat (station, lunar base, rover, Mars, suit, room on Earth) or tune oxygen, pressure and gravity by hand

✍️ Describe the environment in their own words ("lunar rover with 34% oxygen and Nomex seats") and jump straight to the test drive

🔥 Light the flame and reveal the evidence level, the closest NASA tests and where each data point came from

💬 Ask questions in natural language and get answers with sources and rendered formulas

📊 Build their own charts over 15 NASA datasets and click any point back to the original table row

## 🛰️ Features

✨ **Configurator flow** — Four steps: Habitat → Material → Test drive → Spec sheet.
🧪 **Test drive** — Three tabs: **Evidence** (verdict and closest tests), **Extinguish** (CO₂ or helium, with the FLEX
model estimate) and **Ask** (natural language, answer with sources, streamed).
🔥 **3D flame lab (lab3d)** — The team's combustion solver running on the GPU (WebGL2) inside an iframe. It receives
the scenario and reports whether the flame is lit and how much heat it releases.
🏢 **Test map** — A 3D building where each point is a test and each floor is a gravity level. The Moon and Mars floors
are empty.
🕸️ **Graph** — The scenario at the centre, the six most similar tests around it and what they have in common.
📄 **Spec sheet** — Scenario, evidence, who studied it, what is left to test. Copy as Markdown or print.
📊 **Findings & chart builder** — Five computed findings and a chart builder (scatter, grouped bars, histogram) with
CSV/PNG export.
🗂️ **Investigations** — Ranking of the 24 investigations for the scenario, with side-by-side comparison.
🚀 **Mission Story** — A simulated mission narrated chapter by chapter in 3D, driven by the Mission Fire Engine.
☁️ **Static deploy** — Built with Vite and served by Cloudflare Workers & Pages.

## 🧭 How It Works

**Configure the scenario**
→ Habitat and material (or a free sentence, turned into a scenario by `POST /api/scenario/infer`) become one scenario —
O₂, pressure, gravity, fuel family and material — shared by every screen.

**Ask the API for the verdict**
→ The verdict, neighbouring tests, ranking and graph all come from the backend (`/api/verdict`, `/api/rank`,
`/api/graph`…). The frontend never computes the evidence level.

**Render the stage**
→ The stage switches between the **flame** (lab3d), the **test map** and the **graph**. lab3d gets its physical
parameters (materials, gases, constants) from `/api/sim/config`. For silicone, liquid fuel and gas — not yet in the
simulator — and in browsers without WebGL2, the stage shows an illustrated flame.

**Ask & explore**
→ Questions go to `/api/ask/stream` (Server-Sent Events): the verdict arrives first, then the text while it is being
written. Charts and CSV come from `/api/datasets/*`.

## 🔬 Core Components

| Component | Description |
|---|---|
| `src/features/configurator` | Habitat, Material, Test drive (Evidence and Extinguish tabs) and Spec sheet; spread speed (`/api/predict/spread`) and non-NASA (ZARM) evidence |
| `src/features/stage` | Stage orchestration: habitat scene, lab3d, test map, graph, limits and the thermal camera (`/api/predict/thermal`) |
| `src/features/ask` | Ask tab, streamed answer, Markdown with formulas (KaTeX) |
| `src/features/findings` | Findings, chart builder, audit |
| `src/features/investigations` | Investigation records and comparison |
| `src/features/next-fire` | "Next fire": the tests that would close the most gaps |
| `src/features/dashboard` | Scientific Intelligence Dashboard (Findings, Investigations and Next fire on one screen) |
| `src/features/story` | Mission Story: Mission Fire Engine missions, 3D route scene and chapters |
| `src/three` | 3D scene (three.js): engine, parts, models, test map |
| `public/lab3d` | 3D flame lab (iframe); receives the app's configuration via `postMessage` (`atlas:config`) |

# Requirements & Startup

## Repository layout (quick map)

```
src/
├─ main.tsx            entry point
├─ app/                App (screen switching) and layout/ (Header, SpecBar)
├─ api/                client (API_BASE from VITE_API_URL or /api), stream (SSE) and one module per domain;
│                      index.ts groups everything into the `api` object
├─ types/              API response types, per domain
├─ state/              AtlasProvider (context and useAtlas), materials, lab3d state (useLab)
├─ features/           configurator, stage, ask, findings, investigations, next-fire, dashboard, story, home
├─ three/              3D scene (three.js)
├─ components/         pieces used by more than one feature (Seal, Gaps, ErrorBoundary…)
├─ lib/                formatting (en-US), download, safe links, GPU detection (light mode), collapsible panels
└─ styles/             tokens, base and one stylesheet per area
```

| Outside `src/` | What it is |
|---|---|
| `public/lab3d/` | 3D flame lab (solver + renderer, linked to the Atlas by `bridge.js`) |
| `public/models/`, `public/draco/` | 3D habitat models and the Draco decoder |
| `public/story/` | Mission Story fallback missions, computed by the Mission Fire Engine |
| `scripts/story-snapshots.py` | Regenerates `public/story/` by running the engine |
| `public/_headers` | Cache and security headers for static files |
| `wrangler.jsonc` | Cloudflare configuration (assets only) |

## Requirements

### System

* Node.js 22.13+ (`.node-version`: 22)
* The backend API running locally on port 8787 — or point the dev server at the production API (see below)
* A browser with WebGL2 for the 3D flame lab (without it, an illustrated flame is shown)

### Environment variables

```
VITE_API_URL=
```

* Empty (default) → in `npm run dev`, `/api` is proxied by Vite to `http://localhost:8787`.
* Set (e.g. in `.env.local`) → the app calls that API directly, without the proxy.

`ATLAS_API` changes the proxy target of the dev server instead.

## Running locally (backend + frontend, step by step)

Two repositories, two terminals. Start the backend **first**: without it every screen shows an API error.

```
~/…/atlas-fire-extintion-backend   →  Docker: db :54329, api :8787
~/…/atlas-fire-extintion-front     →  Vite :5173, proxies /api → http://localhost:8787
```

### 0) Prerequisites

* Node.js 22.13+ (`node -v`; with nvm: `nvm use 22`)
* Docker Desktop **running**, for the backend
* Both repositories cloned side by side (same parent folder)
* Free ports: `5173` (frontend), `8787` (API), `54329` (Postgres)

### 1) Backend (terminal 1, in `atlas-fire-extintion-backend/`)

```bash
cp .env.example .env              # AI keys are optional
docker compose up --build -d
docker compose logs -f ingest     # first run: wait a few minutes until the ingestion finishes
curl http://localhost:8787/api/health
```

The API only starts after the ingestion finishes. Details and troubleshooting are in the
[backend README](https://github.com/stars-beyond/atlas-fire-extintion-backend#running-locally-backend--frontend-step-by-step).

### 2) Frontend (terminal 2, in `atlas-fire-extintion-front/`)

```bash
npm install
npm run dev                       # http://localhost:5173
```

Leave `VITE_API_URL` empty (no `.env.local`): the app calls `/api` and Vite forwards it to `http://localhost:8787`,
so there is no CORS involved. Check the path through the proxy at <http://localhost:5173/api/health>.

### Other ways to run the frontend

| Goal | Command |
|---|---|
| Backend on another port | `ATLAS_API=http://localhost:9000 npm run dev` |
| Frontend only, against the production API (no Docker) | `ATLAS_API=https://api.atlas-stars-beyond.tech npm run dev` |
| Another frontend port | `npm run dev -- --port 5174` |
| Test the production build locally | `npm run build && npm run preview` (http://localhost:4173; the preview server reuses the same `/api` proxy) |

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "The Atlas API at /api responded with 502/500" or "did not answer with data" | The backend is not up on 8787: `docker compose ps` and `curl http://localhost:8787/api/health` in the backend |
| The app calls a different API than expected | A `.env.local` with `VITE_API_URL` is set; delete it and restart `npm run dev` |
| `Port 5173 is in use` | Vite picks the next one (5174…); use the URL it prints |
| `npm install` fails on the engine | Node older than 22.13 |
| Illustrated flame instead of the 3D lab | The browser has no WebGL2 (expected fallback) |

### Lint, types and tests

```bash
npm run lint             # ESLint; must finish without errors
npm run typecheck        # tsc for the app and the Node config
npm test                 # Vitest: unit tests of pure functions (src/**/*.test.ts), no browser or network
```

---

## 🚢 Deploy (Cloudflare Workers & Pages)

```
atlas-stars-beyond.tech / www  ─► Cloudflare (this project: static files only)
        │ the browser calls the API directly (CORS)
        ▼
https://api.atlas-stars-beyond.tech ─► Cloudflare ─► nginx on the VPS ─► Go API
```

The API URL is baked into the JavaScript at build time ([`vite.config.ts`](vite.config.ts)):

* `VITE_API_URL`, if set;
* in the Cloudflare build (`WORKERS_CI_BRANCH` set), the production API;
* in a local build without the variable, the app decides at runtime ([`src/api/client.ts`](src/api/client.ts)):
  on `localhost` it uses the `/api` proxy, elsewhere the production API.

```bash
npx wrangler login
npm run deploy           # typecheck + vite build + wrangler deploy
```

Or from the Cloudflare dashboard (Workers & Pages → connected repository): build command `npm run build`, deploy
command `npx wrangler deploy`. Domains: `atlas-stars-beyond.tech` and `www` as Custom domains of the Worker.

---

## 🚀 Mission Story

The story narrates a mission simulated by the
[Mission Fire Engine](https://github.com/stars-beyond/mission-fire-engine), chapter by chapter, in 3D. The engine runs
in the backend (`brain/atlas/mission`) and the story calls it through `GET /api/missions/presets` and
`POST /api/missions/simulations`. The "What does science say?" questions and the predicted flame use `/api/ask` and
`/api/predict/thermal`.

If the API has no engine (older backend) or it does not respond, the story uses `public/story/`: the same six
reference missions, computed by the engine code and published with the site. The page says which source is in use.
When the engine changes, regenerate the files with the engine's Python environment:

```bash
../mission-fire-engine/backend/.venv/Scripts/python.exe scripts/story-snapshots.py
```

---

## ⚠️ Known limitations

- AI questions (`/api/ask`) can take a while. Cloudflare cuts responses longer than 100 s (error 524).
- The **3D flame lab** (`public/lab3d/`) runs on the visitor's GPU. It is a study model with provisional parameters,
  not calibrated against PSI tests; it is always shown with that warning, and the verdict displayed is always the API's.
- lab3d only accepts `/api/sim/config` from its own origin and from the production API (see `public/lab3d/bridge.js`);
  any other origin falls back to the defaults in `model.js`.

---

## 📍 Ports & URLs (default)

* Frontend: `http://localhost:5173` (`npm run dev`)
* API (via proxy): `http://localhost:5173/api` → `http://localhost:8787`
* Production: <https://atlas-stars-beyond.tech> · API <https://api.atlas-stars-beyond.tech>

---

Data: NASA Physical Sciences Informatics (CC0). This project is not affiliated with NASA.
