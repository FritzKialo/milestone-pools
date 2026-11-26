import type { NextConfig } from "next";

/**
 * Security headers for every route.
 * - No framing (frame-ancestors / X-Frame-Options): the app triggers wallet transactions, so another site must not
 *   be able to embed it and trick people into clicking (clickjacking). Change this if the app is ever embedded on purpose.
 * - script-src is not restricted here: Next's inline scripts would need per-request nonces, and the wallet libraries
 *   load from several hosts. Add it only with a nonce setup and after testing the wallet flows.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  // Static export cannot send headers; the IPFS gateway serving the files decides them.
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
} else {
  nextConfig.headers = async () => [{ source: "/:path*", headers: securityHeaders }];
}

module.exports = nextConfig;
