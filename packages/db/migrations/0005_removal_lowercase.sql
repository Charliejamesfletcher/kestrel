-- Usernames are case-insensitive on both sites, but a removal typed as
-- "DrNykterstein" never matched the stored "drnykterstein". Normalise
-- existing rows and enforce lower-case from now on.

-- keep the earliest of any duplicates
DELETE FROM removal_requests a
USING removal_requests b
WHERE a.platform = b.platform
  AND lower(btrim(a.username)) = lower(btrim(b.username))
  AND (a.requested_at, a.ctid) > (b.requested_at, b.ctid);

UPDATE removal_requests SET username = lower(btrim(username)) WHERE username <> lower(btrim(username));

ALTER TABLE removal_requests
  ADD CONSTRAINT removal_requests_username_lower CHECK (username = lower(btrim(username)));

-- Anything already stored about them goes (games, reports and ETags follow
-- through ON DELETE CASCADE), and so does any job waiting to fetch them
DELETE FROM players p USING removal_requests r WHERE p.platform = r.platform AND p.username = r.username;
DELETE FROM fetch_queue q USING removal_requests r WHERE q.platform = r.platform AND q.username = r.username;
