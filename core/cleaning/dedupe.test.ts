import { describe, expect, it } from "vitest";
import { company, leadsFrom, rawLead } from "../test/fixtures";
import { dedupe } from "./dedupe";
import { cleanRecord } from "./normalize";

const run = (...records: Parameters<typeof rawLead>[0][]) =>
  dedupe(records.map((r) => cleanRecord(rawLead(r))));

describe("dedupe", () => {
  it("M1 merges the same email regardless of case and +tags", () => {
    const result = run(
      { email: "ana.lopez@acme.example" },
      { email: "Ana.Lopez+webinar@acme.example", firstName: "ana" },
    );
    expect(result.groups).toHaveLength(1);
    expect(result.links[0]?.rule).toBe("M1");
  });

  it("M2 merges a nickname at the same company", () => {
    const result = run(
      { firstName: "Robert", lastName: "Smith", email: "robert.smith@acme.example" },
      { firstName: "Bob", lastName: "Smith", email: "bob.smith@acme.example" },
    );
    expect(result.groups).toHaveLength(1);
    expect(result.links[0]?.rule).toBe("M2");
    expect(result.links[0]?.reason).toContain('"Robert" and "Bob"');
  });

  it("M2 flags instead of merging when job titles conflict", () => {
    const result = run(
      {
        firstName: "Ana",
        lastName: "Lopez",
        email: "ana.lopez@acme.example",
        jobTitle: "IT Director",
      },
      {
        firstName: "Ana",
        lastName: "Lopez",
        email: "alopez@acme.example",
        jobTitle: "Logistics Manager",
      },
    );
    expect(result.groups).toHaveLength(2);
    expect(result.flags[0]?.rule).toBe("M2_TITLE_CONFLICT");
  });

  it("a chain of merges cannot join two people whose titles conflict", () => {
    const result = run(
      {
        firstName: "Ana",
        lastName: "Lopez",
        email: "ana.lopez@acme.example",
        jobTitle: "IT Director",
      },
      { firstName: "Ana", lastName: "Lopez", email: "alopez@acme.example", jobTitle: null },
      {
        firstName: "Ana",
        lastName: "Lopez",
        email: "ana@acme.example",
        jobTitle: "Logistics Manager",
      },
    );
    const sizes = result.groups.map((group) => group.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it("M3 flags look-alike first names and never merges them", () => {
    const result = run(
      { firstName: "Daniel", lastName: "King", email: "daniel.king@acme.example" },
      { firstName: "Daniela", lastName: "King", email: "daniela.king@acme.example" },
    );
    expect(result.groups).toHaveLength(2);
    expect(result.flags[0]?.rule).toBe("M3_SIMILAR_NAME");
  });

  it("does not match names across free email addresses", () => {
    const result = run(
      { firstName: "Ana", lastName: "Lopez", email: "ana.lopez1@freemail.example" },
      { firstName: "Ana", lastName: "Lopez", email: "ana.lopez2@freemail.example" },
    );
    expect(result.groups).toHaveLength(2);
    expect(result.flags).toHaveLength(0);
  });

  it("does not match the same name at different companies", () => {
    const result = run(
      { firstName: "Ana", lastName: "Lopez", email: "ana.lopez@acme.example" },
      { firstName: "Ana", lastName: "Lopez", email: "ana.lopez@other.example" },
    );
    expect(result.groups).toHaveLength(2);
  });
});

describe("merged leads", () => {
  it("take the lead id of the first submission and keep every source", () => {
    const first = rawLead({ email: "ana.lopez@acme.example", source: "webinar" });
    const second = rawLead({ email: "ana.lopez@acme.example", source: "demo_request" });
    const [lead] = leadsFrom([second, first]);
    expect(lead?.leadId).toBe(first.rawId.replace("R-", "L-"));
    expect(lead?.sources).toEqual(["webinar", "demo_request"]);
  });

  it("combine activity using the highest counts and the most recent date", () => {
    const [lead] = leadsFrom([
      rawLead({
        email: "ana.lopez@acme.example",
        activity: {
          pricingPageViews: 3,
          docsVisits: 0,
          webinarAttended: false,
          emailClicks: 1,
          lastActivityDaysAgo: 9,
        },
      }),
      rawLead({
        email: "ana.lopez@acme.example",
        activity: {
          pricingPageViews: 1,
          docsVisits: 2,
          webinarAttended: true,
          emailClicks: 0,
          lastActivityDaysAgo: 2,
        },
      }),
    ]);
    expect(lead?.activity).toEqual({
      pricingPageViews: 3,
      docsVisits: 2,
      webinarAttended: true,
      emailClicks: 1,
      lastActivityDaysAgo: 2,
    });
  });

  it("prefer a company email over a personal one", () => {
    const [lead] = leadsFrom([
      rawLead({ email: "ana.lopez@acme.example", firstName: "Ana", lastName: "Lopez" }),
      rawLead({ email: "ana.lopez@acme.example", firstName: "Ana", lastName: "Lopez" }),
    ]);
    expect(lead?.email).toBe("ana.lopez@acme.example");
  });

  it("are matched to the provider's company and fill a missing country", () => {
    const [lead] = leadsFrom(
      [rawLead({ country: null })],
      [company({ country: "MX", region: "latin_america" })],
    );
    expect(lead?.match?.method).toBe("email_domain");
    expect(lead?.country).toBe("MX");
    expect(lead?.countryFilledFromCompany).toBe(true);
    expect(lead?.region).toBe("latin_america");
  });

  it("are checked against the suppression list with +tags removed", () => {
    const [lead] = leadsFrom(
      [rawLead({ email: "Ana.Lopez+news@acme.example" })],
      [company()],
      ["ana.lopez@acme.example"],
    );
    expect(lead?.suppressed).toBe(true);
  });
});
