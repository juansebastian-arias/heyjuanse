/**
 * Automation playbooks. Each one is a design for an independent, fictional company: none of them
 * is a copy of an employer's or client's system. `simulator` names the switch in the GTM simulator
 * that models the playbook's effect, when there is one.
 */
import type { AutomationId } from "@/core/gtm/model";

export interface Playbook {
  id: string;
  name: string;
  /** The business problem, in one line. */
  problem: string;
  trigger: string;
  steps: string[];
  /** Where a person stays in charge, or what keeps it safe. */
  guardrail: string;
  /** The number it is judged by. */
  metric: string;
  tools: string[];
  simulator?: AutomationId;
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "speed-to-lead",
    name: "Speed-to-lead router",
    problem: "Demo requests wait a day in a shared inbox while they go cold.",
    trigger: "A demo form is submitted",
    steps: [
      "Match the person to an existing contact and account",
      "Enrich company size, industry and role",
      "Score fit and intent",
      "Assign an owner by territory, account and rep capacity",
      "Alert the rep with context; escalate if untouched after 15 minutes",
    ],
    guardrail:
      "Every assignment is logged with its reason; anything ambiguous goes to a fallback queue.",
    metric: "Median minutes to first touch",
    tools: ["n8n", "HubSpot", "SQL", "Slack"],
    simulator: "instantRouting",
  },
  {
    id: "ai-research",
    name: "AI research and first draft, a rep approves",
    problem: "Reps spend 25 minutes researching and writing each first touch.",
    trigger: "A lead is assigned to a rep",
    steps: [
      "An agent reads the company site, recent news and CRM history",
      "It writes a short account brief with sources",
      "It drafts a three-step sequence in the company's voice",
      "The rep edits and approves; nothing is sent without approval",
      "The final message and the edits are saved for evaluation",
    ],
    guardrail:
      "Claims are checked against their sources, untrusted text cannot give the agent instructions, and a person sends.",
    metric: "Minutes per first touch and meeting rate",
    tools: ["Claude API", "RAG", "n8n", "HubSpot"],
    simulator: "aiDrafts",
  },
  {
    id: "signals",
    name: "Buying-signal outbound",
    problem: "Good accounts that were not ready last quarter are forgotten.",
    trigger: "A pricing-page visit, a hiring post, a funding round or a champion changes jobs",
    steps: [
      "Collect signals from web, product and data providers",
      "Match each signal to a target account",
      "Weigh signal strength and recency",
      "Create a rep task with the signal and a suggested angle",
    ],
    guardrail: "One alert per account per week, so reps trust the alerts instead of muting them.",
    metric: "Meetings from re-engaged accounts",
    tools: ["n8n", "Zapier", "SQL", "Claude API"],
    simulator: "signals",
  },
  {
    id: "pql",
    name: "Product-qualified leads",
    problem: "Thousands of trial sign-ups and no way to see who is getting value.",
    trigger: "Trial usage crosses a threshold that predicts conversion",
    steps: [
      "Stream product events to the warehouse",
      "Compute usage scores in SQL, by account",
      "Send high scores to a rep, the rest to in-product nudges",
    ],
    guardrail: "Thresholds are re-checked monthly against which trials actually converted.",
    metric: "Trial-to-paid conversion by score band",
    tools: ["SQL", "Python", "Databricks", "HubSpot"],
    simulator: "scoring",
  },
  {
    id: "hygiene",
    name: "CRM hygiene, every night",
    problem: "Duplicates and empty fields break routing, scoring and reporting.",
    trigger: "Nightly, and on every new record",
    steps: [
      "Find duplicates by email, domain and fuzzy name match",
      "Merge safe matches; queue doubtful ones for a person",
      "Fill missing fields through an enrichment waterfall",
      "Report what changed",
    ],
    guardrail: "Merges are reversible and every change is logged.",
    metric: "Duplicate rate and field completeness",
    tools: ["Make", "Python", "HubSpot", "Zoho"],
    simulator: "dedupe",
  },
  {
    id: "measurement",
    name: "Prove it with a holdout",
    problem: "Teams ship automations and never know if they paid off.",
    trigger: "Any new automation or campaign",
    steps: [
      "Hold back a random control group",
      "Track meetings, pipeline and contract value for both groups",
      "Report the lift weekly, with the uncertainty",
      "Keep, change or switch off the automation",
    ],
    guardrail: "Decide the success metric before the test starts.",
    metric: "Lift over the control group",
    tools: ["SQL", "Python", "Databricks", "Dashboards"],
  },
];
