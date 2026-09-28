-- Persist 429 back-off so a worker restart doesn't resume fetching early
CREATE TABLE fetch_pause (
  -- single-row table
  id            BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  paused_until  TIMESTAMPTZ NOT NULL,
  site          TEXT NOT NULL
);
