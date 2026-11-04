-- Stars, stickers and streaks, synced across devices (JSON of the progress object)
CREATE TABLE user_progress (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
