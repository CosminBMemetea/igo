/** Browser mutations must come from this exact origin, including across sibling subdomains.
 * Native clients and authenticated schedulers do not send browser Origin/Fetch Metadata.
 * Their existing bearer/capability checks remain required.
 */
export function trustedMutationOrigin(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const site = req.headers.get("sec-fetch-site"), origin = req.headers.get("origin");
  if (site === "cross-site") return false;
  if (origin !== null) return origin === new URL(req.url).origin;
  return site === null || site === "same-origin" || site === "none";
}
