import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { EMPTY_ANSWERS, generate, VARIANTS } from "@retorika/generator";
import { hasSamplePhotos, recordById } from "@retorika/photobank";
import { readSampleBytes } from "@retorika/photobank/server";
import { flattenElements, parseDocument } from "@retorika/schema";
import { type LaunchedChrome, launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSite, readFontBundle, type SiteBundle } from "../src/index.ts";

/**
 * Protocol Part 8.5: «Lighthouse de 95 o más en rendimiento y accesibilidad sobre un sitio de
 * muestra.» Written down in sprint 2 and never measured until 12 October 2026 (sprint 18 day 2).
 *
 * **Why here and not in the renderer.** The protocol says *a sample site*, and a site is what
 * `buildSite` produces: the page, its fonts and their licences, the photographs, `robots.txt`. The
 * renderer produces a page. Lighthouse's performance score is about bytes over a slow network, and
 * the bytes a real owner's visitor downloads are the bundle's — a page measured without its font
 * files would score something nobody ships.
 *
 * **Why a real HTTP server and not Playwright's route interception.** Lighthouse drives its own
 * page over the DevTools protocol, so the `page.route` tricks the a11y suites use are invisible to
 * it. The bundle is served from memory by `node:http` on a free port — nothing written to disk,
 * the same discipline `/api/download` keeps. Chrome is the one Playwright already installed, so CI
 * downloads one browser, not two, and the cache key the a11y job uses serves this one as well.
 *
 * **Which site.** The same «Taberna del Puerto» that `scripts/size-budget.ts` weighs, in the three
 * compositions, on the one sector whose bank is filled. The business name is fixed, so the
 * photograph is fixed: the generator has no clock and no randomness. If the bank ever empties for
 * this sector the test fails rather than quietly measuring a site with no photograph in it.
 *
 * **Mobile.** Lighthouse's default — simulated slow 4G and a mid-tier phone — because that is how
 * a neighbourhood bar's website is actually opened. It is the harder of the two presets, which is
 * the one a floor should be measured against.
 *
 * Performance and accessibility are floors; the protocol names those two. **Best practices is held
 * at full marks since sprint 28 day 4** (ADR 0054): its only missing four points from sprint 18 on
 * were the browser asking for `/favicon.ico`, which no bundle had, and the 404 counting as a console
 * error. The bundle carries its icon now, so anything that costs a point there is new and should
 * say so. SEO is printed so the number is seen, and nothing more.
 */

const SECTOR = "restaurante-bar";
const FLOOR = 0.95;
/** Best practices, whole (ADR 0054). */
const BEST_PRACTICES = 1;

type Measured = {
  label: string;
  scores: Record<string, number>;
  lcpMs: number;
  cls: number;
  tbtMs: number;
  /** Every scored audit that did not get full marks, so a 96 says what the missing four are. */
  short: string[];
  /** Wall-clock seconds the audit itself took, apart from serving and closing. */
  auditSeconds: number;
};

/** A generated site of the sample sector, with its photograph read from the bank. */
function sampleSite(variant: (typeof VARIANTS)[number]): SiteBundle {
  const site = generate(
    {
      ...EMPTY_ANSWERS,
      businessName: "Taberna del Puerto",
      sector: SECTOR,
      services: ["Comidas", "Cenas", "Terraza"],
      address: "Muelle 3, Ronda",
      mainAction: "book",
      bookingLink: "https://reservas.example.com/taberna",
    },
    variant,
  );
  const assets = new Map<string, Uint8Array>();
  for (const page of site.document.pages) {
    for (const section of page.sections) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
        const record = el.value.sample === undefined ? undefined : recordById(el.value.sample);
        if (!record)
          throw new Error(`lighthouse: ${el.value.src} is neither a bank sample nor inline`);
        assets.set(el.value.src, readSampleBytes(record.id));
      }
    }
  }
  return buildSite(site.document, {
    siteId: "lighthouse",
    assets,
    fonts: readFontBundle(site.document),
  });
}

/** Serves one bundle from memory. `/` is `index.html`; anything the bundle lacks is a 404. */
/**
 * A page drawn per entry (ADR 0040), as a fourth subject: the twelve-entry fixture's site, audited
 * on one of its drawn files rather than on the home page. No generated site has a page per entry,
 * so without this the three compositions above would never measure one.
 */
function fichaSite(): { bundle: SiteBundle; path: string } {
  const fixtures = join(import.meta.dirname, "..", "..", "..", "fixtures");
  const document = parseDocument(
    JSON.parse(readFileSync(join(fixtures, "documents", "una-pagina-por-ficha.json"), "utf8")),
  );
  const assets = new Map<string, Uint8Array>();
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
        assets.set(el.value.src, readFileSync(join(fixtures, el.value.src)));
      }
    }
  }
  return {
    bundle: buildSite(document, {
      siteId: "lighthouse-ficha",
      assets,
      fonts: readFontBundle(document),
    }),
    path: "/ensaladilla-rusa.html",
  };
}

