/**
 * Personal details shown on the site. Contact methods left as null are hidden, so nothing is
 * published until it has been confirmed.
 */
export const SITE = {
  name: "Juan Sebastián Arias",
  url: "https://heyjuanse.com",
  /** What the site is, for the browser tab, search results and link previews. */
  tagline: "A company you can watch, question and fix",
  description:
    "A working model of a company: watch customer requests move from first message to paid invoice, find where buyers give up waiting, and test which change is worth making. Simulated live, on made-up data.",
  /** The one sentence about the person behind it. */
  positioning:
    "I find where a business loses time and customers, and I build the rules, automations and AI steps that fix it.",
  repository: "https://github.com/juansebastian-arias/heyjuanse",
  contact: {
    email: "juan.arias2025@gmail.com" as string | null,
    linkedin: "https://www.linkedin.com/in/juansebastian-arias" as string | null,
    github: "https://github.com/juansebastian-arias" as string | null,
  },
} as const;
