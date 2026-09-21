-- Personal AI Diet Manager - D1 schema
-- Safe to run more than once: uses CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE.

PRAGMA foreign_keys = ON;

-- Single-user profile. Row id = 1 is the only profile that will ever exist.
CREATE TABLE IF NOT EXISTS profiles (
  id                   INTEGER PRIMARY KEY,
  display_name         TEXT NOT NULL DEFAULT 'Me',
  timezone             TEXT NOT NULL DEFAULT 'UTC',
  weight_unit          TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  calorie_target       REAL NOT NULL DEFAULT 2000,
  protein_target       REAL NOT NULL DEFAULT 100,
  carbohydrate_target  REAL NOT NULL DEFAULT 250,
  fat_target           REAL NOT NULL DEFAULT 70,
  fiber_target         REAL NOT NULL DEFAULT 30,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO profiles (id) VALUES (1);

CREATE TABLE IF NOT EXISTS meals (
  id                   TEXT PRIMARY KEY,
  profile_id           INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_name            TEXT NOT NULL,
  meal_type            TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_date            TEXT NOT NULL,
  meal_time            TEXT NOT NULL,
  input_method         TEXT NOT NULL CHECK (input_method IN ('text', 'photo', 'manual')),
  original_text        TEXT,
  notes                TEXT,
  ai_model             TEXT,
  overall_confidence   REAL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_meals_profile_date ON meals (profile_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals (meal_date);

CREATE TABLE IF NOT EXISTS meal_items (
  id                     TEXT PRIMARY KEY,
  meal_id                TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_name              TEXT NOT NULL,
  amount                 REAL NOT NULL,
  unit                   TEXT NOT NULL,
  estimated_grams        REAL NOT NULL,
  calories               REAL NOT NULL,
  protein_grams          REAL NOT NULL,
  carbohydrate_grams     REAL NOT NULL,
  fat_grams              REAL NOT NULL,
  fiber_grams            REAL NOT NULL,
  preparation            TEXT,
  confidence             REAL,
  assumptions            TEXT,
  nutrition_source       TEXT NOT NULL DEFAULT 'gpt-5-nano-estimate',
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items (meal_id);

CREATE TABLE IF NOT EXISTS weights (
  id                   TEXT PRIMARY KEY,
  profile_id           INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_value         REAL NOT NULL,
  weight_unit          TEXT NOT NULL CHECK (weight_unit IN ('kg', 'lb')),
  recorded_date        TEXT NOT NULL,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_weights_profile_date ON weights (profile_id, recorded_date);

CREATE TABLE IF NOT EXISTS sessions (
  id                   TEXT PRIMARY KEY,
  token_hash           TEXT NOT NULL UNIQUE,
  expires_at           TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);

CREATE TABLE IF NOT EXISTS login_attempts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash              TEXT NOT NULL,
  attempted_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  successful           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts (ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts (attempted_at);
