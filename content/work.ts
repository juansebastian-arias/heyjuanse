/**
 * Selected work. Every line here must be verifiable and cleared for publication. Employer and
 * client systems are confidential, so entries describe the work, not the systems: no internal
 * data, workflows or client names. Titles and dates match the public LinkedIn profile.
 *
 * The only figures are program-level results that were cleared for publication. They are shown
 * with that label, because they belong to a wider initiative and not to one person's work.
 */
export interface WorkItem {
  title: string;
  text: string;
  /** Tools and methods used in this work, as verified. */
  tools?: string[];
  /** A cleared result of the wider program, always shown as program-level. */
  programResult?: string;
}

export interface WorkRole {
  title: string;
  period: string;
}

export interface WorkEntry {
  id: string;
  organization: string;
  /** Shown next to the organization when it explains the role, such as part-time or contract. */
  engagement?: string;
  /** Most recent first. */
  roles: WorkRole[];
  summary: string;
  items: WorkItem[];
  note?: string;
}

export const WORK: WorkEntry[] = [
  {
    id: "bairesdev",
    organization: "BairesDev",
    roles: [{ title: "Office of the CEO Analyst", period: "January 2024 – present" }],
    summary:
      "A large international technology services company. My work spans sales operations, GTM systems, business analytics, executive operations and internal AI automation.",
    items: [
      {
        title: "AI-assisted lead prioritization",
        text: "Owned the downstream actioning, decisioning and automation architecture for a strategic-lead initiative: enrichment and analysis, business rules and lead scoring, retrieval of context for each lead, AI-assisted message preparation with human review and approval, operational tracking, and the audit framework used to measure commercial outcomes.",
        tools: ["SQL", "Databricks", "n8n", "RAG", "LLM agents"],
        programResult:
          "In an A/B test, the contacted cohort generated approximately 60% higher contract value than the control group, and approximately 26% of contacted cases surfaced actionable needs that later converted into closed contracts. These are results of the whole initiative, not of my contribution alone.",
      },
      {
        title: "Executive relationship intelligence",
        text: "Moved a manual, spreadsheet-based LinkedIn operating process for the executive office to an internal AI-assisted application with message classification, opportunity routing, relationship intelligence and network analysis. Built it with AI-assisted development and coordinated its migration to the corporate production database. Also built a tool that checks the relationships between contacts across internal and external platforms.",
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
    engagement: "Part-time",
    roles: [{ title: "Co-founder and CTO", period: "October 2025 – present" }],
    summary:
      "A small technology implementation company I co-founded. I lead the design and implementation of CRM, automation and AI-enabled business systems for clients, from requirements and process design to architecture, integrations and delivery.",
    items: [
      {
        title: "Healthcare: CRM and operations system",
        text: "An end-to-end CRM and operational system covering customer acquisition, lead management, workflows, integrations and automation. In production.",
      },
      {
        title: "Real estate: CRM and business workflows",
        text: "CRM and workflow solutions covering lead management, customer interactions and property-related processes.",
      },
    ],
    note: "Client details are confidential. Case studies will follow when clients approve them.",
  },
  {
    id: "bees2biz",
    organization: "Bees2Biz",
    engagement: "Contract",
    roles: [
      { title: "Manager, Customer Success", period: "March 2023 – November 2023" },
      { title: "Business Analyst", period: "June 2022 – March 2023" },
    ],
    summary:
      "Requirements engineering, process modeling and CRM implementation, working directly with customers.",
    items: [
      {
        title: "CRM implementation and automation",
        text: "Client-facing CRM implementations, business process design and workflow automation, including implementing and customizing HubSpot for a U.S. tax-services client, automations in Make and CRM integrations.",
        tools: ["HubSpot", "Make"],
      },
      {
        title: "From business process to working software",
        text: "Translated product requirements and user stories into BPMN process models, functional workflows and implementation-ready documentation for developers: process steps, decision points, validations, dependencies and expected system behavior.",
        tools: ["BPMN"],
      },
    ],
  },
  {
    id: "flexport",
    organization: "Flexport",
    roles: [
      { title: "GTC Team Lead", period: "December 2021 – July 2023" },
      { title: "Logistics Coordinator", period: "February 2021 – December 2021" },
    ],
    summary:
      "Logistics operations for the U.S. market. As a coordinator I managed shipments, monitored execution and resolved operational exceptions with internal teams and external partners. As team lead I led operational execution and team coordination across complex workflows and cross-functional communication.",
    items: [],
  },
  {
    id: "amazon",
    organization: "Amazon",
    roles: [{ title: "CSA, Logistics", period: "June 2020 – February 2021" }],
    summary:
      "Resolved issues between customers and Amazon.com’s supply chain for the U.S. market and improved communication between stakeholders. Recognized in the Excellence Club for outstanding metrics in October 2020.",
    items: [],
  },
];

export const EDUCATION = {
  degree: "Industrial Engineering",
  school: "Pontificia Universidad Javeriana",
  country: "Colombia",
};
