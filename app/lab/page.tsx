import type { Metadata } from "next";
import { DecisionLab } from "@/components/lab/DecisionLab";

export const metadata: Metadata = {
  title: "Decision Lab",
  description:
    "Change the rules that route a fictional company's inbound leads and see who gets a sales call, who waits, and why. Synthetic data, SQL in the browser, stored AI outputs labeled with model and date.",
};

export default function LabPage() {
  return <DecisionLab />;
}
