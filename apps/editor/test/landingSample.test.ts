import { gzipSync } from "node:zlib";
import { HEADER_SCRIPT } from "@retorika/renderer";
import { describe, expect, it } from "vitest";
import { landingSampleHtml } from "../src/app/landingSample.ts";

/**
 * The landing's hero is the product's own output, so this measures that the output is actually
 * usable *there* — in an `iframe srcDoc` on a public page with no editor around it (sprint 22
 * day 2).
 *
 * **There is no snapshot of the HTML here, and that is deliberate.** The first version of this
 * plan proposed hashing the whole document so that a change in `generate` could not go unnoticed.
 * David's adjustment on approving it: «sin snapshot por hash del HTML completo, que fallaría con
 * cualquier cambio legítimo del renderer». He is right about what that costs — the renderer and
 * the generator change most sprints, every change would redden this file, and a guard whose only
 * fix is to regenerate it teaches people to regenerate without looking. The golden corpus is where
 * a rendered document is pinned byte for byte, with `UPDATE_GOLDEN=1` and a reviewed diff.
 *
 * What is left is what this file is actually for: the properties the *landing* depends on, each of
 * which would be a visible defect on a public page rather than a diff to read.
 */

const html = landingSampleHtml();

describe("the landing's sample site", () => {
  it("is a complete, self-contained document", () => {
    // ADR 0001's shape: the CSS inlined. The same string a client's own file would be — which since
    // ADR 0058 carries the header's one constant script where a header is drawn, and this sample
    // draws one. One, the header's, and never a second.
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain(`<script>${HEADER_SCRIPT}</script>`);
  });

  it("is the sample business two other suites already measure", () => {
    // Shared on purpose: the weight budget weighs this business and Lighthouse audits it, so there
    // is one sample site in this repository rather than three that each have to stay plausible.
    expect(html).toContain("<title>Taberna del Puerto</title>");
    expect(html).toContain("Taberna del Puerto");
  });

  /**
   * **The defect this file exists for.** A generated document names its photographs the way the
   * ZIP will — `muestra-restaurante-bar.03.webp` — and a relative name inside an `iframe srcDoc`
   * resolves against the *parent* page's URL. On the landing that is a request to `/` for a file
   * that is not there: five broken images at the top of the page that is meant to sell the tool.
   * The same mistake, on the three proposals, is what `withPhotoUrls` was extracted for.
   */
  it("asks the public route for every photograph, and leaves no bundle-relative name behind", () => {
    const sources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1] ?? "");
    expect(sources.length, "the sample carries no photograph at all").toBeGreaterThan(0);
    for (const src of sources) expect(src).toMatch(/^\/api\/muestras\/[\w.-]+$/);
    // And nothing anywhere else in the document still names a bank file directly.
    expect(html.replace(/\/api\/muestras\/[\w.-]+/g, "")).not.toMatch(/muestra-[\w.-]+\.webp/);
  });

  /**
   * Determinism by **running it twice**, which is the question this test can actually answer:
   * «does the landing serve the same page on every build». `INV_5` is where the renderer's
   * determinism is proved in general; this is the one call site that would silently get a
   * different site per deploy if it stopped holding.
   */
  it("builds the same page twice", () => {
    expect(landingSampleHtml()).toBe(html);
  });

  /**
   * The weight it adds to a page whose whole problem is a cold start. Measured on 15 October 2026:
   * 12.9 KB of HTML, **3.2 KB gzipped**, which is the number that travels. The ceiling is generous
   * on purpose — this is a budget, not a target — and it is here so that a sample site growing a
   * section, or a sixth photograph, is a decision somebody makes rather than one that happens.
   */
  it("stays small enough to ride on the landing", () => {
    expect(gzipSync(html).length).toBeLessThanOrEqual(24 * 1024);
  });
});
