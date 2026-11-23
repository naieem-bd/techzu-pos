# Techzu POS

Central HQ + multi-outlet F&B point-of-sale. HQ manages the master menu, outlet
assignments, price overrides and reports; each outlet sells from its assigned menu
and keeps its own stock.

> Work in progress. See `CLAUDE.md` for scope, architecture and rules.

## Prerequisites

- Node.js 22 LTS (`nvm use`)
- Docker (for PostgreSQL 16)

## Setup

```bash
cp .env.example .env        # then edit values
docker compose up -d db db_test   # Postgres for dev and for tests
npm install
```

## Run the production image locally

```bash
docker compose up --build   # db + app; migrates and seeds demo data on start
```

API reference: http://localhost:3000/api/docs · health: http://localhost:3000/api/health.
The container runs `dist/start.js`: migrations, then the idempotent seed when
`SEED_ON_START=true`, then the server. Use `APP_PORT` in `.env` if port 3000 is taken.

## Deploy to Render (free tier)

The database is [Neon](https://neon.tech) (managed Postgres 16, TLS required).

1. In Neon, create a project in the Singapore region and copy the **direct** (non-pooled)
   connection string (host without `-pooler`).
2. In Render choose **New → Blueprint** and select this repo. `render.yaml` creates a free
   Docker web service on `main` (Singapore, `healthCheckPath: /api/health`).
3. Paste the Neon string as the `DATABASE_URL` secret. `DB_SSL=true` is already set: the server
   verifies Neon's certificate and uses channel binding.

Render provides `PORT` and `RENDER_EXTERNAL_URL` (used as the CORS origin when `CORS_ORIGIN`
is unset). Free services sleep when idle, so the first request after a pause is slow.

## Scripts

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the server in watch mode (tsx)    |
| `npm run build`        | Build all workspaces                    |
| `npm run lint`         | ESLint (type-aware) over the whole repo |
| `npm run typecheck`    | `tsc --noEmit` in every workspace       |
| `npm test`             | Jest integration tests (server)         |
| `npm run format:check` | Prettier check                          |

## Layout

```
server/   Express API: routes -> controllers -> services -> repositories -> PostgreSQL
client/   React + Vite app (added in a later PR)
```
