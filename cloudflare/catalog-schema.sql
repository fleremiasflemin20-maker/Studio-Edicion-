CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('background','element','style','title','transition','sound','recipe')),
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  license TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  preview TEXT NOT NULL,
  metadata TEXT NOT NULL,
  search_text TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS resources_type_published ON resources(type,published,id);
