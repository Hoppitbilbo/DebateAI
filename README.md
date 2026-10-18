# AI-Debate.Tech

Interactive, AI-powered learning activities for schools: students talk with historical figures and Wikipedia topics, reflect on the conversation and get feedback. Teachers create classes, invite students by e-mail, assign tasks and follow every student's progress. An administrator runs everything on the school's own server, chooses the AI models (free, paid or local) and keeps costs under control.

## What's inside

| | |
|---|---|
| **6 learning apps** | Convince YOU, Double Interview, WikiChat AI, Mystery Character, You Impersonate, You Moderate. They all share the same flow and interface: *Setup → Conversation → Reflection → Feedback*. |
| **Classes & assignments** | Teachers create classes, invite students (e-mail invites or a class code), and publish assignments with instructions, goals, turn limits, a due date and optional locked characters/topic. |
| **JEV** | After every student turn, JEV checks the assignment goals and ends the conversation when they are reached. It uses [Jev](https://opencode.ai/docs/zen/) (TypeSafe AI's decision model on OpenCode, free tier `jev-1.13-free`) and falls back to any text model. The same router decides which provider/model serves each task, with automatic fallback. |
| **Multi-provider AI gateway** | Google Gemini, OpenCode Zen (free models such as `big-pickle`), OpenRouter (`:free` models), Groq, Cerebras, Mistral, DeepSeek, OpenAI, Anthropic, and local models via **Ollama** / **LM Studio** / any OpenAI-compatible server. API keys stay on the server, encrypted. |
| **Live voice** | Real-time voice conversations through the **Gemini Live API** (Google Gen AI SDK), using single-use ephemeral tokens minted by the server. |
| **Cost monitoring** | Every request is logged with tokens and cost (USD). The dashboard breaks spending down by day, model, task, user and class. A monthly budget can block paid models (free/local models keep working), and there are rate limits for guests and students. |
| **5 languages** | Italian, English, Spanish, French, German: UI, AI answers, e-mails. |

## Architecture

```
browser (React + Vite + shadcn/ui)
   │  /api/*  (cookie session)
   ▼
Go server (single binary, embeds the built frontend)
   ├─ SQLite (users, classes, assignments, sessions, usage log, settings)
   ├─ AI gateway + JEV router → Gemini · OpenAI-compatible · Anthropic · Jev
   ├─ JEV judge (goal checks per turn)
   ├─ SMTP mailer (invites, welcome, password reset, assignment notices)
   └─ Gemini Live ephemeral tokens  ──► browser ⇄ Gemini Live (WebSocket)
```

## Quick start (Docker, recommended for a school server)

```sh
cp .env.example .env        # optional: PUBLIC_URL, OPENROUTER_API_KEY, TYPESAFE_API_KEY, GEMINI_API_KEY, SMTP_*
docker compose up -d --build
```

Open `http://<server>:8080`. On first launch you will be asked to create the administrator account, then:

1. **Admin → AI & JEV → Add provider**: for example *OpenRouter* (free `:free` models for chat and evaluation), *TypeSafe Jev* (the JEV judge) and *Google Gemini* (required for live voice). Keys set in `.env` are added automatically on first start. The routing for each task is filled in automatically and you can reorder or extend it. If a model does not start answering within 25 s, the next one in the list is used.
2. **Admin → Settings**: SMTP for e-mails, public URL, monthly budget, guest access.
3. **Admin → Users**: invite the teachers. Teachers create their classes and invite the students.

All data lives in the `debateai-data` volume (`/data`): the SQLite database and `secret.key`, which encrypts the API keys. Back up both together, for example:

```sh
docker compose stop
docker run --rm -v debateai-data:/data -v "$PWD":/backup alpine tar czf /backup/debateai-backup.tgz -C /data .
docker compose start
```

Update to a new version with `git pull && docker compose up -d --build` (the data volume is kept). The container runs as a non-root user and reports its health at `/api/health`.

> **Hosting note:** SQLite needs a persistent disk. Use a VPS/droplet with Docker, or any host with persistent volumes. Platforms with an ephemeral filesystem would lose the data on every deploy.

## Without Docker

Requirements: Node 20+ and Go 1.26+.

```sh
npm install
npm run build:server        # builds the frontend and a single binary in ./bin/debateai
DATA_DIR=./data PUBLIC_URL=https://debate.myschool.it ./bin/debateai
```

The binary has no external dependencies (pure-Go SQLite), so you can copy it to any Linux/macOS/Windows server (cross-compile with `GOOS`/`GOARCH`).

## Development

```sh
npm install
npm run dev                 # Vite on :5173 + Go API on :8080 (proxied)
npm run test:server         # Go unit + end-to-end tests (mock AI providers)
npm run check:i18n          # every translation key exists in the 5 languages
```

## Configuration (environment)

See [.env.example](.env.example). Everything except `PORT`, `DATA_DIR`, `APP_SECRET` can also be changed later from the admin panel.

| Variable | Purpose |
|---|---|
| `PORT`, `DATA_DIR`, `DATABASE_PATH` | Listening port, data directory, SQLite path |
| `PUBLIC_URL` | Base URL used in e-mail links |
| `APP_SECRET` | Encrypts stored API keys (auto-generated in `DATA_DIR/secret.key` if empty) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Create the first admin non-interactively |
| `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY`, `GEMINI_API_KEY`, `OPENCODE_API_KEY` | Pre-configure providers and routing on first start |
| `SMTP_*` | Default SMTP settings |

## AI providers & routing

Tasks routed independently (Admin → AI & JEV):

| Task | Used for | Good choice |
|---|---|---|
| `chat` | characters' answers | fast free models (OpenRouter `:free` / `openrouter/free`, Groq, local Ollama); avoid slow reasoning models |
| `evaluation` | final feedback & scores | a stronger model |
| `utility` | voice casting, goal suggestions | small/free model |
| `judge` | JEV goal checks | **Jev** (`jev-latest` on TypeSafe or OpenRouter, `jev-1.13-free` on OpenCode), fallback any text model |
| `live` | real-time voice | Gemini Live model (e.g. `gemini-3.1-flash-live-preview`) |

Each task has an ordered list of `provider/model` targets: on error or quota (429/5xx) the next one is used. Strategies: *ordered*, *free first*, *cheapest first*. When the monthly budget is exhausted, only free/local targets are used. Prices (USD per 1M tokens) are editable; OpenRouter prices are imported automatically and local models cost 0.

For local models inside Docker use `http://host.docker.internal:11434/v1` (Ollama) or uncomment the `ollama` service in `docker-compose.yml`.

## Privacy

API keys never leave the server. Conversations are stored only for logged-in users doing activities (so that teachers can review assignments); guests' conversations are not stored. Wikipedia is queried directly from the browser.

## License & contributions

Open source: issues and pull requests are welcome on GitHub. Thanks to Google (Gemini), OpenCode/TypeSafe AI (Jev) and Wikipedia.
