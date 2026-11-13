-- Migration 0010: Playlist / vídeo (YouTube) — Cloudflare Free / D1

CREATE TABLE IF NOT EXISTS media_playlist (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  title TEXT NOT NULL
    CHECK (length(title) >= 2 AND length(title) <= 120),
  youtube_url TEXT NOT NULL
    CHECK (length(youtube_url) >= 12 AND length(youtube_url) <= 500),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_playlist_active_sort
  ON media_playlist(active, sort_order, id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0010', datetime('now'))
ON CONFLICT(version) DO NOTHING;
