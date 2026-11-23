import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="page">
      <div className="plain">
        <p className="eyebrow">404</p>
        <h1>This page does not exist</h1>
        <p>
          The address may be mistyped, or the page may have been retired. The site is now one
          working simulation and the notes on how it is built.
        </p>
        <ul>
          <li>
            <Link href="/">The company</Link>
          </li>
          <li>
            <Link href="/engine">How it is built</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
