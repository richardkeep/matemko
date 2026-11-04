-- A grown-up who can follow a learner's rounds
CREATE TABLE guardian_links (
  guardian_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guardian_id, child_id)
);
CREATE INDEX guardian_links_child ON guardian_links(child_id);

-- Short-lived, single-use codes a learner shares with a grown-up (digest only)
CREATE TABLE guardian_codes (
  code_hash TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX guardian_codes_child ON guardian_codes(child_id);
