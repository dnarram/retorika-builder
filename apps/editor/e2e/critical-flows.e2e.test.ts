import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { type Browser, chromium, expect, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { BASE_URL, startEditorServer, stopEditorServer } from "./server.ts";

/**
 * The critical flows, against the real, running application — the one thing no other suite in
 * this repository does. Everything else either renders in Node (`vitest`'s `happy-dom` project)
 * or serves static HTML strings through Playwright's own route interception
 * (`packages/renderer/test/browser-fixtures.ts`), never a live Next server answering real
 * requests. A questionnaire's React state, click-to-edit committing through a live `fetch`, and
 * a download button that actually triggers `/api/download` exist nowhere else.
 *
 * The protocol names five (docs/protocolo.md, Part 9.2, quoted so this file and that line
 * cannot drift apart unnoticed):
 *
 * > «Los flujos críticos de Playwright son cinco y no más: cuestionario hasta web generada,
 * > edición de un texto y recarga, cambio de paleta, pago de prueba y publicación, y descarga
 * > del ZIP con comprobación de que el HTML abre sin servidor.»
 *
 * **Four exist here.** Where the fifth stands is written out rather than left implied, because a
 * job that silently covers four fifths of what it is named for is the failure this note exists to
 * prevent:
 *
 * - **Pago de prueba y publicación** is on hold with no plan (ADR 0008, superseding ADR 0007).
 *   There is no payment flow and no publish target to test against; writing one now would test
 *   code that does not exist.
 *
 * It arrives when the feature it exercises does — this file, or the one that grows from it, is
 * where it belongs. **Cambio de paleta** was the last to join, on sprint 4 day 3, once the rail's
 * `Estilo` item existed to drive it (day 2). Every `describe` below is numbered by the protocol's
 * own ordinal position in the quote above, not by the order it was written in this file — which is
 * why "descarga" is flow 5 rather than 3, the number it carried before this one existed, and why
 * the gap at 4 is left visibly empty rather than closed by renumbering around it.
 *
 * One shared `page`, walked through in order by `it`s rather than one long test: each flow gets
 * its own name and its own pass/fail in the report, which is what "four of five flows" means as a
 * CI result rather than as a sentence. The cost is coupling — a failure in an earlier one turns
 * the later ones into cascading failures rather than independent ones — accepted because the real
 * user journey is exactly this sequential: nobody changes a palette or downloads a ZIP without
 * first generating and opening a site, so independent journeys would only re-run the same first
 * four questions repeatedly for a `next dev` job already paying that cost once.
 */

let browser: Browser;
let page: Page;

beforeAll(async () => {
  await startEditorServer();
  browser = await chromium.launch();
  page = await (await browser.newContext()).newPage();
}, 90_000);

afterAll(async () => {
  await page?.context().close();
  await browser?.close();
  stopEditorServer();
});

const HEADLINE_EDIT = "Reserva ya, no te quedes sin mesa";

describe("critical flow 1 — cuestionario hasta web generada", () => {
  it("produces three real, generated sites from the five answers", async () => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await page.fill("#nombre", "Taberna Santo Domingo");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByText("Restaurante y bar", { exact: true }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByText("Comidas", { exact: true }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.fill("#direccion", "Cta. de Santo Domingo, 2, Ronda");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByText("Que reserven", { exact: true }).click();
    await page.fill("#enlace", "https://reservas.example.com/taberna");
    await page.getByRole("button", { name: "Crear mi web" }).click();

    // Three cards, each a live iframe of what the generator actually produced for these
    // answers — not a screenshot, not a placeholder. The cover's own headline in each confirms
    // the iframe is showing a real render, not an empty frame that merely loaded. Scoped to the
    // cover: the business name also appears in the services intro text and in the footer's
    // "© Taberna Santo Domingo", so the bare text matches three elements on a generated page.
    const frames = page.locator("iframe");
    await expect(frames).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(
        page
          .frameLocator("iframe")
          .nth(i)
          .locator('[data-section="sec-cover"] [data-slot="headline"]'),
      ).toHaveText("Taberna Santo Domingo");
    }
  });
});

describe("critical flow 2 — edición de un texto y recarga", () => {
  it("commits a click-to-edit change and survives a reload", async () => {
    await page.getByText("Ver a tamaño real →").first().click();

    const frame = page.frameLocator("iframe").first();
    // Scoped to the cover: "headline" is a slot name every section declares its own version
    // of ("Qué hacemos", "Dónde estamos", "Te esperamos" are all headlines too), so the bare
    // slot selector matches four elements on a generated page, not one.
    const headline = frame.locator('[data-section="sec-cover"] [data-slot="headline"]');
    await headline.click();
    // The field selects its own contents on focus (Editor.tsx), so typing replaces rather than
    // appends — the same behaviour a real click-to-edit session relies on.
    await page.keyboard.type(HEADLINE_EDIT);
    // Blur by clicking the hint text above the canvas: anywhere outside the editable field.
    await page.getByText("Haz clic en cualquier texto para cambiarlo").click();

    await expect(frame.getByText(HEADLINE_EDIT)).toBeVisible();
    // The save tick is the one thing in this editor allowed to claim a save happened — it only
    // shows "Guardado en este navegador" once autosave has actually resolved (ADR 0012).
    await expect(page.getByText("Guardado en este navegador")).toBeVisible({ timeout: 5_000 });

    await page.reload({ waitUntil: "networkidle" });

    // A reload with no session would land back on question 1; landing straight in the editor
    // with the edited text is the localStorage round trip actually working, not assumed.
    await expect(page.frameLocator("iframe").first().getByText(HEADLINE_EDIT)).toBeVisible();
  });

  it("takes a text off the page when it is emptied, and undo puts it back", async () => {
    // Emptying used to be silently undone by the blur handler, which meant an optional slot could
    // never be made empty again once it had marker text in it — a carta line published «Escribe
    // aquí el precio» on a real page because the price could not be cleared. Pinned here because
    // it is browser behaviour: a contentEditable region, blurred, committing "".
    //
    // The cover's subheadline rather than its headline, and undone immediately, so the flows that
    // share this page afterwards see exactly the state flow 2 left.
    const frame = page.frameLocator("iframe").first();
    const subheadline = frame.locator('[data-section="sec-cover"] [data-slot="subheadline"]');
    await expect(subheadline).toBeVisible();

    await subheadline.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    await page.getByText("Haz clic en cualquier texto para cambiarlo").click();

    // Gone from the page rather than left as an empty paragraph taking its own gap.
    await expect(subheadline).toHaveCount(0);

    await page.locator('button[aria-label="Deshacer"]').click();
    await expect(subheadline).toBeVisible();
  });
});

describe("critical flow 3 — cambio de paleta", () => {
  it("recolours the whole preview from the Estilo panel, and undo reverts it", async () => {
    const frame = page.frameLocator("iframe").first();
    // `--color-primary` is what a click actually has to move for "recolours" to mean anything —
    // read off the iframe's own document, the same custom property `packages/renderer` emits and
    // the same one `theme-css.test.ts` pins as one of the five the panel's swatches show.
    const primaryColor = async () =>
      (
        await frame
          .locator("body")
          .evaluate((el) =>
            getComputedStyle(el.ownerDocument.documentElement).getPropertyValue("--color-primary"),
          )
      )
        .trim()
        .toUpperCase();

    // Taberna Santo Domingo is `restaurante-bar`, whose generated theme is `warm-terracotta` +
    // `classic-display` (packages/generator/src/theme.ts) — so the panel opening with that
    // palette already ticked is `identifyPalette` working end to end, not a fixture that happens
    // to agree with itself.
    const before = await primaryColor();
    expect(before).toBe("#9A3412");

    await page.getByRole("button", { name: "Estilo", exact: true }).click();
    const terracotta = page.getByRole("radio", { name: "Terracota cálida" });
    const azul = page.getByRole("radio", { name: "Azul confianza" });
    await expect(terracotta).toBeChecked();

    await azul.click();
    await expect(azul).toBeChecked();
    await expect
      .poll(primaryColor, "the preview should recolour after picking a different palette")
      .toBe("#1D4ED8");

    // What the theme is not allowed to touch: the text this session edited in flow 2. Rule 6 in
    // one assertion — style is references to the system, content is not one of them.
    await expect(frame.getByText(HEADLINE_EDIT)).toBeVisible();

    // Undo restyles the whole site back in one step, same as any other action in this history.
    await page.locator('button[aria-label="Deshacer"]').click();
    await expect(terracotta).toBeChecked();
    await expect.poll(primaryColor, "undo should restore the generated palette").toBe(before);

    // Closing the panel by the rail leaves editing exactly where the next flow needs it.
    await page.getByRole("button", { name: "Secciones", exact: true }).click();
    await expect(page.getByText("El estilo de toda la web")).toHaveCount(0);
  });
});

/**
 * Just enough of a ZIP reader to pull one file's raw bytes back out by name. Mirrors
 * `apps/editor/test/download.test.ts`'s `extractFile` (which decodes straight to a string,
 * sufficient there because it only ever reads `index.html`); this one keeps the bytes, because
 * what "opens without a server" needs is a real file written to disk, not a string in memory.
 * Not an independent validator of the ZIP format — that is `packages/publisher/test/zip.test.ts`'s
 * job. Walks the central directory from the end, the same as unzip does.
 */
function extractFileBytes(bytes: Uint8Array, path: string): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  const count = view.getUint16(eocd + 10, true);
  const decoder = new TextDecoder();
  let at = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i += 1) {
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (name === path) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const raw = bytes.subarray(dataStart, dataStart + compressedSize);
      return method === 8 ? new Uint8Array(inflateRawSync(raw)) : new Uint8Array(raw);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`"${path}" not found in the ZIP`);
}

