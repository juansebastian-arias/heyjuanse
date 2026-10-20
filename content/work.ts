/**
 * Selected work. Every line here must be verifiable and cleared for publication. Employer and
 * client systems are confidential, so entries describe the work, not the systems: no internal
 * data, workflows, metrics or client names.
 *
 * Program-level results stay out of this file until they are cleared for public use.
 */
export interface WorkItem {
  title: string;
  text: string;
  /** Tools and methods used in this work, as verified. */
  tools?: string[];
}

export interface WorkEntry {
  id: string;
  organization: string;
  role: string;
  period: string | null;
  summary: string;
  items: WorkItem[];
  note?: string;
}

export const WORK: WorkEntry[] = [
  {
    id: "bairesdev",
    organization: "BairesDev",
    role: "Office of the CEO Analyst",
    period: "January 2024 – present",
    summary:
      "A large international technology services company. My work spans sales operations, GTM systems, business analytics, executive operations and internal AI automation.",
    items: [
      {
        title: "AI-assisted lead prioritization",
        text: "Owned the downstream actioning, decisioning and automation architecture for a strategic-lead initiative: enrichment and analysis, business rules and lead scoring, retrieval of context for each lead, AI-assisted message preparation with human review and approval, operational tracking, and experiments to measure commercial impact.",
        tools: ["SQL", "Databricks", "n8n", "RAG", "LLM agents"],
      },
      {
        title: "Executive relationship intelligence",
        text: "Moved a manual, spreadsheet-based LinkedIn operating process for the executive office to an internal AI-assisted application with message classification, opportunity routing, relationship intelligence and network analysis. Built it with AI-assisted development and coordinated its migration to the corporate production database.",
      },
      {
        title: "Business analytics and experimentation",
        text: "KPI definitions, dashboards, cohort comparisons and analysis of operational data to evaluate initiatives and support business decisions.",
        tools: ["SQL", "Databricks"],
      },
      {
        title: "Other applied AI and GTM work",
        text: "A retrieval-augmented support agent for program participants, prospect enrichment, intent-signal analysis and executive opportunity research.",
      },
    ],
    note: "These systems are confidential. Nothing on this site is taken from them: the Decision Lab is an independent design built on synthetic data.",
  },
  {
    id: "sintropia",
    organization: "Sintropia",
    role: "Co-founder and CTO, part-time",
    period: "January 2026 – present",
    summary:
      "A small technology implementation company: CRM, automation, business systems, AI-enabled workflows and data for client businesses.",
    items: [
      {
        title: "Healthcare: CRM and operations system",
        text: "An end-to-end CRM and operational system covering customer acquisition, lead management, workflows, integrations and automation. In production.",
      },
    ],
    note: "Client details are confidential. Case studies will follow when clients approve them.",
  },
  {
    id: "bees2biz",
    organization: "Bees2Biz",
    role: "Business Analyst, then Manager, Customer Success",
    period: null,
    summary:
      "Requirements engineering, process modeling and CRM implementation, working directly with customers.",
    items: [
      {
        title: "From business process to working software",
        text: "Modeled processes in BPMN, analyzed requirements and translated them into software workflows, and designed operational processes with customers.",
        tools: ["BPMN"],
      },
      {
        title: "CRM implementation and integration",
        text: "Implemented HubSpot, built automations in Make and integrated CRMs with other systems in customer-facing implementations.",
        tools: ["HubSpot", "Make"],
      },
    ],
  },
  {
    id: "logistics",
    organization: "Flexport and Amazon",
    role: "Logistics operations",
    period: null,
    summary:
      "Operational execution, coordination and team leadership in logistics: the day-to-day reality that business systems have to serve.",
    items: [],
  },
];

export const EDUCATION = {
  degree: "Industrial Engineering",
  school: "Pontificia Universidad Javeriana",
  country: "Colombia",
};
