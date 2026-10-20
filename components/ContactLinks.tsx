import { SITE } from "@/site.config";
import styles from "./ContactLinks.module.css";

/** Contact methods from site.config.ts. Anything not yet confirmed there is left out. */
export function ContactLinks() {
  const { email, linkedin, github } = SITE.contact;
  const links = [
    email ? { label: "Email", value: email, href: `mailto:${email}` } : null,
    linkedin
      ? { label: "LinkedIn", value: linkedin.replace(/^https?:\/\/(www\.)?/, ""), href: linkedin }
      : null,
    github
      ? { label: "GitHub", value: github.replace(/^https?:\/\/(www\.)?/, ""), href: github }
      : null,
  ].filter((link) => link !== null);
  return (
    <ul className={styles.list}>
      {links.map((link) => (
        <li key={link.label}>
          <span className={styles.label}>{link.label}</span>
          <a
            href={link.href}
            className={styles.value}
            rel={link.label === "Email" ? undefined : "me"}
          >
            {link.value}
          </a>
        </li>
      ))}
    </ul>
  );
}
