import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { DOCUMENTS_DIR } from "./corpus.ts";

/**
 * What a marked text actually *is* once a browser has parsed it.
 *
 * Two claims, and neither can be made by comparing strings.
 *
 * **The first is that nothing executes.** A unit test can assert that `<script>` came out as
 * `&lt;script&gt;`; only a browser can say that the page has no script element and that nothing
 * ran. That is the guarantee ADR 0024 put at the centre of this work, and this file is where it
 * is checked rather than inferred.
 *
 * **The second is that the words are still the words.** A marked text is several DOM nodes where it
 * used to be one, and the html target pretty-prints — so the page could easily read «Solo millo»
 * where the document says «Solomillo», from whitespace that exists only in the file. Measured in
 * Chromium on sprint 10 day 4, before `inlineChildren` existed: it did exactly that.
 */

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function fixture(name: string): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, `${name}.json`), "utf8")));
}

/** Every text the fixture carries, against what the browser read back out of the page. */
const EXPECTED_TEXT: Readonly<Record<string, string>> = {
  "el-headline": "Solomillo al whisky con patatas",
  "el-subheadline": "Menú del día: 14 €",
  "el-body": "Cocina casera de siempre",
  "el-secondary": "Reserva ya",
  "el-services-headline": "Entero",
  "el-card-1-description": "Reservas para la degustación de añejos",
  "el-card-2-description": 'Pan & aceite <del bueno> "de verdad"',
  "el-card-3-description": "Mira esto: <script>alert(1)</script> y ya",
};

describe("marks, in the browser that has to render them", () => {
  it("publishes the words unchanged, and the emphasis where the document put it", async () => {
    const page = await browser.newPage();
    const dialogs: string[] = [];
    const errors: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    try {
      await page.setContent(render(fixture("marcas-en-el-texto"), "html").html);

      const read = await page.evaluate(() => ({
        texts: Object.fromEntries(
          [...document.querySelectorAll("[data-id]")].map((el) => [
            el.getAttribute("data-id") ?? "",
            el.textContent ?? "",
          ]),
        ),
        bold: [...document.querySelectorAll("strong")].map((el) => el.textContent ?? ""),
        italic: [...document.querySelectorAll("em")].map((el) => el.textContent ?? ""),
        scripts: document.querySelectorAll("script").length,
      }));

      // Nothing ran, and there is nothing that could run.
      expect(read.scripts).toBe(0);
      expect(dialogs).toEqual([]);
      expect(errors).toEqual([]);

      // The words are the document's words, to the character — including the ones that pass
      // through `escapeHtml` and come back out the other side.
      for (const [id, text] of Object.entries(EXPECTED_TEXT)) {
        expect(read.texts[id], id).toBe(text);
      }

      // And the emphasis landed on exactly the runs the document declares. `Cocina ` and `casera`
      // are two `<strong>` elements because `em` starts inside the bold run and the pieces differ;
      // what the reader sees is one bold phrase, which is what the text above already asserted.
      expect(read.bold).toEqual([
        "Solomillo al whisky",
        "14 €",
        "Cocina ",
        "casera",
        "Entero",
        "& aceite <del bueno>",
        "<script>alert(1)</script>",
      ]);
      expect(read.italic).toEqual(["14 €", "casera", " de siempre", "Reserva", "degustación"]);
    } finally {
      await page.close();
    }
  });

  it("renders a mark inside a word without putting a space in it", async () => {
    // The specific corruption `inlineChildren` prevents, provoked directly rather than waited for.
    const page = await browser.newPage();
    try {
      const doc = fixture("marcas-en-el-texto");
      await page.setContent(render(doc, "html").html);
      const headline = await page.locator('[data-id="el-headline"]').textContent();
      expect(headline).not.toContain("  ");
      expect(headline?.trim()).toBe(headline);
    } finally {
      await page.close();
    }
  });

  it("leaves `xss-attempt` exactly as inert as it was", async () => {
    // The fixture this day was most likely to break, checked here as well as in the golden corpus:
    // green there says the bytes did not move, green here says the page is still harmless.
    const page = await browser.newPage();
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    try {
      await page.setContent(render(fixture("xss-attempt"), "html").html);
      expect(await page.evaluate(() => document.querySelectorAll("script").length)).toBe(0);
      expect(dialogs).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
