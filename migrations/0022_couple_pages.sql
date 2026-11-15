CREATE TABLE IF NOT EXISTS couple_pages (
  account_id TEXT PRIMARY KEY NOT NULL,
  names_json TEXT NOT NULL DEFAULT '[]',
  date_line TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  welcome_title TEXT NOT NULL DEFAULT '',
  welcome_body TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  venue_name TEXT NOT NULL DEFAULT '',
  venue_place TEXT NOT NULL DEFAULT '',
  maps_href TEXT NOT NULL DEFAULT '',
  dress_title TEXT NOT NULL DEFAULT '',
  dress_rule TEXT NOT NULL DEFAULT '',
  etapas_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
