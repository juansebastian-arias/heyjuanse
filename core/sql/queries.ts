/**
 * Every number in the Decision Lab comes from one of these queries, and the page shows the
 * query next to the number.
 */
export interface NamedQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
}

export const METRIC_QUERIES = {
  needsTotal: {
    id: "needsTotal",
    title: "Real needs this week",
    description: "People who, according to the answer key, have a qualified need this week.",
    sql: `SELECT COUNT(DISTINCT person_id) AS value
FROM labels
WHERE has_need = 1;`,
  },
  needsReached: {
    id: "needsReached",
    title: "Needs reached",
    description: "Real needs that got a sales call this week.",
    sql: `SELECT COUNT(*) AS value
FROM need_outcomes
WHERE outcome = 'reached';`,
  },
  needsWaiting: {
    id: "needsWaiting",
    title: "Needs waiting",
    description: "Real needs that qualified for sales but fell below the capacity line.",
    sql: `SELECT COUNT(*) AS value
FROM need_outcomes
WHERE outcome = 'waiting';`,
  },
  needsInReview: {
    id: "needsInReview",
    title: "Needs in review",
    description: "Real needs waiting on a person to check an AI signal.",
    sql: `SELECT COUNT(*) AS value
FROM need_outcomes
WHERE outcome = 'review';`,
  },
  needsFixData: {
    id: "needsFixData",
    title: "Needs stuck in data fixes",
    description: "Real needs held back by a bad email or a missing company.",
    sql: `SELECT COUNT(*) AS value
FROM need_outcomes
WHERE outcome = 'fix_data';`,
  },
  needsMissed: {
    id: "needsMissed",
    title: "Needs missed",
    description: "Real needs sent to nurture or excluded.",
    sql: `SELECT COUNT(*) AS value
FROM need_outcomes
WHERE outcome = 'missed';`,
  },
  callsMade: {
    id: "callsMade",
    title: "Calls made",
    description: "Leads in the sales lane, above the capacity line.",
    sql: `SELECT COUNT(*) AS value
FROM decisions
WHERE called = 1;`,
  },
  callsWithoutNeed: {
    id: "callsWithoutNeed",
    title: "Calls without a need",
    description: "Sales calls to people who had no real need this week.",
    sql: `SELECT COUNT(*) AS value
FROM decisions d
JOIN lead_truth t ON t.lead_id = d.lead_id
WHERE d.called = 1
  AND t.has_need = 0;`,
  },
  salesPrecision: {
    id: "salesPrecision",
    title: "Calls that found a need",
    description: "Share of this week's calls that reached a real need.",
    sql: `SELECT 1.0 * SUM(t.has_need) / COUNT(*) AS value
FROM decisions d
JOIN lead_truth t ON t.lead_id = d.lead_id
WHERE d.called = 1;`,
  },
  reviewCases: {
    id: "reviewCases",
    title: "Cases for human review",
    description: "Leads a person needs to look at before anything else happens.",
    sql: `SELECT COUNT(*) AS value
FROM decisions
WHERE lane = 'review';`,
  },
} as const satisfies Record<string, NamedQuery>;

export type MetricId = keyof typeof METRIC_QUERIES;

export const LANE_COUNTS_QUERY: NamedQuery = {
  id: "laneCounts",
  title: "Leads per lane",
  description: "How many leads ended up in each lane.",
  sql: `SELECT lane, COUNT(*) AS leads
FROM decisions
GROUP BY lane;`,
};

export const AI_CHANGES_QUERY: NamedQuery = {
  id: "aiChanges",
  title: "What AI changed",
  description: "Leads whose lane differs from the lane they get with AI off.",
  sql: `SELECT d.lane_without_ai AS from_lane,
       d.lane AS to_lane,
       COUNT(*) AS leads,
       SUM(t.has_need) AS with_need
FROM decisions d
JOIN lead_truth t ON t.lead_id = d.lead_id
WHERE d.lane <> d.lane_without_ai
GROUP BY d.lane_without_ai, d.lane
ORDER BY leads DESC;`,
};

export const SCORE_CALIBRATION_QUERY: NamedQuery = {
  id: "scoreCalibration",
  title: "Need rate by score",
  description:
    "For leads that passed every eligibility rule, how often a lead in each score band had a real need.",
  sql: `SELECT (d.score / 10) * 10 AS band,
       COUNT(*) AS leads,
       SUM(t.has_need) AS with_need
FROM decisions d
JOIN lead_truth t ON t.lead_id = d.lead_id
WHERE d.reason IN ('SCORE_ABOVE_THRESHOLD', 'SCORE_BELOW_THRESHOLD')
GROUP BY band
ORDER BY band;`,
};

export const DATA_QUALITY_QUERIES = {
  overview: {
    id: "dqOverview",
    title: "Records and leads",
    description: "Raw records in, leads out, and what the duplicate rules did.",
    sql: `SELECT
  (SELECT COUNT(*) FROM raw_leads) AS raw_records,
  (SELECT COUNT(*) FROM leads) AS leads,
  (SELECT COUNT(*) FROM duplicate_links) AS merges,
  (SELECT COUNT(*) FROM duplicate_flags) AS flagged_pairs;`,
  },
  fixes: {
    id: "dqFixes",
    title: "Fixes by field",
    description: "Every change cleaning made, grouped by field and reason.",
    sql: `SELECT field, reason, COUNT(*) AS records
FROM cleaning_changes
GROUP BY field, reason
ORDER BY records DESC;`,
  },
  duplicatesAgainstTruth: {
    id: "dqDuplicates",
    title: "Duplicate detection against the answer key",
    description:
      "False merges join two different people. Missed duplicates leave one person as two leads.",
    sql: `SELECT
  (SELECT COUNT(*) FROM (
     SELECT r.lead_id
     FROM lead_records r JOIN labels l ON l.raw_id = r.raw_id
     GROUP BY r.lead_id
     HAVING COUNT(DISTINCT l.person_id) > 1)) AS false_merges,
  (SELECT COUNT(*) FROM (
     SELECT l.person_id
     FROM labels l JOIN lead_records r ON r.raw_id = l.raw_id
     GROUP BY l.person_id
     HAVING COUNT(DISTINCT r.lead_id) > 1)) AS missed_duplicates,
  (SELECT COUNT(*) FROM (
     SELECT person_id FROM labels GROUP BY person_id HAVING COUNT(*) > 1)) AS people_with_duplicates;`,
  },
  enrichment: {
    id: "dqEnrichment",
    title: "Company matches",
    description: "How each lead was matched to the company data, if at all.",
    sql: `SELECT COALESCE(match_method, 'no match') AS method, COUNT(*) AS leads
FROM leads
GROUP BY method
ORDER BY leads DESC;`,
  },
} as const satisfies Record<string, NamedQuery>;
