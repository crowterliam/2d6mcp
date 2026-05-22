CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  subscription_status TEXT,
  sessions_used_this_month INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id),
  name TEXT,
  rules_system TEXT DEFAULT 'ogl',
  byod_system TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  status TEXT DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_sessions_guild ON sessions(guild_id, started_at DESC);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  guild_id TEXT NOT NULL,
  text TEXT NOT NULL,
  speaker TEXT,
  source TEXT DEFAULT 'voice',
  intent TEXT,
  logged_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_segments_session ON transcript_segments(session_id, logged_at);

CREATE TABLE IF NOT EXISTS rulings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id),
  guild_id TEXT NOT NULL,
  question TEXT NOT NULL,
  ruling TEXT NOT NULL,
  source_citations TEXT,
  model_used TEXT,
  latency_ms INTEGER,
  quality_warnings TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rulings_guild ON rulings(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rulings_session ON rulings(session_id, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE VIRTUAL TABLE ogl_rules_fts USING fts5(
  title,
  category,
  content,
  source_tag,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE dw_rules_fts USING fts5(
  title,
  category,
  content,
  source_tag,
  tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS transcription_progress (
  file_path TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  session_id TEXT,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  completed_chunks INTEGER NOT NULL DEFAULT 0,
  temp_dir TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
