import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { fontDataFor } from "../packages/publisher/src/fontData/index.ts";
import { FONT_GALLERY, fontFamilySlug } from "../packages/schema/src/index.ts";
import { TYPE_PAIRS } from "../packages/tokens/src/index.ts";

/**
 * **The advance of every glyph a menu label may carry, per shipped family and weight** (sprint 34
 * día 2, David's decision on the fold's estimate): what `headerWidths` in the renderer sums to know
 * how wide a bar's line is before any browser draws it. Written into
 * `packages/renderer/src/glyphAdvances.ts` as a generated module, in the style of the publisher's
 * `fontData` — in source, committed, never read from disk at run time — with
 * `pnpm fonts:advances`.
 *
 * Measured in Chromium with every shipped face loaded from the publisher's own bytes (the three
 * engines agreed to three decimals on 5 November 2026): ten copies of the glyph at 100 px, kerning
 * off, so the number is the glyph's own advance in em. The glyphs are printable ASCII and what
 * Spanish adds to it, plus the few marks a label has carried («Ir a…», a dash, the euro). **A family
 * the product does not ship** — the three type pairs' system stacks, an owner's own font — reads
 * `FALLBACK_ADVANCES`: the 95th percentile, glyph by glyph, over those six stacks measured on the
 * machine that generated this file.
 */

const ascii = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i));
const GLYPHS = [...ascii, ..."áéíóúüñÁÉÍÓÚÜÑ¿¡…«»—–€ºª·"];

const faces = FONT_GALLERY.flatMap(({ family }) =>
  [400, 700].map((weight) => ({
    family,
    weight,
    file: `${fontFamilySlug(family)}-latin-${weight}-normal.woff2`,
  })),
);
const css = faces
  .map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;src:url("/fonts/${f.file}") format("woff2")}`,
  )
  .join("\n");
const families = FONT_GALLERY.map(({ family }) => ({ name: family, stack: `"${family}"` }));
const systems = TYPE_PAIRS.flatMap((p) => [
  { name: `${p.id}/heading`, stack: p.fonts["font.heading"].replace(/^[^,]+,\s*/, "") },
  { name: `${p.id}/body`, stack: p.fonts["font.body"] },
]);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;font-size:100px;line-height:1} span{white-space:pre;display:inline-block}</style></head><body></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
  if (url.pathname.startsWith("/fonts/")) {
    const data = fontDataFor(url.pathname.slice(7));
    return data
      ? route.fulfill({ contentType: "font/woff2", body: Buffer.from(data) })
      : route.fulfill({ status: 404, body: "" });
  }
  return route.fulfill({ status: 404, body: "" });
});
await page.goto("http://glyphs.test/");
await page.evaluate(
  async (names: string[]) => {
    await Promise.all(
      names.flatMap((f) => [
        document.fonts.load(`400 16px "${f}"`),
        document.fonts.load(`700 16px "${f}"`),
      ]),
    );
  },
  FONT_GALLERY.map((f) => f.family),
);
const loaded = await page.evaluate(
  () => [...document.fonts].filter((f) => f.status === "loaded").length,
);
if (loaded < faces.length) throw new Error(`only ${loaded} of ${faces.length} faces loaded`);

type Advances = Record<string, number>;
async function measure(stack: string, weight: number): Promise<Advances> {
  return page.evaluate(
    ({ stack, weight, glyphs }: { stack: string; weight: number; glyphs: string[] }) => {
      const host = document.createElement("div");
      host.style.cssText = `font-family:${stack};font-weight:${weight};font-kerning:none;`;
      document.body.append(host);
      const out: Record<string, number> = {};
      for (const g of glyphs) {
        const span = document.createElement("span");
        span.textContent = g.repeat(10);
        host.append(span);
        out[g] = Math.round(span.getBoundingClientRect().width) / 1000;
        span.remove();
      }
      host.remove();
      return out;
    },
    { stack, weight, glyphs: GLYPHS },
  );
}

const table: Record<string, { 400: Advances; 700: Advances }> = {};
for (const { name, stack } of families) {
  table[name] = { 400: await measure(stack, 400), 700: await measure(stack, 700) };
}
const system: { 400: Advances; 700: Advances }[] = [];
for (const { stack } of systems) {
  system.push({ 400: await measure(stack, 400), 700: await measure(stack, 700) });
}
await browser.close();

/** The 95th percentile of the system stacks' advance of one glyph, by nearest rank: the value at
 * `ceil(0.95 × n)` of the sorted six, which for six is the widest — a visitor whose machine draws the
 * widest of them is drawn exactly, never short. */
function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}
const fallback = {
  400: Object.fromEntries(GLYPHS.map((g) => [g, p95(system.map((s) => s[400][g] ?? 0))])),
  700: Object.fromEntries(GLYPHS.map((g) => [g, p95(system.map((s) => s[700][g] ?? 0))])),
};

const literal = (advances: Advances) =>
  `{ ${GLYPHS.map((g) => `${JSON.stringify(g)}: ${(advances[g] ?? 0).toFixed(3)}`).join(", ")} }`;
const lines = [
  "// GENERATED by scripts/generate-glyph-advances.ts — do not edit by hand. Regenerate with",
  "// `pnpm fonts:advances`.",
  "//",
  "// The advance of every glyph a menu label may carry, in em, per shipped family and weight — what",
  "// `headerWidths` sums to know how wide a bar's line is before any browser draws it (ADR 0067).",
  "// Measured in Chromium with the publisher's own bytes, ten copies of each glyph at 100 px with",
  "// kerning off; the three engines agreed to three decimals on 5 November 2026. `FALLBACK_ADVANCES`",
  "// is the 95th percentile, glyph by glyph, over the three type pairs' six system stacks as this",
  "// machine drew them: what a family the product does not ship — a system stack, an owner's own",
  "// font — is counted at.",
  "",
  "export type GlyphAdvances = Readonly<Record<string, number>>;",
  "export interface FamilyAdvances {",
  "  400: GlyphAdvances;",
  "  700: GlyphAdvances;",
  "}",
  "",
  "export const GLYPH_ADVANCES: Readonly<Record<string, FamilyAdvances>> = {",
  ...Object.entries(table).map(
    ([family, w]) =>
      `  ${JSON.stringify(family)}: { 400: ${literal(w[400])}, 700: ${literal(w[700])} },`,
  ),
  "};",
  "",
  `export const FALLBACK_ADVANCES: FamilyAdvances = { 400: ${literal(fallback[400])}, 700: ${literal(fallback[700])} };`,
  "",
];
const target = join(import.meta.dirname, "../packages/renderer/src/glyphAdvances.ts");
writeFileSync(target, lines.join("\n"));
console.log(`glyph advances: ${families.length} families, ${GLYPHS.length} glyphs → ${target}`);
