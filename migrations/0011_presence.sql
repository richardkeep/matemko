-- Who is online: one row per learner, replaced by a heartbeat about once a minute while
-- Easy Math is open and visible. No history is kept. Only platform admins can read it.
CREATE TABLE presence (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  last_seen INTEGER NOT NULL,   -- ms since epoch, stamped by the server
  activity TEXT NOT NULL,       -- 'practice', 'history', 'leaderboard', 'family' or 'admin'
  in_round INTEGER NOT NULL,    -- 1 while a round is in progress
  country TEXT                  -- ISO 3166-1 alpha-2 from Cloudflare; NULL when unknown
);
CREATE INDEX presence_last_seen ON presence(last_seen);
