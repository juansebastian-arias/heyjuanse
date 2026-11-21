"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

const LINKS = [
  { href: "/#simulator", label: "Simulator" },
  { href: "/#playbooks", label: "Playbooks" },
  { href: "/work", label: "Work" },
  { href: "/lab", label: "Case study" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={styles.nav}>
      <ul className={styles.links}>
        {LINKS.map((link) => {
          const current =
            !link.href.includes("#") &&
            (pathname === link.href || pathname.startsWith(`${link.href}/`));
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={styles.link}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
