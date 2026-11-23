/**
 * Technical skills, each with what it means in plain words, where a visitor can see it working on
 * this site, and where it was used in real work. Real-work lines must match content/work.ts.
 */
export interface Skill {
  id: string;
  name: string;
  tools: string[];
  plain: string;
  /** Where to see it on this site. */
  see: { label: string; href: string }[];
  /** Where it was used for real, as stated in content/work.ts. */
  real: string;
}

export const SKILLS: Skill[] = [
  {
    id: "routing",
    name: "Lead routing and scoring",
    tools: ["HubSpot", "n8n", "SQL"],
    plain:
      "Every new potential customer reaches the right salesperson within minutes, best ones first.",
    see: [
      { label: "AI agent", href: "#agent" },
      { label: "Simulator", href: "#simulator" },
    ],
    real: "BairesDev: business rules and lead scoring for a strategic-lead program.",
  },
  {
    id: "agents",
    name: "AI agents with human approval",
    tools: ["Claude API", "RAG", "Prompt safety"],
    plain:
      "Software that reads a message, decides what to do and drafts the answer, while a person signs off.",
    see: [{ label: "AI agent, real runs", href: "#agent" }],
    real: "BairesDev: AI-drafted messages with human approval, and a support agent that looks up answers.",
  },
  {
    id: "automation",
    name: "Workflow automation",
    tools: ["n8n", "Zapier", "Make"],
    plain: "Tools pass work to each other on their own, so nobody copies and pastes between them.",
    see: [{ label: "Playbooks", href: "#playbooks" }],
    real: "BairesDev (n8n), Bees2Biz (Make) and client systems at Sintropia.",
  },
  {
    id: "crm",
    name: "CRM setup and data quality",
    tools: ["HubSpot", "Zoho"],
    plain:
      "The customer database stays clean and complete, so routing, reports and forecasts can be trusted.",
    see: [{ label: "Playbook: CRM hygiene", href: "#hygiene" }],
    real: "Bees2Biz: HubSpot implementation for a U.S. client. Sintropia: a healthcare CRM in production.",
  },
  {
    id: "data",
    name: "Data analysis",
    tools: ["SQL", "Python", "Databricks"],
    plain: "Turning raw records into clear answers, dashboards and decisions.",
    see: [
      { label: "Case study", href: "/lab" },
      { label: "Simulator", href: "#simulator" },
    ],
    real: "BairesDev: KPI definitions, dashboards and cohort comparisons for the executive office.",
  },
  {
    id: "experiments",
    name: "Experiments and ROI",
    tools: ["A/B tests", "Control groups", "Simulation"],
    plain:
      "Showing in dollars whether a change worked, instead of guessing, and pricing it before it is built.",
    see: [
      { label: "Your company", href: "#diagnose" },
      { label: "Playbook: holdout", href: "#measurement" },
    ],
    real: "BairesDev: the A/B audit of the lead program (≈60% higher contract value, program-level).",
  },
  {
    id: "software",
    name: "Building working tools",
    tools: ["TypeScript", "React", "Next.js", "Automated tests"],
    plain: "Shipping software people use, not slides: this whole site is an example.",
    see: [{ label: "How it is built", href: "/architecture" }],
    real: "BairesDev: an internal AI-assisted app for the executive office, now on the production database.",
  },
];
