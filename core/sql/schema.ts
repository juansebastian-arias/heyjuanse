/**
 * The tables the browser loads into SQLite (sql.js). The decision engine writes `decisions`;
 * the answer key goes into `labels`; every metric on the page is a query over these tables.
 */
export const SCHEMA_SQL = `
CREATE TABLE raw_leads (
  raw_id        TEXT PRIMARY KEY,
  received_at   TEXT NOT NULL,
  source        TEXT NOT NULL,
  email         TEXT,
  company_name  TEXT,
  country       TEXT,
  has_message   INTEGER NOT NULL
);

CREATE TABLE leads (
  lead_id        TEXT PRIMARY KEY,
  first_touch_at TEXT NOT NULL,
  name           TEXT,
  email          TEXT,
  email_status   TEXT NOT NULL,
  is_freemail    INTEGER NOT NULL,
  company        TEXT,
  company_id     TEXT,
  match_method   TEXT,
  industry       TEXT,
  size_band      TEXT,
  region         TEXT,
  country        TEXT,
  suppressed     INTEGER NOT NULL,
  submissions    INTEGER NOT NULL,
  messages       INTEGER NOT NULL
);

-- Which raw records were merged into which lead.
CREATE TABLE lead_records (
  raw_id   TEXT PRIMARY KEY,
  lead_id  TEXT NOT NULL
);

CREATE TABLE cleaning_changes (
  raw_id  TEXT NOT NULL,
  field   TEXT NOT NULL,
  reason  TEXT NOT NULL
);

CREATE TABLE duplicate_links (a TEXT NOT NULL, b TEXT NOT NULL, rule TEXT NOT NULL);
CREATE TABLE duplicate_flags (a TEXT NOT NULL, b TEXT NOT NULL, rule TEXT NOT NULL);

-- Written by the decision engine every time a dial moves.
CREATE TABLE decisions (
  lead_id          TEXT PRIMARY KEY,
  lane             TEXT NOT NULL,
  reason           TEXT NOT NULL,
  score            INTEGER NOT NULL,
  fit_points       INTEGER NOT NULL,
  intent_points    INTEGER NOT NULL,
  ai_points        INTEGER NOT NULL,
  ai_used          INTEGER NOT NULL,
  lane_without_ai  TEXT NOT NULL,
  queue_position   INTEGER,
  called           INTEGER NOT NULL
);

-- The answer key. One row per raw record. Only metrics read it, never the engine.
CREATE TABLE labels (
  raw_id     TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL,
  has_need   INTEGER NOT NULL,
  persona    TEXT NOT NULL
);

-- Does any person behind this lead have a real need?
CREATE VIEW lead_truth AS
SELECT r.lead_id, MAX(l.has_need) AS has_need
FROM lead_records r
JOIN labels l ON l.raw_id = r.raw_id
GROUP BY r.lead_id;

-- One row per real need, with the best thing that happened to it this week.
CREATE VIEW need_outcomes AS
WITH ranked AS (
  SELECT
    l.person_id,
    MIN(CASE
      WHEN d.lane = 'sales' AND d.called = 1 THEN 1
      WHEN d.lane = 'review'                 THEN 2
      WHEN d.lane = 'sales'                  THEN 3
      WHEN d.lane = 'fix_data'               THEN 4
      ELSE 5
    END) AS best
  FROM labels l
  JOIN lead_records r ON r.raw_id = l.raw_id
  JOIN decisions d ON d.lead_id = r.lead_id
  WHERE l.has_need = 1
  GROUP BY l.person_id
)
SELECT
  person_id,
  CASE best
    WHEN 1 THEN 'reached'
    WHEN 2 THEN 'review'
    WHEN 3 THEN 'waiting'
    WHEN 4 THEN 'fix_data'
    ELSE 'missed'
  END AS outcome
FROM ranked;
`;
