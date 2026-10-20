import { describe, expect, it } from "vitest";
import { rawLead } from "../test/fixtures";
import {
  canonicalFirstName,
  cleanRecord,
  companyKey,
  type FieldChange,
  normalizeCountry,
  normalizeEmail,
  normalizeName,
  normalizeTitle,
  normalizeWebsite,
} from "./normalize";

describe("normalizeName", () => {
  it("fixes all-lowercase and all-uppercase names and keeps particles lowercase", () => {
    const changes: FieldChange[] = [];
    expect(normalizeName("ana de la rosa", "firstName", changes)).toBe("Ana de la Rosa");
    expect(normalizeName("JOSÉ", "firstName", changes)).toBe("José");
    expect(normalizeName("o'brien-smith", "lastName", changes)).toBe("O'Brien-Smith");
    expect(changes.every((change) => change.reason === "Capitalization fixed")).toBe(true);
  });

  it("leaves mixed-case names alone apart from spacing", () => {
    const changes: FieldChange[] = [];
    expect(normalizeName("McDonald", "lastName", changes)).toBe("McDonald");
    expect(changes).toHaveLength(0);
    expect(normalizeName("  Mary  Ann ", "firstName", changes)).toBe("Mary Ann");
    expect(changes[0]?.reason).toBe("Extra spaces removed");
  });

  it("records a missing last name", () => {
    const changes: FieldChange[] = [];
    expect(normalizeName(null, "lastName", changes)).toBeNull();
    expect(changes[0]?.reason).toBe("Last name missing");
  });
});

describe("normalizeEmail", () => {
  it("lowercases and builds a matching key without +tags", () => {
    const result = normalizeEmail("Ana.Lopez+webinar@Acme.example", []);
    expect(result).toEqual({
      email: "ana.lopez+webinar@acme.example",
      emailKey: "ana.lopez@acme.example",
      domain: "acme.example",
      status: "valid",
    });
  });

  it.each(["n/a", "ana@", "ana at acme dot example", "test", "@acme.example", "ana@acme"])(
    "rejects %s",
    (value) => {
      const changes: FieldChange[] = [];
      expect(normalizeEmail(value, changes).status).toBe("invalid");
      expect(changes[0]?.reason).toBe("Not a valid email address");
    },
  );

  it("marks a missing email", () => {
    expect(normalizeEmail(null, []).status).toBe("missing");
    expect(normalizeEmail("   ", []).status).toBe("missing");
  });
});

describe("normalizeWebsite", () => {
  it.each([
    ["https://www.acme.example", "acme.example"],
    ["www.acme.example", "acme.example"],
    ["http://acme.example/", "acme.example"],
    ["https://acme.example/contact?x=1", "acme.example"],
    ["acme.example", "acme.example"],
  ])("reduces %s to its domain", (input, expected) => {
    expect(normalizeWebsite(input, [])).toBe(expected);
  });

  it("drops values that are not websites", () => {
    expect(normalizeWebsite("our website", [])).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it.each([
    ["United States", "US"],
    ["USA", "US"],
    ["U.S.", "US"],
    ["méxico", "MX"],
    ["Méx.", "MX"],
    ["Brasil", "BR"],
    ["Holland", "NL"],
    ["England", "GB"],
    ["DE", "DE"],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizeCountry(input, [])).toBe(expected);
  });

  it("does not record a change when the canonical name or code was typed", () => {
    const changes: FieldChange[] = [];
    normalizeCountry("United States", changes);
    normalizeCountry("US", changes);
    expect(changes).toHaveLength(0);
  });

  it("keeps unknown countries out instead of guessing", () => {
    const changes: FieldChange[] = [];
    expect(normalizeCountry("Atlantis", changes)).toBeNull();
    expect(changes[0]?.reason).toBe("Country not recognised");
  });
});

describe("companyKey", () => {
  it("ignores legal suffixes, accents, case and punctuation", () => {
    expect(companyKey("Plásticos Andina S.A. de C.V.")).toBe("plasticos andina");
    expect(companyKey("plasticos andina")).toBe("plasticos andina");
    expect(companyKey("Acme Manufacturing, Inc.")).toBe("acme manufacturing");
    expect(companyKey("Elbe Tools B.V.")).toBe("elbe tools");
  });
});

describe("normalizeTitle", () => {
  it("title-cases lowercase titles and keeps acronyms", () => {
    expect(normalizeTitle("vp supply chain", [])).toBe("VP Supply Chain");
    expect(normalizeTitle("director of it", [])).toBe("Director of IT");
    expect(normalizeTitle("Head of Logistics", [])).toBe("Head of Logistics");
  });
});

describe("canonicalFirstName", () => {
  it("maps nicknames and strips accents", () => {
    expect(canonicalFirstName("Bob")).toBe("robert");
    expect(canonicalFirstName("Sebas")).toBe("sebastian");
    expect(canonicalFirstName("Sebastián")).toBe("sebastian");
    expect(canonicalFirstName("Daniela")).toBe("daniela");
  });
});

describe("cleanRecord", () => {
  it("flags free email domains", () => {
    const record = cleanRecord(rawLead({ email: "ana99@freemail.example" }));
    expect(record.isFreemail).toBe(true);
    expect(cleanRecord(rawLead()).isFreemail).toBe(false);
  });
});
