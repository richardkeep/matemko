CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL, -- ms since epoch
  ended_at INTEGER NOT NULL,   -- ms since epoch, stamped by the server
  ops TEXT NOT NULL,           -- operations used, e.g. "+−×÷"
  max_result INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL
);
