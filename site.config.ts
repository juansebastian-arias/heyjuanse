/**
 * Personal details shown on the site. Contact methods left as null are hidden, so nothing is
 * published until it has been confirmed.
 */
export const SITE = {
  name: "Juan Sebastián Arias",
  url: "https://heyjuanse.com",
  positioning:
    "GTM engineer. I build the automated engine that turns leads into sales meetings: routing, enrichment, scoring and AI agents that draft while a person approves, each one chosen with data.",
  specialties: [
    "Lead routing and scoring",
    "GTM automation with n8n",
    "AI agents with human approval",
    "SQL and A/B tests",
    "CRM systems",
  ],
  repository: "https://github.com/juansebastian-arias/heyjuanse",
  contact: {
    email: "juan.arias2025@gmail.com" as string | null,
    linkedin: "https://www.linkedin.com/in/juansebastian-arias" as string | null,
    github: "https://github.com/juansebastian-arias" as string | null,
  },
} as const;
