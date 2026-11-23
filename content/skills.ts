/**
 * Technical skills, each with what it does in a few plain words and where a visitor can see it
 * working on this site.
 */
export interface Skill {
  id: string;
  name: string;
  tools: string[];
  plain: string;
  /** Where to see it on this site. */
  see: { label: string; href: string }[];
}

export const SKILLS: Skill[] = [
  {
    id: "routing",
    name: "Lead routing and scoring",
    tools: ["HubSpot", "n8n", "SQL"],
    plain: "The right salesperson, within minutes, best leads first.",
    see: [
      { label: "AI agent", href: "#agent" },
      { label: "Simulator", href: "#simulator" },
    ],
  },
  {
    id: "agents",
    name: "AI agents with human approval",
    tools: ["Claude API", "RAG", "Prompt safety"],
    plain: "Reads, decides and drafts. A person signs off.",
    see: [{ label: "AI agent, real runs", href: "#agent" }],
  },
  {
    id: "automation",
    name: "Workflow automation",
    tools: ["n8n", "Zapier", "Make"],
    plain: "Tools hand work to each other. No copy and paste.",
    see: [{ label: "Playbooks", href: "#playbooks" }],
  },
  {
    id: "crm",
    name: "CRM setup and data quality",
    tools: ["HubSpot", "Zoho"],
    plain: "A clean customer database you can trust.",
    see: [{ label: "Playbook: CRM hygiene", href: "#hygiene" }],
  },
  {
    id: "data",
    name: "Data analysis",
    tools: ["SQL", "Python", "Databricks"],
    plain: "From raw records to clear answers.",
    see: [
      { label: "Case study", href: "/lab" },
      { label: "Simulator", href: "#simulator" },
    ],
  },
  {
    id: "experiments",
    name: "Experiments and ROI",
    tools: ["A/B tests", "Control groups", "Simulation"],
    plain: "Every change priced in dollars, and proven.",
    see: [
      { label: "Your company", href: "#diagnose" },
      { label: "Playbook: holdout", href: "#measurement" },
    ],
  },
  {
    id: "software",
    name: "Building working tools",
    tools: ["TypeScript", "React", "Next.js", "Automated tests"],
    plain: "Working software, like this site.",
    see: [{ label: "How it is built", href: "/architecture" }],
  },
];
