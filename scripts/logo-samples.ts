/**
 * Writes the 64×64 samples `apps/editor/test/logoPalette.test.ts` reads (sprint 40 día 3): each
 * logo below, sampled the way the editor samples it (`sampleInChromium`), as raw RGBA, 16 384 bytes.
 *
 * **Only files that are already in this repository.** David's own logos never enter it (his
 * adjustment 5 approving sprint 40): they are measured locally by the brand test, declared only with
 * `RETORIKA_BRAND_LOGOS`. The synthetic `logo-dos-tintas.png` carries their structure instead.
 *
 *   pnpm logo:samples
 *
 * Run again only when a logo here changes or the editor's sampling does; the test pins what each
 * sample reads, so a changed sample is a red test and a decision, not a drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { sampleInChromium } from "../apps/editor/test/chromiumSample.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "apps/editor/test/fixtures/logo-samples");

/** Sample name → the logo it is taken from, relative to the repository's root. */
const LOGOS: Record<string, string> = {
  "retorika-mark": "docs/design/brand/LogoOficialRetorikaBuilder.png",
  "retorika-wordmark": "docs/design/brand/LogoOficialRetorikaBuilderTexto.png",
  "dos-tintas": "apps/editor/e2e/fixtures/logo-dos-tintas.png",
  "corpus-rust": "fixtures/assets/logo.png",
  "e2e-blue": "apps/editor/e2e/fixtures/logo.png",
  "e2e-yellow": "apps/editor/e2e/fixtures/logo-amarillo.png",
  "e2e-white": "apps/editor/e2e/fixtures/logo-blanco.png",
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  for (const [name, file] of Object.entries(LOGOS)) {
    const pixels = await sampleInChromium(page, readFileSync(join(ROOT, file)));
    writeFileSync(join(OUT, `${name}.rgba`), pixels);
    console.log(`${name}.rgba  ${pixels.length} bytes  from ${file}`);
  }
} finally {
  await browser.close();
}
