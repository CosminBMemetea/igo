/** @type {import("next").NextConfig} */
// Antete de securitate de bază. CSP doar cu directive care nu ating hărțile/tile-urile (fără script-src/img-src stricte).
const SECURITY = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];
// This application serves its own validated files and does not use next/image.
module.exports = { images: { unoptimized: true }, reactStrictMode: true, poweredByHeader: false, async headers() { return [{ source: "/:path*", headers: SECURITY }]; } };
