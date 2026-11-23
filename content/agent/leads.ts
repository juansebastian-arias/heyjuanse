/**
 * The sales desk the live agent works on: Larkspur, the made-up company the site simulates, its
 * assignment rules and four sample requests. Every person and company here is invented.
 */
import { BASE } from "../../core/flow/company";

export const SELLER = {
  name: "Larkspur",
  sells: `Larkspur is route-planning software for companies that deliver with their own vehicles: it plans each day's routes around delivery time windows, gives drivers their stops in a phone app and warns dispatch when a delivery is running late. It costs USD ${BASE.pricePerVehicle} per vehicle per year, invoiced up front, and suits fleets of 5 to 2,500 vehicles.`,
  idealCustomer:
    "Companies that run their own delivery fleet of at least 5 vehicles: couriers and parcel carriers, food and beverage distributors, pharmacy and medical supply, furniture and appliance retailers. Not a fit: companies that hand all their deliveries to an outside carrier, passenger transport, and individuals.",
} as const;

export const OWNERS = {
  ana: {
    name: "Ana Ruiz",
    queue: "Fleets under 100 vehicles, Latin America",
    rule: "Fleets of 5 to 99 vehicles in Latin America, Spain or Portugal.",
  },
  ben: {
    name: "Ben Carter",
    queue: "Fleets under 100 vehicles, North America",
    rule: "Fleets of 5 to 99 vehicles in the United States or Canada.",
  },
  lena: {
    name: "Lena Fischer",
    queue: "Fleets under 100 vehicles, everywhere else",
    rule: "Fleets of 5 to 99 vehicles in any country Ana and Ben do not cover.",
  },
  priya: {
    name: "Priya Shah",
    queue: "Large fleets",
    rule: "Fleets of 100 vehicles or more, any region, and any security, procurement or integration request.",
  },
  support: {
    name: "Support team",
    queue: "Existing customers",
    rule: "Anyone who already uses Larkspur and reports a problem or asks how to do something.",
  },
  nurture: {
    name: "Follow-up emails",
    queue: "Not a fit yet",
    rule: "Fewer than 5 vehicles, companies with no fleet of their own, students, job seekers, vendors selling to us, and spam.",
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
    role: "Operations Manager",
    company: "Andes Freight",
    record:
      "Courier and freight, Bogotá, Colombia. 62 vehicles, 2 depots. Plans routes in spreadsheets. Visited the pricing page twice.",
    message:
      "Hi, we run 62 vans out of two depots in Bogotá and still plan routes in Excel every night. It takes our dispatcher three hours. Can you show me how Larkspur handles time windows for pharmacy deliveries? We want something running before December.",
  },
  {
    id: "northwind",
    arrived: "9:14",
    name: "Danielle Okafor",
    role: "Director of Logistics",
    company: "Northwind Foods",
    record: "Food distribution, Chicago, USA. About 480 vehicles across 9 depots.",
    message:
      "We're running an RFP for route planning that closes December 15. Please send your SOC 2 report and details on SSO and your API for our warehouse system, and tell me who would run a technical session with our IT team.",
  },
  {
    id: "pixel",
    arrived: "9:31",
    name: "Tom Becker",
    role: "Owner",
    company: "Pine Street Flowers",
    record: "Florist, Portland, USA. 1 van. No earlier contact on record.",
    message: "how much is it? it's just me and one van, about 15 drops a day",
  },
  {
    id: "brightline",
    arrived: "9:40",
    name: "Kenji Watanabe",
    role: "Dispatch Lead",
    company: "Brightline Parcel",
    record: "Parcel delivery, Toronto, Canada. 140 vehicles. Customer since March 2026.",
    message:
      "Since yesterday the driver app shows tomorrow's routes as empty for two of our depots. Nothing changed on our side. Can someone look today? Drivers start at 6.",
  },
];
