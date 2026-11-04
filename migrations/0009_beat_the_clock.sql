-- Beat-the-clock limit in ms; NULL when untimed
ALTER TABLE attempts ADD COLUMN time_limit_ms INTEGER;
