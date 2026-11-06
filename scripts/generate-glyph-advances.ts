import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserType, chromium, firefox, webkit } from "@playwright/test";
import { fontDataFor } from "../packages/publisher/src/fontData/index.ts";
import { FONT_GALLERY, fontFamilySlug, tokenPx } from "../packages/schema/src/index.ts";
import { SCALES, TYPE_PAIRS } from "../packages/tokens/src/index.ts";

/**
 * **The advance of every glyph a menu label may carry, per shipped family and weight** (sprint 34
 * día 2, David's decision on the fold's estimate): what `headerWidths` in the renderer sums to know
 * how wide a bar's line is before any browser draws it. Written into
 * `packages/renderer/src/glyphAdvances.ts` as a generated module, in the style of the publisher's
 * `fontData` — in source, committed, never read from disk at run time.
 *
 * **Two steps since sprint 34 día 3**, because the letter is not the same on every machine (David's
 * decision of that day: «que Linux dibuje más ancho deja de ser una fórmula y pasa a ser un dato»):
 *
 * - `pnpm fonts:measure` draws every glyph, alone and with kerning off, in every engine installed on
 *   the machine it runs on — at 100 px, and at each of the six sizes the bar takes (`size.body` of the
 *   three scales, and 0.875 of each for the small bar) — and writes the widest per glyph into
 *   `scripts/glyph-measurements/<platform>.json`. CI runs it on Linux and keeps the file as an
 *   artifact; this Mac runs it in Chromium, Firefox and WebKit. Both files are committed.
 * - `pnpm fonts:advances` folds them into the table, with no browser: the advance in em of every
 *   glyph as macOS's Chromium draws it at 100 px — the measure of día 2, for a size the bar never
 *   takes — and, **at every size it does take, the widest any machine drew**. At 13.125 px Linux draws
 *   Poppins at least 3.5 % wider than macOS (hinting: a whole pixel where macOS draws a fraction), and
 *   a fold estimated from macOS alone let that bar break 2 px past it on CI.
 *
 * **One glyph at a time**: until día 3 it was ten copies, and a run of one letter is not a label — it
 * calls up the forms a font keeps for repeats («ff», «tt», Cormorant Garamond's «R» and «T»,
 * Manrope's «--»), and 63 of the 9 600 advances came out short, up to 0.15 em. The glyphs are
 * printable ASCII and what Spanish adds to it, plus the few marks a label has carried («Ir a…», a
 * dash, the euro).
 *
 * **A family the product does not ship** — the three type pairs' system stacks, an owner's own font —
 * reads `FALLBACK_ADVANCES`: the 95th percentile, glyph by glyph, over those six stacks as macOS's
 * Chromium draws them **and DejaVu Sans and Serif**, the letter a Linux machine — CI's among them —
 * draws `system-ui` and `serif` with: without it the fold of a `system-ui` site was 42–50 px short of
 * where its bar broke on CI (sprint 34 día 2, the first run of PR #351). DejaVu 2.37 is fetched into
 * `.scratch/fallback-fonts/` when absent; the renderer rounds every fallback glyph up to the pixel.
 */

const MEASUREMENTS = join(import.meta.dirname, "glyph-measurements");
const DEJAVU_URL =
  "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2";
const DEJAVU_DIR = join(import.meta.dirname, "../.scratch/fallback-fonts");
const DEJAVU_FACES = [
  { family: "DejaVu Sans", weight: 400, file: "DejaVuSans.ttf" },
  { family: "DejaVu Sans", weight: 700, file: "DejaVuSans-Bold.ttf" },
  { family: "DejaVu Serif", weight: 400, file: "DejaVuSerif.ttf" },
  { family: "DejaVu Serif", weight: 700, file: "DejaVuSerif-Bold.ttf" },
];

