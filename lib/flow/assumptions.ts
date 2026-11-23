/**
 * Every number the model takes as given, in words, for the page to list next to its results.
 * Each row names the assumptions it shows, so a test can prove that none is left out.
 */
import {
  type Assumptions,
  LEVER_IDS,
  LEVERS,
  STATION_IDS,
  STATIONS,
  type StationId,
} from "@/core/flow/company";
import { percent } from "./format";

export interface AssumptionRow {
  label: string;
  value: string;
  /** The assumptions this row shows. */
  keys: ReadonlyArray<keyof Assumptions>;
}

export interface AssumptionGroup {
  title: string;
  rows: AssumptionRow[];
}

const trim = (value: number) => String(Math.round(value * 100) / 100);

export const dollars = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** One value per team, in the order work flows: "Reply 1 · Quote 4 · ...". */
function perTeam<T>(values: Record<StationId, T>, format: (value: T) => string): string {
  return STATION_IDS.map((id) => `${STATIONS[id].name} ${format(values[id])}`).join(" · ");
}

export function assumptionGroups(a: Assumptions): AssumptionGroup[] {
  return [
    {
      title: "Demand",
      rows: [
        {
          label: "Requests on a weekday",
          value: trim(a.requestsPerWeekday),
          keys: ["requestsPerWeekday"],
        },
        {
          label: "Requests on a Saturday or Sunday",
          value: trim(a.requestsPerWeekendDay),
          keys: ["requestsPerWeekendDay"],
        },
        {
          label: "Weekday requests sent between 9:00 and 18:00",
          value: percent(a.officeHoursShare),
          keys: ["officeHoursShare"],
        },
      ],
    },
    {
      title: "Customers",
      rows: [
        {
          label: "Requests from companies Larkspur can serve",
          value: percent(a.fitShare),
          keys: ["fitShare"],
        },
        {
          label: "Of those, companies that say yes to the quote",
          value: percent(a.acceptShare),
          keys: ["acceptShare"],
        },
        {
          label: "Accepted quotes that get signed",
          value: percent(a.signShare),
          keys: ["signShare"],
        },
        {
          label: "Fleet size",
          value: `median ${trim(a.vehiclesMedian)} vehicles (lognormal, sigma ${trim(a.vehiclesSigma)})`,
          keys: ["vehiclesMedian", "vehiclesSigma"],
        },
        {
          label: "Price per vehicle for the first year, invoiced up front",
          value: dollars(a.pricePerVehicle),
          keys: ["pricePerVehicle"],
        },
        {
          label: "Days until half the customers waiting at a step have gone elsewhere",
          value: perTeam(a.patienceDays, (days) => (days === null ? "they wait" : trim(days))),
          keys: ["patienceDays"],
        },
        {
          label: "Spread of that patience (lognormal sigma)",
          value: perTeam(a.patienceSigma, (sigma) => (sigma === 0 ? "–" : trim(sigma))),
          keys: ["patienceSigma"],
        },
        {
          label: "Days a customer takes to pay a correct invoice",
          value: `median ${trim(a.paymentDays)} (lognormal, sigma ${trim(a.paymentSigma)})`,
          keys: ["paymentDays", "paymentSigma"],
        },
      ],
    },
    {
      title: "Teams",
      rows: [
        {
          label: "Times a day a manager hands out new requests",
          value: trim(a.handoutsPerDay),
          keys: ["handoutsPerDay"],
        },
        { label: "People", value: perTeam(a.people, trim), keys: ["people"] },
        {
          label: "Hours a day each person gives to this work",
          value: perTeam(a.hoursPerDay, trim),
          keys: ["hoursPerDay"],
        },
        {
          label: "Hands-on minutes per item, on average",
          value: perTeam(a.touchMinutes, trim),
          keys: ["touchMinutes"],
        },
        {
          label: "How much hands-on time varies",
          value: `${percent(a.touchSpread)} of its average (lognormal)`,
          keys: ["touchSpread"],
        },
        {
          label: "Hand-typed invoices with a mistake the customer disputes",
          value: percent(a.invoiceErrorShare),
          keys: ["invoiceErrorShare"],
        },
        {
          label: "Days before a disputed invoice is back on the clerk's desk",
          value: trim(a.disputeDays),
          keys: ["disputeDays"],
        },
      ],
    },
    {
      title: "What each change does",
      rows: [
        {
          label: "Minutes to check and send a reply the AI drafted",
          value: trim(a.draftedReplyMinutes),
          keys: ["draftedReplyMinutes"],
        },
        {
          label: "Minutes per call and quote when the quote is filled in",
          value: trim(a.draftedQuoteMinutes),
          keys: ["draftedQuoteMinutes"],
        },
        {
          label: "Minutes of setup when customers upload their own data",
          value: trim(a.selfServeSetupMinutes),
          keys: ["selfServeSetupMinutes"],
        },
        {
          label: "Minutes to check an invoice created from the contract",
          value: trim(a.syncedInvoiceMinutes),
          keys: ["syncedInvoiceMinutes"],
        },
        {
          label: "Invoices created from the contract that still have a mistake",
          value: percent(a.syncedInvoiceErrorShare),
          keys: ["syncedInvoiceErrorShare"],
        },
        {
          label: "Contracts at list price with standard terms, which a rule can approve",
          value: percent(a.standardShare),
          keys: ["standardShare"],
        },
      ],
    },
    {
      title: "Money",
      rows: [
        {
          label: "Share of a sale left after the cost of serving the customer",
          value: percent(a.margin),
          keys: ["margin"],
        },
        {
          label: "Monthly cost of one more person",
          value: perTeam(a.monthlyCost, dollars),
          keys: ["monthlyCost"],
        },
        {
          label: "Model usage per reply the AI drafts",
          value: dollars(a.costPerDraft),
          keys: ["costPerDraft"],
        },
        ...LEVER_IDS.map(
          (id): AssumptionRow => ({
            label: `Cost of “${LEVERS[id].name}”`,
            value: `${dollars(LEVERS[id].monthly)} a month, ${dollars(LEVERS[id].setup)} to build`,
            keys: [],
          }),
        ),
      ],
    },
  ];
}
