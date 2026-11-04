import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BrowserType, chromium, firefox, webkit } from "@playwright/test";
import { imageSourcesOf, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, describe, expect, it } from "vitest";
import { buildSite, bundleToZip } from "../src/index.ts";
import { fixtureFontBundle } from "./fixtureFonts.ts";

/**
 * **The downloaded site, double-clicked, in the three engines** (sprint 32 día 6).
 *
 * `double-click.test.ts` proves by reading the HTML that nothing a page loads needs a server, and the
 * editor's e2e opens one ZIP from `file://` in Chromium. Neither opens it in Firefox or Safari, which
 * is where a visitor of a neighbourhood bar is as likely to be — and `file://` is where engines differ
 * most: each draws its own line around what a file may load from beside it. This file builds the
 * real ZIP, extracts it with the system's `unzip` (what a double-click does), opens the entry page
 * from disk in Chromium, Firefox and WebKit, follows a link to a second page, and asserts in all three:
 * no console error, no uncaught exception, no failed request, every image decoded, no web font in
 * error — a face that fails from `file://` shows the fallback and nothing else, which no console is
 * obliged to report.
 *
 * **Whether an engine transitions between two pages opened from disk is printed, not asserted** (the
 * plan: «se asevera que la segunda página carga, sin más»): measured on día 6, Chromium 153 and Chrome
 * 156 do, WebKit 26.6 does not, Firefox 155 has no cross-document transitions — the plan, and ADR 0062
 * §3 until its día 6 note, said none would. What is asserted is the other half: **for the visitor who
 * asked for less movement no engine transitions**, from disk as from a server (ADR 0062 §7).
 *
 * **Here and not in the renderer** because a site is what `buildSite` makes — the pages with their
 * font files, photographs and icon — and the renderer cannot import the publisher. It runs in the
 * publisher's browser project (`pnpm lighthouse`), the one CI already gives a browser to. **An engine
 * Playwright has not installed is skipped saying so** — CI installs Chromium alone.
 */

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures");

const ENGINES: readonly [string, BrowserType][] = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];

/** `menu-y-paginas` carries web-font files (EB Garamond); `cabecera-con-marca` a logo and a bar. */
const SITES = ["menu-y-paginas", "cabecera-con-marca"] as const;

function installed(type: BrowserType): boolean {
  try {
    return existsSync(type.executablePath());
  } catch {
    return false;
  }
}

function fixture(name: string): RetorikaDocument {
  return parseDocument(
    JSON.parse(readFileSync(join(FIXTURES_DIR, "documents", `${name}.json`), "utf8")),
  );
}

/*
 * What runs in the page is written as text: this package compiles without the DOM library, because
 * its own code runs on a server, and a test is not a reason to let `document` type-check in `src/`.
 */

/** Records on `window.__vt` whether the page arrived by a view transition. */
const RECORD_TRANSITION = `addEventListener("pagereveal", (e) => { window.__vt = e.viewTransition != null; });`;

type Unloaded = { images: string[]; fonts: string[]; loadedFonts: number };

/** What failed to load on the page in front of us, beyond what the listeners heard. */
const UNLOADED = `(async () => {
  await document.fonts.ready;
  await Promise.allSettled([...document.images].map((img) => img.decode()));
  return {
    images: [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.getAttribute("src")),
    fonts: [...document.fonts].filter((f) => f.status === "error").map((f) => f.family + " " + f.weight),
    loadedFonts: [...document.fonts].filter((f) => f.status === "loaded").length,
  };
})()`;

const dirs: string[] = [];
const transitions: string[] = [];

/** The site's ZIP, extracted into a fresh directory; the directory. */
function extracted(name: string): string {
  const document = fixture(name);
  const assets = new Map<string, Uint8Array>();
  for (const source of imageSourcesOf(document)) {
    if (source.src.startsWith("data:")) continue;
    assets.set(source.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, source.src))));
  }
  const bundle = buildSite(document, {
    siteId: name,
    baseUrl: "https://example.test",
    assets,
    fonts: fixtureFontBundle(document),
  });
  const dir = mkdtempSync(join(tmpdir(), `retorika-motores-${name}-`));
  dirs.push(dir);
  const zip = join(dir, `${name}.zip`);
  writeFileSync(zip, bundleToZip(bundle));
  const site = join(dir, name);
  execFileSync("unzip", ["-q", zip, "-d", site]);
  return site;
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  // To stdout directly, like the skips: the run is silent by default.
  process.stdout.write(
    `engines.browser — a link followed from file://, transitioned:\n  ${transitions.join("\n  ")}\n`,
  );
});

for (const [name, type] of ENGINES) {
  const present = installed(type);
  if (!present) {
    // Straight to stderr and not through `console`: the run is silent by default, and a skip whose
    // reason nobody reads is the silent skip this file refuses.
    process.stderr.write(
      `engines.browser: ${name} is not installed (${type.executablePath()}); its tests are skipped. ` +
        `\`pnpm exec playwright install ${name}\` installs it.\n`,
    );
  }

  describe.skipIf(!present)(`${name}`, () => {
    for (const site of SITES) {
      for (const motion of [true, false]) {
        it(`opens ${site} from file:// and follows a link with nothing failing, ${motion ? "with motion" : "under reduce"}`, async () => {
          const dir = extracted(site);
          expect(readdirSync(dir)).toContain("index.html");
          const browser = await type.launch();
          try {
            const context = await browser.newContext({
              viewport: { width: 1280, height: 900 },
              reducedMotion: motion ? "no-preference" : "reduce",
            });
            const page = await context.newPage();
            const problems: string[] = [];
            page.on("console", (m) => {
              if (m.type() === "error") problems.push(`console: ${m.text()}`);
            });
            page.on("pageerror", (e) => problems.push(`exception: ${e.message}`));
            page.on("requestfailed", (r) =>
              problems.push(`failed: ${r.url()} (${r.failure()?.errorText})`),
            );
            await page.addInitScript(RECORD_TRANSITION);
            const unloaded = () => page.evaluate<Unloaded>(UNLOADED);

            await page.goto(`file://${join(dir, "index.html")}`, { waitUntil: "load" });
            const first = await unloaded();
            expect(first.images, "images on the first page").toEqual([]);
            expect(first.fonts, "fonts on the first page").toEqual([]);
            // A site that ships faces uses them on its first page: none loaded would be a face that
            // failed without saying so.
            const faces = readdirSync(dir).includes("fonts");
            if (faces) expect(first.loadedFonts, "faces loaded").toBeGreaterThan(0);

            await page.click('.rb-nav-wide a[href="./que-ponemos.html"]');
            await page.waitForURL("**/que-ponemos.html");
            await page.waitForLoadState("load");
            expect(await page.locator("h1, h2").first().isVisible()).toBe(true);
            const second = await unloaded();
            expect(second.images, "images on the second page").toEqual([]);
            expect(second.fonts, "fonts on the second page").toEqual([]);
            // `pagereveal` may fire after `load` has been seen: waited for where the engine has it.
            await page
              .waitForFunction(`!("onpagereveal" in window) || "__vt" in window`, null, {
                timeout: 2000,
              })
              .catch(() => undefined);
            const vt = await page.evaluate<boolean | undefined>("window.__vt");
            if (motion) {
              transitions.push(`${name} ${browser.version()}, ${site}: ${vt ?? "no pagereveal"}`);
            } else {
              expect(vt ?? false, "a transition for a visitor who asked for less").toBe(false);
            }

            expect(problems).toEqual([]);
          } finally {
            await browser.close();
          }
        });
      }
    }
  });
}