const ascii = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i));
const GLYPHS = [...ascii, ..."áéíóúüñÁÉÍÓÚÜÑ¿¡…«»—–€ºª·"];
const WEIGHTS = [400, 700] as const;
/**
 * **The labels the kerning margins are measured over** (David's decision of sprint 34 día 3: «el 1,5 %
 * no es una constante suelta»): the corpus's and the catalog's words, «Inicio», «Menú», «Ir a…», two
 * of twenty letters and a few that kern hard. Each is drawn whole, with kerning, against the sum of
 * its glyphs drawn alone; the widest ratio, per case, is what kerning can add to a label.
 */
const KERNING_LABELS = [
  "Taberna Santo Domingo",
  "Qué ponemos",
  "Dónde",
  "Contacto",
  "Menú",
  "Servicios",
  "Inicio",
  "Dónde estamos",
  "Barbería El Corte",
  "Nuestra carta",
  "Fotos de la casa",
  "Reservas para grupos",
  "Carta del día",
  "Vinos de la casa",
  "Raciones",
  "Postres",
  "Menú de grupos",
  "Terraza",
  "Reservar",
  "Carta",
  "Fotos",
  "Pide cita",
  "Horario",
  "Precios",
  "Equipo",
  "Opiniones",
  "Tratamientos",
  "Fisioterapia Avanzada",
  "Ir a…",
  "Llámanos",
  "Tarifas",
  "Talleres",
  "Visítanos",
  "Yoga y Pilates",
  "Wifi gratis",
  "El Corte",
  "Ávila",
  "Tú y yo",
];
/** The floors David set: 3 % in lower case (día 2), 1.5 % in capitals with the bar's letter-spacing
 * (día 3). A margin is the floor or the widest kerning measured, rounded up to the half point,
 * whichever is wider — a new family that kerns wider raises it, and `pnpm fonts:advances` says so. */
const KERNING_FLOORS = { lower: 1.03, upper: 1.015 } as const;

/** The digits of `BAR_EXCESS`: 0 to 63 16ths of a pixel. */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";

/** The sizes the bar draws its words at: `size.body` of every scale, and 0.875 of it when small —
 * the stylesheet's `calc(var(--size-body) * 0.875)`. */
const BAR_SIZES = [
  ...new Set(
    SCALES.flatMap((scale) => {
      const px = tokenPx(scale.sizes["size.body"]);
      return [px, px * 0.875];
    }),
  ),
].sort((a, b) => a - b);
const sizeKey = (size: number) => String(Math.round(size * 1000) / 1000);

/**
 * One machine's measure: per family, weight and size, each glyph's width in 64ths of a pixel — the
 * unit Chromium lays text out in; Firefox's 60ths are rounded up to it — the widest of the engines
 * measured, as one comma-separated row in `GLYPHS`'s order.
 */
interface Measurement {
  platform: string;
  engines: string[];
  glyphs: string;
  /** Family → weight → size (`sizeKey`) → row. */
  faces: Record<string, Record<string, Record<string, string>>>;
  /** macOS only: the system stacks the fallback is the widest of, at 100 px in Chromium. */
  system?: Record<string, Record<string, string>>;
  /** macOS only: the shipped faces at 100 px in Chromium alone, which the em table is. */
  chromium100?: Record<string, Record<string, string>>;
  /** The labels kerning was measured over, and per family and weight the widest ratio of a label
   * drawn whole to its glyphs drawn alone (the letter-spacing taken out of both), per case. */
  labels: string[];
  kerning: Record<string, Record<string, { lower: number; upper: number }>>;
}

const row = (widths: number[]) => widths.join(",");
const parse = (text: string | undefined, what: string): number[] => {
  if (text === undefined) throw new Error(`glyph measurements: no row for ${what}`);
  const out = text.split(",").map(Number);
  if (out.length !== GLYPHS.length || out.some((n) => !Number.isFinite(n))) {
    throw new Error(`glyph measurements: the row for ${what} is not ${GLYPHS.length} numbers`);
  }
  return out;
};

if (process.argv.includes("--measure")) await measure();
else write();

