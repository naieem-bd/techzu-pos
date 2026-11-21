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
docker compose up -d        # starts db (dev) and db_test (tests)
npm install
```

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
