# Vercel deployment

`vercel.json` deploys the repository as one Vercel project with two [services](https://vercel.com/docs/services):

| Service | Root | What it is | Public path |
|---|---|---|---|
| `app` | `.` | Vite build of the React frontend (`npm run build:web`, output `dist`), with the SPA fallback to `index.html` | everything except `/api/*` |
| `server` | `server` | The Go API (`main.go`, Go preset, listens on `PORT`) | `/api/*` |

The Go service receives the original path (`/api/...`), so the routes and the browser's relative `/api` calls need no changes. There are no service bindings: the frontend is static and the browser calls the API through the public route; the Go server only calls external services (AI providers, SMTP, Sentry).

## Database

Vercel functions keep nothing on disk between requests, so the SQLite file used by Docker does not work there. On Vercel the server uses a remote [libSQL](https://turso.tech) database (Turso), which speaks the same SQL: the schema and the migrations are applied on start, as with the local file.

1. Create the database: Vercel Marketplace → Turso (this sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on the project), or `turso db create debateai` and `turso db tokens create debateai`.
2. Set the environment variables below.

Without `TURSO_DATABASE_URL` the server uses the SQLite file in `DATA_DIR`, as before (Docker, local development).

## Environment variables (Vercel project settings)

| Variable | Service | Required | Notes |
|---|---|---|---|
| `TURSO_DATABASE_URL` | server | yes | `libsql://<db>-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | server | yes | database token |
| `APP_SECRET` | server | yes | encrypts the stored API keys; the server refuses to start without it when the database is remote. Generate once (`openssl rand -hex 32`) and never change it |
| `PUBLIC_URL` | server | yes | the deployment's domain, used in e-mail links |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | server | no | first administrator; otherwise use the setup page |
| `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY`, `GEMINI_API_KEY`, `OPENCODE_API_KEY` | server | no | providers bootstrapped on the first start |
| `SMTP_*` | server | no | can also be set in Admin → Settings |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | server | no | see [SENTRY.md](SENTRY.md) |
| `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | app (build) | no | see [SENTRY.md](SENTRY.md) |

## Local check

`vercel dev` runs both services together. The remote database can be tried locally with a libSQL server in Docker:

```bash
docker run -d --rm --name libsql -p 8089:8080 ghcr.io/tursodatabase/libsql-server:latest
cd server && TURSO_DATABASE_URL=http://127.0.0.1:8089 APP_SECRET=dev go run .
```

## Verified

- A real Vercel deployment (2026-10-26): project `debateai`, Turso from the Marketplace, `https://debateai-steel.vercel.app`; the frontend and `/api/*` answer 200 and the server logs `database: remote libSQL`. The project's first deployment always goes to production.
- Production deployment of 2026-10-28 (`dpl_7Se1juqP5GZaD3mnfon5ZJvQz9Hb`, branch `vercel` at `fa5f07a`, restyling and phase 11): pages, illustrations, `og-image.png` and `/api/public/config` answer 200 on `https://debateai-steel.vercel.app`.
- Preview deployments start the server without `APP_SECRET` (set for Production only) while `TURSO_DATABASE_URL` is set for Preview too, so their `/api/*` answers 500 (`APP_SECRET is required with TURSO_DATABASE_URL`). The frontend of a preview works.

## Not verified yet

- Streaming of AI answers (`text/event-stream` from `POST /api/ai/generate`) through Vercel's Go runtime.
- In-memory state (rate limiter, provider cache) is per instance on Vercel, so limits are looser than on a single Docker server.
