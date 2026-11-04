import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Browser,
  type BrowserType,
  chromium,
  firefox,
  type Page,
  webkit,
} from "@playwright/test";
import { render } from "@retorika/renderer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Combination, openHtml } from "../../../packages/renderer/test/browser-fixtures.ts";
import {
  checkCopies,
  checkCovers,
  checkCurrentPage,
  checkFold,
  checkOverflow,
  checkPhoneBar,
  checkRails,
  checkScrolled,
  checkSheet,
  compareSnapshots,
  expectHeader,
  headerSnapshot,
  type Snapshot,
  setDisclosures,
} from "../../../packages/renderer/test/menu-checks.ts";
import { auditCombinations, rotationCounts } from "./audit-fixtures.ts";
import { canvasDocument } from "./canvas-document.ts";

/**
 * **The menu audit** (sprint 33 día 2): how the menus look, measured over a matrix and not read.
 *
 * Since sprint 30 the bar, the rails, «Ir a…», the phone's sheet, the glass, the sliding indicator
 * and the places have each been built and measured on their own day, on the cases that day named.
 * This file opens the whole matrix (`auditCombinations`: 150 documents and three specials) at the
 * seven widths that mean something — 320 and 390 phones, 768, the rail's 1024, the two-rail floor's
 * 1247, the reference 1280, 1680 — in Chromium, Firefox and WebKit, in every state a visitor reaches
 * (at rest; 600 px down with a fixed bar; «Menú» open; «Ir a…» open), and runs the ten checks of
 * `menu-checks.ts` on each. **And the canvas's own document** (`canvasDocument`: the html the editor's
 * frame first paints, with the editor's stillness rules) at the two widths the canvas lays out at,
 * compared element by element with the published page in the same engine: what the owner sees while
 * editing must be what is published, but for the divergences the record names.
 *
 * **A whole pass produces the list.** A failing state is photographed to `.scratch/audit-menus/` and
 * written to `findings.tsv`, and the combination goes on to its next state; the test fails at the end
 * with every line. **And a pass resumes** (David's adjustment 3): each combination an engine finishes
 * writes a `done` row, and `RETORIKA_AUDIT_RESUME=1` skips the ones already there, saying how many.
 * `RETORIKA_ENGINE=chromium,webkit` runs some engines; `RETORIKA_AUDIT_ONLY=<regex>` some
 * combinations; `RETORIKA_AUDIT_OUT=<dir>` writes elsewhere (a sabotage run beside a real one). An
 * engine that is not installed is skipped saying so, never silently.
 *
 * Run with `pnpm audit:menus` (under `caffeinate -i`: an hour in three engines), never in CI.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..");
const OUT = process.env["RETORIKA_AUDIT_OUT"] ?? join(ROOT, ".scratch", "audit-menus");
const FINDINGS = join(OUT, "findings.tsv");

const ZIP_WIDTHS = [1680, 1280, 1247, 1024, 768, 390, 320] as const;
const CANVAS_WIDTHS = [1280, 320] as const;
const heightFor = (width: number) => (width <= 320 ? 568 : width <= 720 ? 844 : 900);

const ENGINES: readonly [string, BrowserType][] = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];
const wanted = (process.env["RETORIKA_ENGINE"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const only = process.env["RETORIKA_AUDIT_ONLY"]
  ? new RegExp(process.env["RETORIKA_AUDIT_ONLY"])
  : null;

function installed(type: BrowserType): boolean {
  try {
    return existsSync(type.executablePath());
  } catch {
    return false;
  }
}

/** The combinations an earlier run finished, per engine, read from the findings file. */
function alreadyDone(): Set<string> {
  if (process.env["RETORIKA_AUDIT_RESUME"] !== "1" || !existsSync(FINDINGS)) return new Set();
  return new Set(
    readFileSync(FINDINGS, "utf8")
      .split("\n")
      .map((line) => line.split("\t"))
      .filter((cols) => cols[2] === "done")
      .map((cols) => `${cols[0]}\t${cols[1]}`),
  );
}

mkdirSync(OUT, { recursive: true });
const done = alreadyDone();
const combinations = auditCombinations().filter((c) => only === null || only.test(c.id));
const started = Date.now();
let skipped = 0;
let failures = 0;

/** One line of the findings file. Tabs separate, so a sheet reads it. */
function record(...cols: (string | number)[]): void {
  appendFileSync(FINDINGS, `${cols.join("\t")}\n`);
}

