/**
 * Larkspur's customers. Every request is generated from a seed, and carries a key that settles
 * everything chance decides about it: when it is sent, how big the fleet is, whether the company
 * is a fit, whether it would accept the quote, how long it is willing to wait at each step and
 * how long each team takes over it. Two versions of the company that share a seed therefore meet
 * exactly the same customers, and a difference in their results was caused by how they work, not
 * by luck.
 *
 * The same idea makes the assumptions comparable. Candidates are drawn at a fixed rate and then
 * kept or dropped against a threshold, so "20% more requests" adds requests to the ones already
 * there, and "fewer say yes" turns some of the same buyers into non-buyers.
 */
import { createRng, hashString } from "../random";
import { CLOSE, DAY, OPEN } from "./calendar";
import { chance } from "./chance";
import { type Assumptions, BASE, STATION_IDS } from "./company";
import { normalQuantile } from "./dist";
import { FIRST_FREE_QUESTION, type Request } from "./engine";

/** Candidates are drawn at this multiple of today's volume, so volume can be raised by up to half. */
export const VOLUME_HEADROOM = 1.5;

/** What chance decides about a request before it reaches the first team. */
const Q_KEEP = FIRST_FREE_QUESTION;
const Q_WHEN = Q_KEEP + 1;
const Q_MINUTE = Q_KEEP + 2;
const Q_FIT = Q_KEEP + 3;
const Q_ACCEPT = Q_KEEP + 4;
const Q_SIGN = Q_KEEP + 5;
const Q_FLEET = Q_KEEP + 6;
const Q_NAME = Q_KEEP + 7;
const Q_TRADE = Q_KEEP + 8;

const FIRST = [
  "Andes",
  "Kestrel",
  "Harbor",
  "Summit",
  "Heron",
  "Cedar",
  "Pioneer",
  "Tidewater",
  "Granite",
  "Vega",
  "Alba",
  "Norte",
  "Maple",
  "Juniper",
  "Orchard",
  "Lakeshore",
  "Redwood",
  "Copper",
  "Monarch",
  "Sierra",
  "Pampa",
  "Coral",
  "Prairie",
  "Falcon",
  "Harvest",
  "Bayside",
  "Cobalt",
  "Sable",
  "Linden",
  "Mesa",
  "Arroyo",
  "Quill",
  "Tamarind",
  "Ember",
  "Osprey",
  "Caldera",
  "Marlow",
  "Yarrow",
  "Tundra",
  "Zafra",
  "Brisa",
  "Ceiba",
  "Dorado",
  "Fresno",
  "Sauce",
  "Olmo",
] as const;
const SECOND = [
  "Couriers",
  "Freight",
  "Delivery",
  "Logistics",
  "Distribution",
  "Express",
  "Foods",
  "Pharma Supply",
  "Furniture",
  "Parcel",
  "Beverages",
  "Flowers",
  "Laundry",
  "Medical Supply",
  "Hardware",
  "Bakery Group",
  "Office Supply",
  "Cargo",
  "Produce",
  "Dairy",
  "Appliances",
  "Building Supply",
  "Water",
  "Auto Parts",
] as const;

const FLEET_MIN = 4;
const FLEET_MAX = 2500;

export type Demand = (calendarDay: number) => readonly Request[];

const clamp = (u: number) => Math.min(1 - 1e-12, Math.max(1e-12, u));

/** The requests Larkspur receives, day by day, for one seed and one set of assumptions. */
export function demandFor(seed: number, a: Assumptions = BASE): Demand {
  const days = new Map<number, Request[]>();
  const stations = STATION_IDS.length;
  const closedMinutes = DAY - (CLOSE - OPEN);
  return (day) => {
    const known = days.get(day);
    if (known) return known;
    const rng = createRng(hashString(`larkspur:${seed}:${day}`));
    const weekend = ((day % 7) + 7) % 7 >= 5;
    const baseRate = weekend ? BASE.requestsPerWeekendDay : BASE.requestsPerWeekday;
    const rate = weekend ? a.requestsPerWeekendDay : a.requestsPerWeekday;
    const keepShare = Math.min(1, rate / (baseRate * VOLUME_HEADROOM));
    // The number of candidates and each one's key depend only on the seed and the day. Every
    // assumption acts on a candidate through its key, so changing one assumption never changes
    // who the other candidates are.
    const candidates = rng.poisson(baseRate * VOLUME_HEADROOM);
    const requests: Request[] = [];
    for (let i = 0; i < candidates; i++) {
      const key = Math.floor(rng.next() * 4294967296);
      if (chance(key, Q_KEEP) >= keepShare) continue;
      const uMinute = chance(key, Q_MINUTE);
      let minute: number;
      if (weekend) minute = uMinute * DAY;
      else if (chance(key, Q_WHEN) < a.officeHoursShare) minute = OPEN + uMinute * (CLOSE - OPEN);
      else {
        const offset = uMinute * closedMinutes;
        minute = offset < OPEN ? offset : CLOSE + (offset - OPEN);
      }
      const spread = Math.exp(a.vehiclesSigma * normalQuantile(clamp(chance(key, Q_FLEET))));
      const fleet = Math.round(Math.min(FLEET_MAX, Math.max(FLEET_MIN, a.vehiclesMedian * spread)));
      const exitAfter =
        chance(key, Q_FIT) >= a.fitShare
          ? 0
          : chance(key, Q_ACCEPT) >= a.acceptShare
            ? 1
            : chance(key, Q_SIGN) >= a.signShare
              ? 2
              : stations;
      const first = FIRST[Math.floor(chance(key, Q_NAME) * FIRST.length)] ?? FIRST[0];
      const second = SECOND[Math.floor(chance(key, Q_TRADE) * SECOND.length)] ?? SECOND[0];
      requests.push({
        id: day * 1000 + i,
        at: day * DAY + minute,
        value: fleet * a.pricePerVehicle,
        exitAfter,
        key,
        label: `${first} ${second}`,
        size: fleet,
      });
    }
    requests.sort((x, y) => x.at - y.at || x.id - y.id);
    days.set(day, requests);
    return requests;
  };
}

/** Would this customer buy if nobody ever made them wait? */
export function isBuyer(request: Request): boolean {
  return request.exitAfter === STATION_IDS.length;
}
