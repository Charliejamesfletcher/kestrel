# Kestrel

Scout your next chess opponent before the round: openings, weak spots and habits from their public Chess.com and Lichess games. Reports are for preparation only and are never shown during a live game.

## What's in here

| Folder | What it is |
| --- | --- |
| `packages/shared` | Config loading, User-Agent, shared types (the report engine lives here from Phase 3) |
| `packages/db` | Postgres connection, migrations (`migrations/*.sql`) and the migrate command |
| `packages/api` | Fastify API. Now: `GET /health`. Phase 4: reports, watchlist, removal |
| `packages/worker` | Background worker: one request at a time to Chess.com/Lichess (Phase 2) |
| `packages/web` | Vite + React web app (Phase 4) |
| `packages/extension` | Chrome extension, Manifest V3 (Phase 5) |

## Rules this codebase never breaks

1. No reports or hints during a live game.
2. One request at a time to Chess.com, with our User-Agent and contact email.
3. Public game data only; honour removal requests.
4. Never ask for anyone's chess password.

## Run it locally

Requires Node 22+ and Docker.

```bash
cp .env.example .env          # then set POSTGRES_PASSWORD, DATABASE_URL and CONTACT_EMAIL
npm install
docker compose up db -d       # start Postgres only
npm run migrate               # create the tables
npm run dev:api               # http://localhost:3000/health
npm run dev:worker            # in another terminal
npm run dev:web               # http://localhost:5173
```

Or run everything in containers:

```bash
docker compose up --build     # db, migrations, api and worker
curl localhost:3000/health    # {"status":"ok","database":true,...}
```

## Checks

```bash
npm run typecheck
npm test                      # database tests run when DATABASE_URL is set
```

GitHub Actions runs type-checks, tests (against a real Postgres), the web build and a Docker build on every push.

## Adding a database change

Add a new file in `packages/db/migrations/` with the next number, e.g. `0002_add_x.sql`. Never edit a migration that has already run. `npm run migrate` applies new files in order; it's safe to run on every deploy.