describe("critical flow 5 — descarga del ZIP y el HTML abre sin servidor", () => {
  it("downloads a real ZIP and its index.html opens from disk with no server", async () => {
    // Two different things happen when this button is clicked, and each needs its own capture.
    // `Editor.tsx`'s download() does `fetch("/api/download")`, reads the response as a blob,
    // then clicks a synthetic `<a download>` pointing at an object URL of that blob — which is
    // the step that matters here. Chromium treats any anchor click carrying a `download`
    // attribute as a native browser download and diverts the bytes into its download manager;
    // once that happens, `Response.body()` on the network response Playwright saw comes back
    // empty (confirmed against this exact response: correct 200, correct headers, `content-length:
    // 2502`, and still zero bytes from `.body()`) — the bytes are no longer sitting in the
    // network cache CDP's `Network.getResponseBody` reads from. `page.waitForEvent("download")`
    // is what Playwright gives for exactly this: the actual saved file, not a best-effort replay
    // of a response body the browser already claimed.
    const [download, response] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((candidate) => candidate.url().includes("/api/download")),
      page.getByRole("button", { name: "Descargar" }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/zip");

    const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-"));
    const zipPath = join(dir, download.suggestedFilename());
    await download.saveAs(zipPath);
    const zip = new Uint8Array(readFileSync(zipPath));
    const html = extractFileBytes(zip, "index.html");

    const filePath = join(dir, "index.html");
    writeFileSync(filePath, html);

    // A fresh page, with no route interception and no server behind file://, which is the
    // whole promise ADR 0001 makes: no server, no network, opened by double-clicking.
    const offlinePage = await (await browser.newContext()).newPage();
    const failed: string[] = [];
    offlinePage.on("requestfailed", (request) => failed.push(request.url()));
    try {
      await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
      await expect(offlinePage.getByText("Taberna Santo Domingo").first()).toBeVisible();
      await expect(offlinePage.getByText(HEADLINE_EDIT)).toBeVisible();
      // A failed request off a file:// page is exactly what ADR 0001 forbids: some byte the
      // published page needed was not actually inside it.
      expect(failed).toEqual([]);
    } finally {
      await offlinePage.context().close();
    }
  });
});

/**
 * Not one of the protocol's five flows, and deliberately named so: a regression, kept here because
 * this is the only suite that drives the real application, and the defect it guards exists **only**
 * in the real application.
 *
 * Reported from the deployed site after sprint 5 day 5. The preview is fed through `srcDoc`, so the
 * frame has no URL of its own and every relative href resolves against the parent's — the editor.
 * A menu entry written `href="#sec-services"`, correct in the published file and proven to work
 * from `file://`, resolved inside the frame to the editor's own address: clicking it loaded the
 * editor into its own preview, that copy restored the same session and drew its own preview, and
 * clicking again nested further, without end.
 *
 * Nothing caught it. The golden corpus compares HTML, the a11y matrix serves that HTML as a real
 * document where the anchors resolve correctly, and the published ZIP genuinely works. The bug
 * lived in the one place none of them look: the editor's own canvas.
 */
describe("regression — the preview is a canvas, not a browsable site", () => {
  it("does not navigate, or nest a second editor, when a menu entry is clicked", async () => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    const frame = page.frameLocator("iframe").first();
    await frame.locator('[data-section="sec-cover"]').waitFor();

    const entries = frame.locator(".rb-nav-wide a");
    // The generated site reaches three menu entries on its own — «Qué ponemos», «Dónde estamos»
    // and «Te esperamos» — so the menu is in the preview from the first render.
    await expect(entries.first()).toBeVisible();

    const framesBefore = page.frames().length;
    await entries.first().click();
    await page.waitForTimeout(1500);

    // The preview still shows the site rather than a copy of the editor.
    expect(page.frames().length, "a frame appeared: the editor nested inside its own preview").toBe(
      framesBefore,
    );
    const previewUrl = page.frames()[1]?.url();
    expect(previewUrl, `the preview navigated to ${previewUrl}`).toBe("about:srcdoc");
    await expect(frame.locator('[data-section="sec-cover"]')).toBeVisible();
  });

  it("still lets a link's own label be edited, which is what the guard must not break", async () => {
    // The default action is cancelled; focus is not. `mousedown` is what puts the cursor in a
    // contentEditable region, so click-to-edit on a button label works exactly as it did.
    const frame = page.frameLocator("iframe").first();
    const action = frame
      .locator('[data-section="sec-contact"] [data-slot="primaryAction"]')
      .first();
    await action.click();
    await page.keyboard.type("Reserva tu mesa");
    await page.getByText("Haz clic en cualquier texto para cambiarlo").click();
    await expect(frame.getByText("Reserva tu mesa")).toBeVisible();
  });
});
