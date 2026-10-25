/** Pure rules for the Curse segment pager (no React Native imports, so smoke tests can load it directly). */

/** Page currently shown for a horizontal offset. */
export function pageAt(x: number, w: number, n: number) {
  return w > 0 && n > 0 ? Math.max(0, Math.min(n - 1, Math.round(x / w))) : 0;
}

/** Default segment: the first non-empty one (Acum, then Următoarele), else the last (Terminate). */
export function defaultSeg(counts: readonly number[]) {
  const i = counts.findIndex(c => c > 0);
  return i < 0 ? Math.max(0, counts.length - 1) : i;
}

/**
 * Segment to show after the counts change while the screen is open.
 * A segment the app picked follows the data. A segment the driver picked stays,
 * unless it just became empty (e.g. the trip moved from Acum to Terminate).
 */
export function reconcileSeg(seg: number, picked: boolean, prev: readonly number[], counts: readonly number[]) {
  if (!picked) return defaultSeg(counts);
  if ((prev[seg] ?? 0) > 0 && (counts[seg] ?? 0) === 0) return defaultSeg(counts);
  return Math.max(0, Math.min(counts.length - 1, seg));
}

/**
 * Offset the pager must jump to (without animation) so it shows page `want`, or null when
 * no jump is needed or none can work yet. On Android a scrollTo before the pages are laid out
 * is clamped to 0, so wait until the width and the full content width are known.
 */
export function alignOffset(p: { w: number; contentW: number; n: number; x: number; want: number; busy: boolean }) {
  if (p.busy || p.w <= 0 || p.n <= 0 || p.contentW < p.w * p.n - 1) return null;
  const tx = Math.max(0, Math.min(p.n - 1, p.want)) * p.w;
  return Math.abs(p.x - tx) < 1 ? null : tx;
}
