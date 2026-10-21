import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE } from "@/site.config";
import "./globals.css";

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
// Body text only uses the regular weight, upright and italic. Asking for that one weight makes the
// two files 40 KB instead of 103 KB for the full variable font.
const body = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-body",
  display: "swap",
  style: ["normal", "italic"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.positioning,
  openGraph: {
    title: SITE.name,
    description: SITE.positioning,
    url: SITE.url,
    siteName: SITE.name,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f0" },
    { media: "(prefers-color-scheme: dark)", color: "#111316" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
