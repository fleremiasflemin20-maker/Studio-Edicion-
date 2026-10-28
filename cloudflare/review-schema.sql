-- Private, short-lived review capabilities. Public catalog tables are independent.
CREATE TABLE IF NOT EXISTS review_shares (
  token_hash TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  project_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1))
);
CREATE INDEX IF NOT EXISTS review_shares_expiry ON review_shares(revoked, expires_at);
CREATE TABLE IF NOT EXISTS review_uploads (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size > 0 AND size <= 20971520),
  created_at INTEGER NOT NULL,
  share_hash TEXT REFERENCES review_shares(token_hash)
);
CREATE INDEX IF NOT EXISTS review_uploads_share ON review_uploads(share_hash);
CREATE TABLE IF NOT EXISTS review_comments (
  id TEXT PRIMARY KEY,
  share_hash TEXT NOT NULL REFERENCES review_shares(token_hash),
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  time REAL NOT NULL CHECK(time >= 0 AND time <= 120),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS review_comments_share_date ON review_comments(share_hash,created_at);
