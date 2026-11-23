/**
 * The inbound desk the live agent works on: a fictional company that sells a revenue analytics
 * product, its routing rules and four sample leads. Every person and company here is invented.
 */

export const SELLER = {
  name: "Larkspur",
  sells:
    "Larkspur is a revenue analytics platform for B2B companies: it connects the CRM, shows where pipeline is stuck and alerts reps when a deal goes quiet. Plans start at USD 1,500 a month; it suits companies with 50 to 5,000 employees and a sales team of at least five people.",
  idealCustomer:
    "B2B companies with 50 to 5,000 employees, a sales team of five or more, and a CRM (HubSpot, Salesforce or Zoho). Software, logistics, health and financial services fit best.",
} as const;

export const OWNERS = {
  ana: {
    name: "Ana Ruiz",
    queue: "Mid-market, Latin America",
    rule: "Companies with 50 to 500 employees in Latin America, Spain or Portugal.",
  },
  ben: {
    name: "Ben Carter",
    queue: "Mid-market, North America and Europe",
    rule: "Companies with 50 to 500 employees anywhere except Latin America, Spain and Portugal.",
  },
  priya: {
    name: "Priya Shah",
    queue: "Enterprise",
    rule: "Companies with more than 500 employees, any region, and any security or procurement request.",
  },
  support: {
    name: "Support team",
    queue: "Existing customers",
    rule: "Anyone who already uses Larkspur and reports a problem or asks how to do something.",
  },
  nurture: {
    name: "Nurture emails",
    queue: "Not a fit yet",
    rule: "Companies below 50 employees, students, job seekers, vendors selling to us, and spam.",
  },
} as const;

export type OwnerId = keyof typeof OWNERS;
export const OWNER_IDS = Object.keys(OWNERS) as OwnerId[];

export interface SampleLead {
  id: string;
  arrived: string;
  name: string;
  role: string;
  company: string;
  /** What the CRM or enrichment already knows about the company. */
  record: string;
  message: string;
}

export const SAMPLE_LEADS: SampleLead[] = [
  {
    id: "andes",
    arrived: "9:02",
    name: "Mariana López",
    role: "Head of Sales Operations",
    company: "Andes Freight",
    record:
      "Logistics, Bogotá, Colombia. About 220 employees. Uses HubSpot. Visited pricing twice.",
    message:
      "Hi, we just hired 8 SDRs and our inbound leads sit in a shared inbox for days before anyone answers. Can you show me how Larkspur would flag that with HubSpot? We want something running before Q1.",
  },
  {
    id: "northwind",
    arrived: "9:14",
    name: "Danielle Okafor",
    role: "VP Revenue Operations",
    company: "Northwind Health",
    record: "Health services, Chicago, USA. About 2,300 employees. Uses Salesforce.",
    message:
      "We're evaluating pipeline analytics vendors in an RFP that closes December 15. Please send your SOC 2 report and details on SSO, and tell me who would run a technical session with our team.",
  },
  {
    id: "pixel",
    arrived: "9:31",
    name: "Tom Becker",
    role: "Founder",
    company: "Pixel & Pine",
    record: "Design studio, Portland, USA. 6 employees. No CRM on record.",
    message: "how much is it? it's just me and my partner, we want to keep track of a few clients",
  },
  {
    id: "brightline",
    arrived: "9:40",
    name: "Kenji Watanabe",
    role: "Sales Manager",
    company: "Brightline Software",
    record: "Software, Toronto, Canada. About 140 employees. Customer since March 2026.",
    message:
      "Since yesterday the stuck-deals dashboard shows no data for my team. Nothing changed on our side. Can someone look today? We use it in our Monday forecast.",
  },
];
