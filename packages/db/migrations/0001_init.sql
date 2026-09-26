-- Kestrel initial schema

CREATE TABLE users (
  id                  BIGSERIAL PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  plan                TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'club')),
  stripe_customer_id  TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every scouted player, on either site
CREATE TABLE players (
  id               BIGSERIAL PRIMARY KEY,
  platform         TEXT NOT NULL CHECK (platform IN ('chesscom', 'lichess')),
  username         TEXT NOT NULL,
  last_fetched_at  TIMESTAMPTZ,
  fetch_priority   SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, username)
);

-- ETag per monthly archive, so unchanged months cost a 304
CREATE TABLE archive_etags (
  player_id   BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  archive     TEXT NOT NULL,              -- e.g. '2026/09'
  etag        TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, archive)
);

-- One compact row per game per scouted player (~1 KB, not the raw JSON)
CREATE TABLE games (
  player_id        BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id          TEXT NOT NULL,
  colour           TEXT NOT NULL CHECK (colour IN ('white', 'black')),
  score            REAL NOT NULL CHECK (score IN (0, 0.5, 1)),
  result_detail    TEXT NOT NULL,          -- win, timeout, resigned, checkmated ...
  time_class       TEXT NOT NULL,
  rated            BOOLEAN NOT NULL,
  ended_at         TIMESTAMPTZ NOT NULL,
  eco              TEXT,
  opening_line     TEXT NOT NULL,          -- first 20 plies in SAN
  moves            SMALLINT NOT NULL,
  clock_at_20      REAL,
  clock_at_30      REAL,
  material_at_30   SMALLINT,
  final_fen        TEXT,
  accuracy         REAL,
  player_rating    SMALLINT,
  opponent_rating  SMALLINT,
  PRIMARY KEY (player_id, game_id)
);
CREATE INDEX games_player_recent ON games (player_id, time_class, ended_at DESC);

-- Finished reports, cached
CREATE TABLE reports (
  player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  time_class   TEXT NOT NULL,
  built_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  games_used   SMALLINT NOT NULL,
  report_json  JSONB NOT NULL,
  PRIMARY KEY (player_id, time_class)
);

-- Jobs waiting to call Chess.com or Lichess, one at a time
CREATE TABLE fetch_queue (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL CHECK (platform IN ('chesscom', 'lichess')),
  username    TEXT NOT NULL,
  priority    SMALLINT NOT NULL DEFAULT 0,   -- 10 = a user is waiting, 0 = background
  attempts    SMALLINT NOT NULL DEFAULT 0,
  not_before  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at   TIMESTAMPTZ,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one pending job per player
CREATE UNIQUE INDEX fetch_queue_one_per_player ON fetch_queue (platform, username);
CREATE INDEX fetch_queue_next ON fetch_queue (priority DESC, not_before, id) WHERE locked_at IS NULL;

-- Rivals and clubmates a user follows (pre-fetched in the background)
CREATE TABLE watchlist (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL CHECK (platform IN ('chesscom', 'lichess')),
  username   TEXT NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, platform, username)
);

-- Tournaments and club matches whose players get pre-fetched
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN ('chesscom', 'lichess')),
  event_ref   TEXT NOT NULL,
  starts_at   TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fetched', 'done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Players who asked to be removed: never fetched or shown again
CREATE TABLE removal_requests (
  platform      TEXT NOT NULL CHECK (platform IN ('chesscom', 'lichess')),
  username      TEXT NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, username)
);

-- Early-access sign-ups from the landing page
CREATE TABLE early_access (
  email       TEXT PRIMARY KEY,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
