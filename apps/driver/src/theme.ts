/** Same tokens as the web /driver screens (src/app/globals.css, dark theme). */
export const C = {
  bg: "#0b0b0c", bg2: "#141416", bg3: "#1c1c1f",
  fg: "#f4f4f5", fg2: "#a1a1aa", fg3: "#5f5f66",
  line: "rgba(244,244,245,0.11)",
  acc: "#3e6ae1", accBtn: "#365fce", pos: "#34d399", neg: "#f87171", priv: "#a78bfa", warn: "#f5a524",
  posInk: "#04140d", privInk: "#160b33",
};
/** color-mix(in srgb, a p%, b) for #rrggbb inputs. */
export function mix(a: string, p: number, b: string) {
  const h = (x: string) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [x, y] = [h(a), h(b)];
  return `#${x.map((v, i) => Math.round(v * p / 100 + y[i] * (100 - p) / 100).toString(16).padStart(2, "0")).join("")}`;
}
export const F = { regular: "Inter-Regular", medium: "Inter-Medium", semi: "Inter-SemiBold", bold: "Inter-Bold" };
