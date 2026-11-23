import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Next.js inlines small scripts for hydration, so script-src needs 'unsafe-inline' on a static
// site (nonces would force every page to render on demand). The simulation runs in web workers
// served from this origin. Nothing is loaded from anywhere else.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** Pages from earlier versions of the site. Old links land on the page that replaced them. */
const RETIRED: ReadonlyArray<[source: string, destination: string]> = [
  ["/work", "/"],
  ["/about", "/"],
  ["/simulator", "/"],
  ["/lab", "/"],
  ["/architecture", "/engine"],
  ["/colophon", "/engine"],
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The home page simulates the starting plan while it is built, which takes a while on a slow
  // machine. The default limit of 60 seconds is too close for comfort.
  staticPageGenerationTimeout: 300,
  async redirects() {
    return RETIRED.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
