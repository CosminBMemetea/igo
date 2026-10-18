/** Canonical origin for outbound email links; never trust an incoming Host header. */
export function appOrigin() {
  const raw = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://igo-kappa.vercel.app");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("APP_URL must be a canonical HTTPS origin");
  return url.origin;
}
