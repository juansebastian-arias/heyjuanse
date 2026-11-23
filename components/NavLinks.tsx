"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

const LINKS = [
  { href: "/#project", label: "90-day plan" },
  { href: "/#agent", label: "AI agent" },
  { href: "/#skills", label: "Skills" },
  { href: "/#simulator", label: "Simulator" },
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
