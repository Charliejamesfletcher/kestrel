-- Keep full movetext so material at move 30 can be computed without refetching
ALTER TABLE games
  ADD COLUMN time_control  TEXT,
  ADD COLUMN opening_name  TEXT,
  ADD COLUMN movetext      TEXT;

-- result_detail now holds one of these, the same words for both sites
ALTER TABLE games ADD CONSTRAINT games_result_detail_check CHECK (result_detail IN (
  'checkmate', 'resign', 'timeout', 'abandoned', 'draw_agreed', 'repetition',
  'stalemate', 'insufficient', 'fifty_moves', 'timeout_vs_insufficient', 'other'
));

-- Set after 5 failed attempts; re-queueing the player clears it
ALTER TABLE fetch_queue ADD COLUMN failed_at TIMESTAMPTZ;

-- Locked rows can be reclaimed after a crash, so only filter on failed_at
DROP INDEX fetch_queue_next;
CREATE INDEX fetch_queue_next ON fetch_queue (priority DESC, not_before, id) WHERE failed_at IS NULL;
