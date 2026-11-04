-- Single-use email links. Only SHA-256 digests of the tokens are stored.
CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,       -- 'reset' or 'verify'
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_tokens_user ON auth_tokens(user_id, purpose);
CREATE INDEX auth_tokens_expiry ON auth_tokens(expires_at);
