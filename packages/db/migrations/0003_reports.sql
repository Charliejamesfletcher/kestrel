-- Busy accounts can pass SMALLINT's 32,767
ALTER TABLE reports ALTER COLUMN games_used TYPE INTEGER;