function serve(bundle: SiteBundle): Promise<{ server: Server; origin: string }> {
  const files = new Map(bundle.files.map((file) => [`/${file.path}`, file]));
  const server = createServer((request, response) => {
    const path = request.url === "/" ? "/index.html" : (request.url ?? "/");
    const file = files.get(path);
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": file.contentType,
      "content-length": file.contents.byteLength,
    });
    response.end(Buffer.from(file.contents));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

let chrome: LaunchedChrome;

beforeAll(async () => {
  chrome = await launch({
    chromePath: chromium.executablePath(),
    // `--no-sandbox` is what a CI runner needs; headless is what nobody watching needs.
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
});

afterAll(async () => {
  await chrome?.kill();
});

async function measure(label: string, bundle: SiteBundle, path = "/"): Promise<Measured> {
  const { server, origin } = await serve(bundle);
  try {
    const started = performance.now();
    const result = await lighthouse(`${origin}${path}`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    if (!result) throw new Error(`lighthouse returned nothing for ${label}`);
    const { lhr } = result;
    const scores: Record<string, number> = {};
    for (const [id, category] of Object.entries(lhr.categories)) {
      if (category.score === null) throw new Error(`lighthouse: no ${id} score for ${label}`);
      scores[id] = category.score;
    }
    const numeric = (id: string): number => {
      const value = lhr.audits[id]?.numericValue;
      if (value === undefined) throw new Error(`lighthouse: no numeric "${id}" for ${label}`);
      return value;
    };
    const short = Object.values(lhr.audits)
      .filter((audit) => audit.score !== null && audit.score < 1)
      .map((audit) => `${audit.id} (${audit.score})`)
      .sort();
    return {
      label,
      scores,
      lcpMs: numeric("largest-contentful-paint"),
      cls: numeric("cumulative-layout-shift"),
      tbtMs: numeric("total-blocking-time"),
      short,
      auditSeconds: (performance.now() - started) / 1000,
    };
  } finally {
    // The third composition once sat here for the whole two-minute timeout with its scores
    // already measured (12 October 2026, one run of four). Where the time went is not known:
    // the `(audit N s)` in the report is there so the next time says whether it was the audit or
    // this close. `close()` is documented to wait for connections mid-request, and Chrome keeps
    // its sockets open after an audit, so the one wait that is known is removed first.
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function report(m: Measured): string {
  const pct = (score: number) =>
    Math.round(score * 100)
      .toString()
      .padStart(3);
  return (
    `${m.label.padEnd(24)} performance ${pct(m.scores["performance"] ?? 0)}   ` +
    `accessibility ${pct(m.scores["accessibility"] ?? 0)}   ` +
    `best-practices ${pct(m.scores["best-practices"] ?? 0)}   seo ${pct(m.scores["seo"] ?? 0)}   ` +
    `LCP ${(m.lcpMs / 1000).toFixed(2)} s   CLS ${m.cls.toFixed(3)}   TBT ${Math.round(m.tbtMs)} ms   ` +
    `(audit ${m.auditSeconds.toFixed(1)} s)` +
    (m.short.length === 0 ? "" : `\n${" ".repeat(24)} short of full marks: ${m.short.join(", ")}`)
  );
}

describe("Part 8.5 — Lighthouse over a sample site, the three compositions", () => {
  it("measures a sector whose bank is filled, or says it cannot", () => {
    expect(hasSamplePhotos(SECTOR)).toBe(true);
  });

  for (const variant of VARIANTS) {
    it(`${variant.id} ${variant.cover}: performance and accessibility at ${FLOOR * 100} or more`, async () => {
      const measured = await measure(
        `${SECTOR} · ${variant.id} ${variant.cover}`,
        sampleSite(variant),
      );
      console.log(report(measured));
      expect(
        measured.scores["performance"],
        `${measured.label}: performance below ${FLOOR * 100} — ${report(measured)}`,
      ).toBeGreaterThanOrEqual(FLOOR);
      expect(
        measured.scores["accessibility"],
        `${measured.label}: accessibility below ${FLOOR * 100} — ${report(measured)}`,
      ).toBeGreaterThanOrEqual(FLOOR);
      expect(
        measured.scores["best-practices"],
        `${measured.label}: best practices short of full marks — ${report(measured)}`,
      ).toBe(BEST_PRACTICES);
    }, 120_000);
  }

  it(`a page drawn per entry: performance and accessibility at ${FLOOR * 100} or more`, async () => {
    const { bundle, path } = fichaSite();
    const measured = await measure(`una-pagina-por-ficha · ${path}`, bundle, path);
    console.log(report(measured));
    expect(
      measured.scores["performance"],
      `${measured.label}: performance below ${FLOOR * 100} — ${report(measured)}`,
    ).toBeGreaterThanOrEqual(FLOOR);
    expect(
      measured.scores["accessibility"],
      `${measured.label}: accessibility below ${FLOOR * 100} — ${report(measured)}`,
    ).toBeGreaterThanOrEqual(FLOOR);
    expect(
      measured.scores["best-practices"],
      `${measured.label}: best practices short of full marks — ${report(measured)}`,
    ).toBe(BEST_PRACTICES);
  }, 120_000);
});
