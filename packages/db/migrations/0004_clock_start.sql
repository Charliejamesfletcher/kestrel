-- Actual starting clock in seconds. Differs from the time control when a
-- Lichess player berserks. Null for daily games and older rows.
ALTER TABLE games ADD COLUMN clock_start REAL;
