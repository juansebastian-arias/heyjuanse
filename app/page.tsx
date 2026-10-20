import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { LobbyMarks } from "@/components/LobbyMarks";
import { lobbySnapshot } from "@/lib/server/lobby";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

const WAYS_IN = [
  {
    href: "/lab",
    title: "Decision Lab",
    kicker: "About a minute, no sign-up",
    text: "A fictional company, a week of messy inbound leads and too few sales calls. Change the rules, watch every lead move, and open any one to see why it went where it did.",
    cta: "Open the Decision Lab",
  },
  {
    href: "/architecture",
    title: "Under the hood",
    kicker: "Ten minutes, for technical reviewers",
    text: "The requirements, the rule catalogue, the SQL, the AI contract, the tests and the decisions behind them, all generated from the code that runs the lab.",
    cta: "View the architecture",
  },
  {
    href: "/work",
    title: "Selected work",
    kicker: "Professional experience",
    text: "GTM systems, analytics and AI automation at BairesDev, CRM and automation projects at Sintropia, and earlier work in business analysis and logistics. Kept separate from the demo.",
    cta: "Explore my work",
  },
];

const PRINCIPLES = [
  {
    title: "Start from the decision, not the tool.",
    text: "The lab begins with a business constraint, a fixed number of sales calls, and every rule exists to spend them well.",
    href: "/architecture#rules",
    link: "Read the rules",
  },
  {
    title: "Make every number show its work.",
    text: "Each metric in the lab is a SQL query that runs in your browser, and a test keeps it identical to the reference code.",
    href: "/lab",
    link: "Open a query",
  },
  {
    title: "Use AI where rules cannot read, and let a person decide when it is unsure.",
    text: "A model reads free-text messages once, offline. Its answers are checked against the message, and doubtful ones go to human review.",
    href: "/architecture#ai",
    link: "See the AI contract",
  },
  {
    title: "Design the failure states, not just the happy path.",
    text: "Typos, duplicates, look-alike names and prompt injections are planted in the data on purpose. The data quality report shows how each one was handled, mistakes included.",
    href: "/lab?view=hood",
    link: "Open the report",
  },
];

export default function Home() {
  const snapshot = lobbySnapshot();
  return (
    <>
      <section className={`page ${styles.hero}`} aria-labelledby="home-title">
        <div className={styles.intro}>
          <h1 id="home-title" className={styles.name}>
            {SITE.name}
          </h1>
          <p className={styles.claim}>I design and build the systems revenue teams run on.</p>
          <p className={styles.subclaim}>
            Clean data, explainable decisions, and automation and AI that know when to ask a human.
          </p>
          <ul className={styles.specialties} aria-label="Specialties">
            {SITE.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Link href="/lab" className="button" data-variant="primary">
              Open the Decision Lab
            </Link>
            <Link href="/work" className="button">
              Selected work
            </Link>
            <Link href="/about#contact" className="button" data-variant="quiet">
              Get in touch
            </Link>
          </div>
        </div>
        <div className={styles.visual}>
          <LobbyMarks snapshot={snapshot} />
        </div>
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="ways-title">
        <h2 id="ways-title" className={styles.sectionTitle}>
          Three ways in
        </h2>
        <ul className={styles.ways}>
          {WAYS_IN.map((way) => (
            <li key={way.href} className={styles.way}>
              <p className="eyebrow">{way.kicker}</p>
              <h3 className={styles.wayTitle}>{way.title}</h3>
              <p className={styles.wayText}>{way.text}</p>
              <Link href={way.href} className={styles.wayLink}>
                {way.cta} <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="principles-title">
        <h2 id="principles-title" className={styles.sectionTitle}>
          How I work, and where you can check it
        </h2>
        <ol className={styles.principles}>
          {PRINCIPLES.map((principle, index) => (
            <li key={principle.title} className={styles.principle}>
              <span className={styles.index} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className={styles.principleTitle}>{principle.title}</h3>
                <p className={styles.principleText}>{principle.text}</p>
                <Link href={principle.href} className={styles.principleLink}>
                  {principle.link}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className={`page ${styles.section} ${styles.contact}`}
        aria-labelledby="contact-title"
      >
        <div>
          <h2 id="contact-title" className={styles.sectionTitle}>
            Get in touch
          </h2>
          <p className={styles.contactText}>
            Questions about the lab, the code or my work are welcome.
          </p>
        </div>
        <ContactLinks />
      </section>
    </>
  );
}
