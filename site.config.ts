/**
 * Personal details shown on the site. Contact methods left as null are hidden, so nothing is
 * published until it has been confirmed.
 */
export const SITE = {
  name: "Juan Sebastián Arias",
  url: "https://heyjuanse.com",
  positioning:
    "I design and build the systems revenue teams run on: clean data, explainable decisions, and automation and AI that know when to ask a human.",
  specialties: ["GTM systems", "SQL and analytics", "AI automation", "CRM implementation"],
  repository: "https://github.com/juansebastian-arias/heyjuanse",
  contact: {
    email: null as string | null,
    linkedin: null as string | null,
    github: "https://github.com/juansebastian-arias" as string | null,
  },
} as const;
