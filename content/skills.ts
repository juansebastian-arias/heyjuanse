/**
 * What I build for a sales team, each in a few plain words, with the tools I use for it and where
 * a visitor can see it working on this site. Only tools I have really used are listed.
 */
export interface Skill {
  id: string;
  name: string;
  /** What it does for the team, in plain words. */
  plain: string;
  tools: string[];
  /** Where to see it working on this site. */
  see: { label: string; href: string };
}

export const SKILLS: Skill[] = [
  {
    id: "routing",
    name: "Lead routing",
    plain: "Every new lead reaches the right salesperson in seconds, day or night.",
    tools: ["HubSpot", "n8n", "Zapier"],
    see: { label: "Try it above", href: "#agent" },
  },
  {
    id: "agents",
    name: "AI agents with approval",
    plain: "AI reads each lead, checks the CRM and drafts the reply. A person approves.",
    tools: ["Claude API", "RAG", "n8n"],
    see: { label: "Try it above", href: "#agent" },
  },
  {
    id: "scoring",
    name: "Lead scoring",
    plain: "The best leads are worked first. The rest get automatic follow-up.",
    tools: ["HubSpot", "SQL", "Python"],
    see: { label: "See it in the Decision Lab", href: "/lab" },
  },
  {
    id: "crm",
    name: "CRM cleanup",
    plain: "No duplicates or missing fields, so reports match reality.",
    tools: ["HubSpot", "Zoho", "Make"],
    see: { label: "How it works", href: "/simulator#hygiene" },
  },
  {
    id: "automation",
    name: "Workflow automation",
    plain: "Your tools pass work to each other. No copy and paste.",
    tools: ["n8n", "Zapier", "Make"],
    see: { label: "Six examples", href: "/simulator#playbooks" },
  },
  {
    id: "measurement",
    name: "Measurement",
    plain: "Every change is tested against a control group and reported in meetings and money.",
    tools: ["SQL", "Python", "Databricks"],
    see: { label: "Try the simulator", href: "/simulator" },
  },
];
