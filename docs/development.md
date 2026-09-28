# Development

## Requirements

- Node 22+
- Docker (for Postgres, or for the whole stack)

## Running locally

```bash
cp .env.example .env          # set POSTGRES_PASSWORD, DATABASE_URL and CONTACT_EMAIL
npm install
docker compose up db -d       # Postgres only
npm run migrate
npm run dev:api               # http://localhost:3000/health
npm run dev:worker            # second terminal
npm run dev:web               # http://localhost:5173, proxies /api to :3000
```

Or run everything in containers:

```bash
docker compose up --build -d
curl localhost:3000/health
open http://localhost:3000
```

`CONTACT_EMAIL` goes into the User-Agent so Chess.com and Lichess can reach us. The worker won't start with the `example.com` placeholder.

## Fetching games

```bash
npm run scout -- chesscom hikaru               # someone is waiting: goes first
npm run scout -- lichess someone --background  # behind the waiting ones
docker compose logs -f worker
```

Inside Docker: `docker compose exec worker node packages/worker/dist/scout.js chesscom hikaru`.

## Removal requests

Until the removal page is built:

```bash
npm run remove -- chesscom someone
```

This records the request and deletes their games, reports and queued jobs in one statement. Usernames are stored lower-case, so capital letters can't get round it.

## Backfill

After changing the report engine, or to fill in games stored before a column existed:

```bash
npm run backfill
docker compose exec worker node packages/worker/dist/backfill.js   # in Docker
```

It fills in material at move 30 where it's missing (500 games at a time), then rebuilds every player's reports. It only touches our database, so it's fine to run alongside the worker.

## Tests

```bash
npm run typecheck
npm test
```

There are 237 tests across 19 files. The database tests only run when `DATABASE_URL` is set. Stop the worker before running them, because the fetch-lock test needs the lock the worker holds.

Tests never call Chess.com or Lichess. The HTTP clients take a `fetch` function, and the tests pass a fake one.

### Fixtures

[`packages/shared/fixtures`](../packages/shared/fixtures) holds real public games: 33 of Hikaru's Titled Tuesday blitz games and 40 of DrNykterstein's Lichess games. Edge cases (variants, daily games, aborted games, berserk) are small edits of those real games inside the tests.

To save a new fixture (stop the worker first, it holds the fetch lock):

```bash
npm run fixture -- chesscom hikaru 2026/09 --match "Titled Tuesday" --limit 50
npm run fixture -- lichess DrNykterstein --limit 30
```

New Chess.com fixtures are picked up by the parser tests automatically.

## CI

GitHub Actions runs on every push and pull request to `main`: type-check, the full test suite against a real Postgres 16 service, the web build, and a Docker image build.

## Database changes

Add a new numbered file to [`packages/db/migrations`](../packages/db/migrations), for example `0007_add_x.sql`. Never edit a migration that has already run. `npm run migrate` applies new files in order and is safe to run on every deploy.

## Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker Compose | Creates the database |
| `DATABASE_URL` | API, worker, migrations, tests | |
| `PORT` | API | Default 3000 |
| `NODE_ENV` | all | |
| `CONTACT_EMAIL` | worker | Goes in the User-Agent; must be real |
| `APP_NAME`, `APP_VERSION` | worker, API | Also part of the User-Agent |
| `TRUST_PROXY` | API | `true` only behind Cloudflare or another proxy |
