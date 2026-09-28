# API

Two report routes plus a health check. The response types live in [`packages/shared/src/api.ts`](../packages/shared/src/api.ts) and are shared by the API, the web app and the tests.

Both report routes answer `200` with a `status` field for anything to do with the player. HTTP errors are kept for bad input (`400`), rate limits (`429`) and server faults (`500`).

## `POST /api/scout`

Asks for a report. If the player hasn't been fetched in the last 6 hours, it queues a fetch at high priority (someone is waiting). Safe to call repeatedly.

```bash
curl -X POST localhost:3000/api/scout \
  -H 'content-type: application/json' \
  -d '{"platform":"chesscom","username":"hikaru"}'
```

```json
{ "status": "queued", "position": 1 }
```

Limited to 20 calls a minute per IP.

## `GET /api/report/:platform/:username?scope=`

Reads only. It never queues anything, so the web app can poll it freely (every 2 s while queued or fetching).

```bash
curl 'localhost:3000/api/report/chesscom/hikaru?scope=blitz'
```

```json
{
  "status": "ready",
  "report": { "version": 3, "gamesUsed": 250, "plan": { "text": "As White they most often open 1.e4; ..." }, "...": "..." },
  "scopes": [{ "scope": "all", "games": 250 }, { "scope": "blitz", "games": 250 }, { "scope": "bullet", "games": 200 }],
  "refreshing": false,
  "lastFetchedAt": "2026-09-28T11:48:09.520Z"
}
```

`scope` is `all`, `bullet`, `blitz`, `rapid` or `daily`. Leave it out, or ask for one they don't play, and you get the time class they play most.

## Statuses

| Situation | Answer |
| --- | --- |
| Player asked to be removed | `removed` (nothing queued, nothing shown) |
| Report stored, fetched less than 6 h ago | `ready`, `refreshing: false` |
| Report stored but older (POST) | `ready`, `refreshing: true`, and a refresh is queued |
| No report yet (POST) | `queued` with `position` (1 = next), or `fetching` |
| No such account (checked in the last 10 min) | `not_found` |
| Fetching gave up after 5 tries (GET) | `failed`, `retryable: true`; a POST restarts it |
| Never asked about (GET) | `unknown`; call POST |
| Bad platform, username or scope | `400` with `invalid` |

## `GET /health`

```json
{ "status": "ok", "database": true, "version": "0.1.0" }
```

## Behind a proxy

With Cloudflare in front, set `TRUST_PROXY=true` so the rate limit uses each visitor's real address (`CF-Connecting-IP`, then `X-Forwarded-For`) rather than Cloudflare's. Leave it `false` when the API is reached directly, otherwise anyone could fake their address with a header.

## Serving the web app

In production the API also serves `packages/web/dist`: real files by path, and `index.html` for anything else so the single-page app can route it (for example `/chesscom/hikaru`). Unknown `/api/*` paths are JSON 404s.
