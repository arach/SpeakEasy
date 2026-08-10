-- One row per person who said they want the Pad.
--
-- Deliberately small. This table holds the least that still answers "who wants
-- this, roughly where are they, and where did they come from" — no names, no IP
-- addresses, no user agents, no tracking identifiers.

CREATE TABLE IF NOT EXISTS interest (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  source     TEXT    NOT NULL DEFAULT 'unknown',
  -- Two-letter country from Cloudflare's edge. Coarse on purpose: enough to
  -- know which stores matter, not enough to locate anybody.
  country    TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS interest_created_at ON interest (created_at);
CREATE INDEX IF NOT EXISTS interest_source     ON interest (source);