for (const [engine, type] of ENGINES) {
  const present = installed(type);
  const chosen = wanted.length === 0 || wanted.includes(engine);
  if (!present) {
    process.stderr.write(
      `menus-audit: ${engine} is not installed (${type.executablePath()}); skipped. ` +
        `\`pnpm exec playwright install ${engine}\` installs it.\n`,
    );
  }

  describe.skipIf(!present || !chosen)(engine, () => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await type.launch();
    });
    afterAll(async () => {
      await browser?.close();
    });

    for (const c of combinations) {
      it(c.id, async (ctx) => {
        if (done.has(`${engine}\t${c.id}`)) {
          skipped += 1;
          ctx.skip();
          return;
        }
        const h = expectHeader(c.document);
        const findings: string[] = [];
        const notes: string[] = [];
        const safe = c.id.replace(/\//g, "_");
        const fail = async (page: Page, width: number, state: string, lines: string[]) => {
          const real = lines.filter((l) => !l.includes("(allowed)"));
          for (const l of lines.filter((l) => l.includes("(allowed)"))) {
            notes.push(`${width}\t${state}\t${l}`);
          }
          if (real.length === 0) return;
          const dir = join(OUT, engine, safe);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, `${width}-${state}.png`) });
          for (const l of real) findings.push(`${width}\t${state}\t${l}`);
        };

        // The published page, served once at the widest width and resized down: the html is the
        // same at every width, and a resize is what a visitor's window does.
        const snapshots: Partial<Record<number, Snapshot>> = {};
        const page = await openHtml(browser, render(c.document, "html").html, 1680, c.id);
        try {
          for (const width of ZIP_WIDTHS) {
            await page.setViewportSize({ width, height: heightFor(width) });
            await setDisclosures(page, "details", false);
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            await page.waitForTimeout(150);
            const phone = width <= 720;

            const rest = [
              ...(await checkCopies(page, h, width, "rest")),
              ...(await checkOverflow(page)),
              ...(await checkCovers(page)),
              // The home page has no entry of its own, so no mark here: the second page, below.
              ...(await checkCurrentPage(page, 0)),
              ...(phone ? await checkPhoneBar(page, h) : await checkRails(page, h, width)),
              ...(!phone && h.sections === "fold" ? await checkFold(page, h, width, false) : []),
            ];
            if ((CANVAS_WIDTHS as readonly number[]).includes(width)) {
              snapshots[width] = await headerSnapshot(page);
            }
            await fail(page, width, "rest", rest);

            if (phone) {
              await page.click("details.rb-nav-narrow > summary");
              await page.waitForTimeout(100);
              await fail(page, width, "menu", [
                ...(await checkSheet(page, "details.rb-nav-narrow")),
                ...(await checkCopies(page, h, width, "menu")),
                ...(await checkOverflow(page)),
                ...(await checkCurrentPage(page, 0)),
              ]);
              await setDisclosures(page, "details", false);
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            }

            if ((phone && h.mobile === "fold") || (!phone && h.sections === "fold")) {
              await page.click("details.rb-nav-fold > summary");
              await page.waitForTimeout(phone ? 100 : 450);
              await fail(page, width, "fold", [
                ...(phone
                  ? await checkSheet(page, "details.rb-nav-fold")
                  : await checkFold(page, h, width, true)),
                ...(await checkCopies(page, h, width, "fold")),
                ...(await checkOverflow(page)),
              ]);
              await setDisclosures(page, "details", false);
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            }

            if (!phone && h.sticky) {
              await fail(page, width, "scrolled", await checkScrolled(page, h));
            }
          }
        } finally {
          await page.context().close();
        }

        // The canvas's document, at the two widths the canvas lays out at, against the page above.
        const canvas = canvasDocument(c.document);
        for (const width of CANVAS_WIDTHS) {
          const cpage = await openHtml(browser, canvas, width, `${c.id}/canvas`);
          try {
            await cpage.setViewportSize({ width, height: heightFor(width) });
            await cpage.waitForTimeout(100);
            const phone = width <= 720;
            const published = snapshots[width];
            if (!published) throw new Error(`no published snapshot at ${width}`);
            await fail(cpage, width, "canvas", [
              ...(await checkCopies(cpage, h, width, "rest")),
              ...(await checkOverflow(cpage)),
              ...(await checkCovers(cpage)),
              ...(await checkCurrentPage(cpage, 0)),
              ...(phone ? await checkPhoneBar(cpage, h) : await checkRails(cpage, h, width)),
              ...(!phone && h.sections === "fold" ? await checkFold(cpage, h, width, false) : []),
              ...compareSnapshots(await headerSnapshot(cpage), published, h),
            ]);
            if (phone) {
              await cpage.click("details.rb-nav-narrow > summary");
              await cpage.waitForTimeout(100);
              await fail(cpage, width, "canvas-menu", [
                ...(await checkSheet(cpage, "details.rb-nav-narrow")),
                ...(await checkCopies(cpage, h, width, "menu")),
              ]);
            }
          } finally {
            await cpage.context().close();
          }
        }

        // The second page, for the mark under the current page's entry: the home page has no entry
        // of its own (the brand is the way home, ADR 0043), so the mark exists only elsewhere. At
        // 1280 in the strip or a rail, at 390 in the sheet, and at 1280 in the canvas's document.
        const second = c.document.pages[1];
        if (!second) throw new Error(`${c.id}: no second page`);
        const page2 = render(c.document, "html", { pageId: second.id }).html;
        const p2 = await openHtml(browser, page2, 1280, `${c.id}/page2`);
        try {
          await fail(p2, 1280, "page2", await checkCurrentPage(p2, 1));
          await p2.setViewportSize({ width: 390, height: 844 });
          await p2.waitForTimeout(150);
          await p2.click("details.rb-nav-narrow > summary");
          await p2.waitForTimeout(100);
          await fail(p2, 390, "page2-menu", await checkCurrentPage(p2, 1));
        } finally {
          await p2.context().close();
        }
        const c2 = await openHtml(
          browser,
          canvasDocument(c.document, second.id),
          1280,
          `${c.id}/page2/canvas`,
        );
        try {
          await fail(c2, 1280, "page2-canvas", await checkCurrentPage(c2, 1));
        } finally {
          await c2.context().close();
        }

        for (const line of notes) record(engine, c.id, "note", line);
        for (const line of findings) record(engine, c.id, "fail", line);
        record(engine, c.id, "done", findings.length);
        failures += findings.length;
        expect(findings, `${engine} ${c.id}\n  ${findings.join("\n  ")}`).toEqual([]);
      });
    }
  });
}

afterAll(() => {
  const elapsed = Math.round((Date.now() - started) / 1000);
  const counts = rotationCounts(combinations);
  process.stdout.write(
    `menus-audit: ${combinations.length} combinations, ${skipped} skipped as done, ` +
      `${failures} failing states, ${elapsed} s. Rotation: ${JSON.stringify(counts)}. ` +
      `Findings and captures in ${OUT}\n`,
  );
});
