/**
 * Personal details shown on the site. Contact methods left as null are hidden, so nothing is
 * published until it has been confirmed.
 */
export const SITE = {
  name: "Juan Sebastián Arias",
  url: "https://heyjuanse.com",
  positioning:
    "GTM engineer. I build systems that turn leads into sales meetings: routing, scoring, CRM automation and AI agents that draft while a person approves, each change priced in dollars.",
  specialties: [
    "Lead routing and scoring",
    "n8n, Zapier and Make",
    "HubSpot and Zoho CRM",
    "AI agents with human approval",
    "Python, SQL and A/B tests",
  ],
  repository: "https://github.com/juansebastian-arias/heyjuanse",
  contact: {
    email: "juan.arias2025@gmail.com" as string | null,
    linkedin: "https://www.linkedin.com/in/juansebastian-arias" as string | null,
    github: "https://github.com/juansebastian-arias" as string | null,
  },
} as const;
