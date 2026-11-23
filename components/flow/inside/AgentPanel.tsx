import styles from "../Inside.module.css";
import { AgentDemo, type AgentWorth } from "./AgentDemo";

/** The one AI step among the changes, running for real instead of being described. */
export function AgentPanel({ worth }: { worth: AgentWorth }) {
  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        One of the changes above lets AI draft the first reply while a person approves it. This is
        that step, working: it reads a request, decides who should own it under Larkspur's rules,
        and writes the reply for a person to edit, approve or reject. Nothing is ever sent.
      </p>
      <AgentDemo worth={worth} />
      <ul className={styles.notes}>
        <li>
          The four sample requests replay real recorded runs of this agent, so watching costs
          nothing. Your own request is a live call to the model, limited to five an hour per
          visitor.
        </li>
        <li>
          In the simulation this step does exactly one thing: a reply takes {worth.draftedMinutes}{" "}
          minutes of a rep's time instead of {worth.manualMinutes}. Nothing is assumed about AI
          writing better replies or winning more customers.
        </li>
      </ul>
    </div>
  );
}