/** `pnpm fonts:measure`: this machine's letter, in every engine it has. */
async function measure(): Promise<void> {
  const mac = process.platform === "darwin";
  if (mac && !DEJAVU_FACES.every((f) => existsSync(join(DEJAVU_DIR, f.file)))) {
    mkdirSync(DEJAVU_DIR, { recursive: true });
    const archive = join(DEJAVU_DIR, "dejavu.tar.bz2");
    execFileSync("curl", ["-sL", "-o", archive, DEJAVU_URL]);
    execFileSync("tar", [
      "xjf",
      archive,
      "-C",
      DEJAVU_DIR,
      "--strip-components=2",
      ...DEJAVU_FACES.map((f) => `dejavu-fonts-ttf-2.37/ttf/${f.file}`),
    ]);
  }
  const faces = FONT_GALLERY.flatMap(({ family }) =>
    WEIGHTS.map((weight) => ({
      family,
      weight,
      file: `${fontFamilySlug(family)}-latin-${weight}-normal.woff2`,
    })),
  );
  const dejavu = mac ? DEJAVU_FACES : [];
  const css = [
    ...faces.map(
      (f) =>
        `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;src:url("/fonts/${f.file}") format("woff2")}`,
    ),
    ...dejavu.map(
      (f) =>
        `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;src:url("/dejavu/${f.file}") format("truetype")}`,
    ),
  ].join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;line-height:1} span{white-space:pre;display:inline-block}</style></head><body></body></html>`;
  const systems = [
    ...TYPE_PAIRS.flatMap((p) => [
      { name: `${p.id}/heading`, stack: p.fonts["font.heading"].replace(/^[^,]+,\s*/, "") },
      { name: `${p.id}/body`, stack: p.fonts["font.body"] },
    ]),
    { name: "linux/sans", stack: '"DejaVu Sans"' },
    { name: "linux/serif", stack: '"DejaVu Serif"' },
  ];

  const engines: [string, BrowserType][] = [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ];
  const out: Measurement = {
    platform: process.platform,
    engines: [],
    glyphs: GLYPHS.join(""),
    faces: {},
    labels: KERNING_LABELS,
    kerning: {},
  };
  const widest: Record<string, number[]> = {};
  for (const [name, type] of engines) {
    let installed = false;
    try {
      installed = existsSync(type.executablePath());
    } catch {
      installed = false;
    }
    if (!installed) {
      process.stderr.write(`fonts:measure: ${name} is not installed here; skipped.\n`);
      continue;
    }
    const browser = await type.launch();
    out.engines.push(`${name} ${browser.version()}`);
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
      if (url.pathname.startsWith("/dejavu/")) {
        return route.fulfill({
          contentType: "font/ttf",
          body: readFileSync(join(DEJAVU_DIR, url.pathname.slice(8))),
        });
      }
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto("http://glyphs.test/");
    const loaded = await page.evaluate(async () => {
      await Promise.allSettled([...document.fonts].map((face) => face.load()));
      return [...document.fonts].filter((face) => face.status === "loaded").length;
    });
    const wanted = faces.length + dejavu.length;
    if (loaded < wanted) throw new Error(`${name}: only ${loaded} of ${wanted} faces loaded`);

    /** Every glyph alone, kerning off, at a size: 64ths of a pixel, rounded up. All the spans are
     * laid out at once and read after, so a face costs one layout and not 120. */
    const draw = (stack: string, weight: number, size: number) =>
      page.evaluate(
        ({ stack, weight, size, glyphs }) => {
          const host = document.createElement("div");
          host.style.cssText = `font-family:${stack};font-weight:${weight};font-size:${size}px;font-kerning:none;`;
          const spans = glyphs.map((g) => {
            const span = document.createElement("span");
            span.textContent = g;
            host.append(span);
            return span;
          });
          document.body.append(host);
          const widths = spans.map((span) =>
            Math.ceil(span.getBoundingClientRect().width * 64 - 1e-6),
          );
          host.remove();
          return widths;
        },
        { stack, weight, size, glyphs: GLYPHS },
      );

    for (const { family } of FONT_GALLERY) {
      for (const weight of WEIGHTS) {
        for (const size of [100, ...BAR_SIZES]) {
          const widths = await draw(`"${family}"`, weight, size);
          const at = `${family}\t${weight}\t${sizeKey(size)}`;
          widest[at] = widths.map((w, i) => Math.max(w, widest[at]?.[i] ?? 0));
          if (mac && name === "chromium" && size === 100) {
            out.chromium100 ??= {};
            out.chromium100[family] ??= {};
            out.chromium100[family][weight] = row(widths);
          }
        }
      }
    }
    /** Each label whole, with kerning, against the sum of its glyphs alone, at 100 px: the widest
     * ratio, with the capitals' letter-spacing (0.06 em a glyph, after each one) out of both sides,
     * since the renderer adds it exactly and the margin is over the glyphs alone. */
    const kern = (family: string, weight: number, upper: boolean) =>
      page.evaluate(
        ({ family, weight, upper, labels }) => {
          const style = `font-family:"${family}";font-weight:${weight};font-size:100px;${upper ? "letter-spacing:6px;" : ""}`;
          let widest = 0;
          for (const label of labels) {
            const text = upper ? label.toUpperCase() : label;
            const host = document.createElement("div");
            host.style.cssText = style;
            const whole = document.createElement("span");
            whole.textContent = text;
            host.append(whole);
            const alone = [...text].map((g) => {
              const span = document.createElement("span");
              span.style.fontKerning = "none";
              span.textContent = g;
              host.append(span);
              return span;
            });
            document.body.append(host);
            const spacing = upper ? 6 * [...text].length : 0;
            const sum = alone.reduce((t, span) => t + span.getBoundingClientRect().width, 0);
            const ratio = (whole.getBoundingClientRect().width - spacing) / (sum - spacing);
            widest = Math.max(widest, ratio);
            host.remove();
          }
          return widest;
        },
        { family, weight, upper, labels: KERNING_LABELS },
      );
    for (const { family } of FONT_GALLERY) {
      for (const weight of WEIGHTS) {
        const lower = await kern(family, weight, false);
        const upper = await kern(family, weight, true);
        out.kerning[family] ??= {};
        const was = out.kerning[family][weight];
        out.kerning[family][weight] = {
          lower: Math.max(lower, was?.lower ?? 0),
          upper: Math.max(upper, was?.upper ?? 0),
        };
      }
    }
    if (mac && name === "chromium") {
      out.system = {};
      for (const { name: stackName, stack } of systems) {
        out.system[stackName] = {};
        for (const weight of WEIGHTS) {
          out.system[stackName][weight] = row(await draw(stack, weight, 100));
        }
      }
    }
    await browser.close();
  }
  if (out.engines.length === 0) throw new Error("fonts:measure: no engine is installed here");
  for (const [at, widths] of Object.entries(widest)) {
    const [family = "", weight = "", size = ""] = at.split("\t");
    out.faces[family] ??= {};
    out.faces[family][weight] ??= {};
    out.faces[family][weight][size] = row(widths);
  }
  mkdirSync(MEASUREMENTS, { recursive: true });
  const target = join(MEASUREMENTS, `${process.platform}.json`);
  writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`glyph measurements: ${out.engines.join(", ")} on ${process.platform} → ${target}`);
}

/** `pnpm fonts:advances`: the measurements of every machine, folded into the renderer's table. */
function write(): void {
  const read = (platform: string, how: string): Measurement => {
    const file = join(MEASUREMENTS, `${platform}.json`);
    if (!existsSync(file)) throw new Error(`fonts:advances: no ${file}. ${how}`);
    const m = JSON.parse(readFileSync(file, "utf8")) as Measurement;
    if (m.glyphs !== GLYPHS.join("")) {
      throw new Error(`fonts:advances: ${file} measured other glyphs; measure again`);
    }
    return m;
  };
  const mac = read("darwin", "`pnpm fonts:measure` on macOS writes it.");
  const linux = read(
    "linux",
    "CI's a11y-size job writes it: download the `glyph-measurements-linux` artifact of a run.",
  );
  const { chromium100, system } = mac;
  if (!chromium100 || !system) throw new Error("fonts:advances: darwin.json has no 100 px rows");
  for (const m of [mac, linux]) {
    if (JSON.stringify(m.labels) !== JSON.stringify(KERNING_LABELS) || !m.kerning) {
      throw new Error(`fonts:advances: ${m.platform}.json measured other labels; measure again`);
    }
  }

  // **The kerning margins**: per case, the floor David set or the widest kerning any machine
  // measured, rounded up to the half point, whichever is wider.
  const margins = { lower: 0, upper: 0 };
  const worst: Record<"lower" | "upper", string> = { lower: "", upper: "" };
  for (const kase of ["lower", "upper"] as const) {
    let widest = 0;
    for (const m of [mac, linux]) {
      for (const [family, weights] of Object.entries(m.kerning)) {
        for (const [weight, ratio] of Object.entries(weights)) {
          if (ratio[kase] > widest) {
            widest = ratio[kase];
            worst[kase] =
              `${(100 * (widest - 1)).toFixed(2)} % (${family} ${weight}, ${m.platform})`;
          }
        }
      }
    }
    margins[kase] = Math.max(KERNING_FLOORS[kase], Math.ceil(widest * 200 - 1e-9) / 200);
  }

  // The em table, as día 2 measured it: macOS's Chromium at 100 px, to the thousandth.
  const em = (u: number) => Math.round((u / 64) * 10) / 1000;
  const table: Record<string, Record<number, number[]>> = {};
  for (const { family } of FONT_GALLERY) {
    table[family] = {};
    for (const weight of WEIGHTS) {
      table[family][weight] = parse(chromium100[family]?.[weight], `${family} ${weight}`).map(em);
    }
  }

  /** The 95th percentile of the system stacks' advance of one glyph, by nearest rank: the value at
   * `ceil(0.95 × n)` of the sorted eight, which for eight is the widest — a visitor whose machine
   * draws the widest of them is drawn exactly, never short. */
  const p95 = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  };
  const fallback: Record<number, number[]> = {};
  for (const weight of WEIGHTS) {
    const rows = Object.entries(system).map(([name, weights]) =>
      parse(weights[weight], `${name} ${weight}`).map(em),
    );
    fallback[weight] = GLYPHS.map((_, i) => p95(rows.map((r) => r[i] ?? 0)));
  }

  // **At the bar's sizes, the widest any machine drew**, written as what it adds to `em × size`, in
  // 16ths of a pixel rounded up, one character a glyph: the table stays a table of em, and a size
  // the bar takes reads its excess. Never under the em, since the em is what macOS draws. 16ths and
  // not finer: Linux's hinted Poppins draws a bold glyph up to 1.95 px over macOS's.
  const excess: Record<string, Record<number, Record<string, string>>> = {};
  let most = 0;
  for (const { family } of FONT_GALLERY) {
    excess[family] = {};
    for (const weight of WEIGHTS) {
      excess[family][weight] = {};
      for (const size of BAR_SIZES) {
        const key = sizeKey(size);
        const what = `${family} ${weight} at ${key} px`;
        const a = parse(mac.faces[family]?.[weight]?.[key], `darwin ${what}`);
        const b = parse(linux.faces[family]?.[weight]?.[key], `linux ${what}`);
        const ems = table[family]?.[weight] ?? [];
        excess[family][weight][key] = GLYPHS.map((g, i) => {
          const drawn = Math.max(a[i] ?? 0, b[i] ?? 0) / 64;
          const over = Math.max(0, Math.ceil((drawn - (ems[i] ?? 0) * size) * 16 - 1e-6));
          if (over >= ALPHABET.length) {
            throw new Error(`fonts:advances: ${what} «${g}» is ${over / 16} px over its em`);
          }
          most = Math.max(most, over);
          return ALPHABET[over];
        }).join("");
      }
    }
  }

  const literal = (advances: number[]) =>
    `{ ${GLYPHS.map((g, i) => `${JSON.stringify(g)}: ${(advances[i] ?? 0).toFixed(3)}`).join(", ")} }`;
  const lines = [
    "// GENERATED by scripts/generate-glyph-advances.ts — do not edit by hand. Measure with",
    "// `pnpm fonts:measure` (on macOS; CI measures Linux), then regenerate with `pnpm fonts:advances`.",
    "//",
    "// The advance of every glyph a menu label may carry, per shipped family and weight — what",
    "// `headerWidths` sums to know how wide a bar's line is before any browser draws it (ADR 0067).",
    "// `GLYPH_ADVANCES` is in em, as macOS's Chromium draws one copy of each glyph at 100 px with",
    "// kerning off, to the thousandth. `BAR_EXCESS` is what each glyph adds to that at the sizes the",
    "// bar takes, from the widest any measured machine drew — Linux's hinted letter, at 13.125 px,",
    "// draws Poppins 3.5 % wider than macOS (sprint 34 día 3) — in 16ths of a pixel, one character of",
    "// `BAR_EXCESS_DIGITS` a glyph, in `GLYPHS`'s order. `FALLBACK_ADVANCES` is the 95th percentile,",
    "// glyph by glyph, over the three type pairs' six system stacks and DejaVu Sans and Serif, Linux's",
    "// letter for them: what a family the product does not ship — a system stack, an owner's own",
    "// font — is counted at.",
    `// Measured: macOS (${mac.engines.join(", ")}); Linux (${linux.engines.join(", ")}).`,
    "",
    "export type GlyphAdvances = Readonly<Record<string, number>>;",
    "export interface FamilyAdvances {",
    "  400: GlyphAdvances;",
    "  700: GlyphAdvances;",
    "}",
    "",
    `export const GLYPHS: readonly string[] = ${JSON.stringify(GLYPHS)};`,
    `export const BAR_SIZES: readonly number[] = ${JSON.stringify(BAR_SIZES)};`,
    `export const BAR_EXCESS_DIGITS = ${JSON.stringify(ALPHABET)};`,
    "",
    "/** The labels kerning was measured over, and the margin it leaves per case: the floor (3 % in",
    " * lower case, 1.5 % in capitals with the bar's letter-spacing) or the widest kerning measured,",
    ` * rounded up to the half point. Widest measured: lower case ${worst.lower}; capitals ${worst.upper}. */`,
    `export const KERNING_LABELS: readonly string[] = ${JSON.stringify(KERNING_LABELS)};`,
    `export const KERNING_MARGINS = ${JSON.stringify(margins)} as const;`,
    "",
    "export const GLYPH_ADVANCES: Readonly<Record<string, FamilyAdvances>> = {",
    ...Object.entries(table).map(
      ([family, w]) =>
        `  ${JSON.stringify(family)}: { 400: ${literal(w[400] ?? [])}, 700: ${literal(w[700] ?? [])} },`,
    ),
    "};",
    "",
    "/** Family → weight → bar size → one digit of `BAR_EXCESS_DIGITS` a glyph, in `GLYPHS`'s order. */",
    "export const BAR_EXCESS: Readonly<",
    "  Record<string, Readonly<Record<400 | 700, Readonly<Record<string, string>>>>>",
    "> = {",
    ...Object.entries(excess).map(
      ([family, w]) =>
        `  ${JSON.stringify(family)}: { 400: ${JSON.stringify(w[400])}, 700: ${JSON.stringify(w[700])} },`,
    ),
    "};",
    "",
    `export const FALLBACK_ADVANCES: FamilyAdvances = { 400: ${literal(fallback[400] ?? [])}, 700: ${literal(fallback[700] ?? [])} };`,
    "",
  ];
  const target = join(import.meta.dirname, "../packages/renderer/src/glyphAdvances.ts");
  writeFileSync(target, lines.join("\n"));
  console.log(
    `glyph advances: ${FONT_GALLERY.length} families, ${GLYPHS.length} glyphs, ` +
      `${BAR_SIZES.length} bar sizes, at most ${most / 16} px over the em; kerning margins ` +
      `${JSON.stringify(margins)} (widest: lower ${worst.lower}, capitals ${worst.upper}) → ${target}`,
  );
}
