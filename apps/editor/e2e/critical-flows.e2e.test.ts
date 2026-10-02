import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  type Browser,
  chromium,
  expect,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";
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
/**
 * Every entry of the ZIP written to disk, the way an owner unzips it.
 *
 * **Replaced writing `index.html` alone, in five flows, on 1 October 2026.** That was enough while a
 * page's only companions were images it named with a `src`; from the day a stylesheet names a font file
 * it is not, and the five flows started reporting failed requests for faces that were in the ZIP and not
 * on the disk. Extracting everything is both the stronger check and the more faithful imitation: the
 * `requestfailed` assertions below now cover the whole download rather than one file of it.
 */
function extractAll(zip: Uint8Array, dir: string): string[] {
  const entries = listZipEntries(zip);
  for (const entry of entries) {
    const target = join(dir, entry);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, extractFileBytes(zip, entry));
  }
  return entries;
}

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

/**
 * Every path the ZIP's central directory names, so a multi-page test can assert the whole bundle
 * — `index.html`, every converted page's own file, `robots.txt` and nothing else — rather than
 * only the one file it happens to open. Walks the same directory `extractFileBytes` does, kept
 * separate rather than shared: one reads a name, this one lists them, and tying the two together
 * would make either harder to read for no line saved.
 */
function listZipEntries(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  const count = view.getUint16(eocd + 10, true);
  const decoder = new TextDecoder();
  let at = view.getUint32(eocd + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    names.push(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return names;
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
    // The cover still carries the placeholder the generator gave it — nothing in flows 1 through 4
    // uploads a photograph — so this press opens the pre-download warning (sprint 6 day 5) rather
    // than downloading directly. Pressing «Descargar igualmente» is the flow doing on purpose what
    // an owner who has not yet added their own photo would also do.
    await page.getByRole("button", { name: "Descargar" }).click();
    const downloadAnyway = page.getByRole("button", { name: "Descargar igualmente" });
    await downloadAnyway.waitFor();

    const [download, response] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((candidate) => candidate.url().includes("/api/download")),
      downloadAnyway.click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/zip");

    const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-"));
    const zipPath = join(dir, download.suggestedFilename());
    await download.saveAs(zipPath);
    const zip = new Uint8Array(readFileSync(zipPath));
    extractAll(zip, dir);

    const filePath = join(dir, "index.html");

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

/**
 * Also not one of the five flows: the day-6 verbs, driven end to end in the real application.
 *
 * Here because two of the three things it checks are only true in a browser. The rename in
 * particular guards a defect the walk found and no unit test could: the field's «select what is
 * there» ran as a callback ref with a fresh identity, so it re-ran on every render and every
 * keystroke re-selected the whole field — typing «Nuestra carta» left the page called «a».
 */
describe("regression — converting a section, and renaming the page it made", () => {
  it("adds a tab, leaves an avance, and lets the new page be renamed", async () => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    const frame = page.frameLocator("iframe").first();
    await frame.locator('[data-section="sec-cover"]').waitFor();

    const tabs = page.locator(".overflow-x-auto button");
    await expect(tabs).toHaveCount(1);

    await frame.locator('[data-section="sec-services"]').click();
    await frame
      .locator(
        '[data-section="sec-services"] .rb-action[aria-label="Convertir esta sección en página"]',
      )
      .click();

    // The page exists, and where the section was there is now an avance showing the destination's
    // own title — read at render time, not copied.
    await expect(tabs).toHaveCount(2);
    await expect(frame.locator('[data-preset="teaser"]')).toContainText("Qué ponemos");

    await page.getByRole("button", { name: "Páginas", exact: true }).click();
    await page.getByRole("button", { name: "Cambiar el nombre" }).nth(1).click();
    await page.keyboard.type("Nuestra carta");
    await page.keyboard.press("Enter");

    // Every character survived. The tab and the derived menu both follow, which is the proof that
    // the menu really is derived rather than written down somewhere.
    await expect(tabs.nth(1)).toHaveText("Nuestra carta");
    await expect(frame.locator(".rb-nav-wide")).toContainText("Nuestra carta");
  });

  it("takes the editor to that page when its menu entry is clicked", async () => {
    // Approved after the nesting fix: the one link in the preview that now does something. It must
    // still never navigate the frame — that is what nested an editor inside the editor.
    const frame = page.frameLocator("iframe").first();
    const framesBefore = page.frames().length;

    await frame.locator(".rb-nav-wide a", { hasText: "Nuestra carta" }).click();

    await expect(frame.locator("[data-page]")).toHaveAttribute("data-page", "page-que-ponemos");
    await expect(page.locator('.overflow-x-auto button[aria-current="page"]')).toHaveText(
      "Nuestra carta",
    );
    expect(page.frames().length, "the preview navigated instead of switching page").toBe(
      framesBefore,
    );
  });
});

/**
 * Sprint 5 day 7. Not one of the protocol's five flows, and not a regression either — this is the
 * sprint's own verification line, named in the plan: «el recorrido con dos o tres conversiones
 * hechas desde el editor», and «el ZIP de varias páginas abierto sin servidor con los enlaces
 * funcionando».
 *
 * Everything the ZIP needs to be correct has been asserted separately, in Node, against documents
 * built by hand or by the schema's own verbs: `packages/publisher/test/site.test.ts` proves the
 * bundle layout, `packages/schema/test/conversion.test.ts` proves `sectionToPage` is one step, and
 * `packages/schema/test/destinations.test.ts` proves a rewritten anchor resolves. None of that
 * proves the button in the actual editor produces the same document — day 6's `sectionToPage`
 * verb was driven by a real click for the first time only in that day's own tests, and only once.
 * This is the second conversion, reaching the three pages the plan asks to see, built entirely
 * through the rail and the canvas the way an owner would, continuing the same document flow 2
 * through flow 6 already edited — so the ZIP this downloads is not a fresh fixture but the actual
 * accumulated state of a real editing session.
 */
describe("día 7 — dos conversiones desde el editor, y el ZIP resultante abierto sin servidor", () => {
  it("converts a second section, downloads, and every page's own navigation works from file://", async () => {
    // The previous test left the canvas on the page the menu click switched to. Back to the first
    // tab — home — because «Dónde estamos» is a section of the home page, not of that one.
    const frame = page.frameLocator("iframe").first();
    await page.locator(".overflow-x-auto button").first().click();
    await expect(frame.locator('[data-section="sec-cover"]')).toBeVisible();

    const tabs = page.locator(".overflow-x-auto button");
    await expect(tabs).toHaveCount(2);

    await frame.locator('[data-section="sec-location"]').click();
    await frame
      .locator(
        '[data-section="sec-location"] .rb-action[aria-label="Convertir esta sección en página"]',
      )
      .click();

    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(2)).toHaveText("Dónde estamos");
    // The second avance gets its own id — `mintSectionId` tried "sec-avance" first and found it
    // taken by day 6's conversion — and it shows the destination's own words, read at render time
    // exactly as the first one does.
    await expect(frame.locator('[data-section="sec-avance-2"]')).toContainText("Dónde estamos");

    // Same reason as flow 5: the cover is still the placeholder, so the warning opens first.
    await page.getByRole("button", { name: "Descargar" }).click();
    const downloadAnyway = page.getByRole("button", { name: "Descargar igualmente" });
    await downloadAnyway.waitFor();

    const [download, response] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((candidate) => candidate.url().includes("/api/download")),
      downloadAnyway.click(),
    ]);
    expect(response.status()).toBe(200);

    const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-multipage-"));
    const zipPath = join(dir, download.suggestedFilename());
    await download.saveAs(zipPath);
    const bytes = new Uint8Array(readFileSync(zipPath));

    const entries = listZipEntries(bytes);
    // Exactly the files this document should produce: no sitemap.xml (a download has no baseUrl,
    // ADR-settled since sprint 3), no stray page, nothing from an earlier fixture — and, since
    // sprint 11 day 6, the two faces this restaurant's type pair asks for **with the OFL text beside
    // them**, which is the condition rather than a detail.
    expect([...entries].sort()).toEqual(
      [
        "donde-estamos.html",
        "fonts/OFL-PlayfairDisplay.txt",
        "fonts/playfair-display-latin-400-normal.woff2",
        "fonts/playfair-display-latin-700-normal.woff2",
        "index.html",
        "que-ponemos.html",
        "robots.txt",
      ].sort(),
    );

    for (const entry of entries) {
      const filePath = join(dir, entry);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, extractFileBytes(bytes, entry));
    }

    const offlinePage = await (await browser.newContext()).newPage();
    const failed: string[] = [];
    offlinePage.on("requestfailed", (request) => failed.push(request.url()));
    try {
      await offlinePage.goto(`file://${join(dir, "index.html")}`, { waitUntil: "load" });
      await expect(offlinePage).toHaveTitle("Taberna Santo Domingo");
      await expect(offlinePage.locator("h1")).toHaveText(HEADLINE_EDIT);
      // The rule ADR 0023 exists for: converting moved nothing in the strip. «Nuestra carta»
      // (the renamed page) and «Dónde estamos» sit exactly where «Qué ponemos» and «Dónde
      // estamos» the sections used to be, ahead of the untouched «Te esperamos» anchor.
      await expect(offlinePage.locator(".rb-nav-wide a")).toHaveText([
        "Nuestra carta",
        "Dónde estamos",
        "Te esperamos",
      ]);
      // No «Inicio» on the page it would link to — a link that reloads the page you are on.
      await expect(offlinePage.locator(".rb-nav-wide a", { hasText: "Inicio" })).toHaveCount(0);

      await Promise.all([
        offlinePage.waitForURL(/que-ponemos\.html$/),
        offlinePage.locator(".rb-nav-wide a", { hasText: "Nuestra carta" }).click(),
      ]);
      await expect(offlinePage).toHaveTitle("Nuestra carta — Taberna Santo Domingo");
      // The page's own heading is the owner's real content — the services section's headline —
      // and it is untouched by the rename: renaming a page changes the chrome that names it
      // (the tab, the menu, the <title>), never the words the owner wrote on the page itself.
      await expect(offlinePage.locator("h1")).toHaveText("Qué ponemos");
      await expect(offlinePage.locator('.rb-nav-wide a[aria-current="page"]')).toHaveText(
        "Nuestra carta",
      );

      await Promise.all([
        offlinePage.waitForURL(/index\.html$/),
        offlinePage.locator(".rb-nav-wide a", { hasText: "Inicio" }).click(),
      ]);
      await expect(offlinePage.locator("h1")).toHaveText(HEADLINE_EDIT);

      await Promise.all([
        offlinePage.waitForURL(/donde-estamos\.html$/),
        offlinePage.locator(".rb-nav-wide a", { hasText: "Dónde estamos" }).click(),
      ]);
      await expect(offlinePage).toHaveTitle("Dónde estamos — Taberna Santo Domingo");
      await expect(offlinePage.locator("h1")).toHaveText("Dónde estamos");
      await expect(offlinePage.getByText("Cta. de Santo Domingo, 2, Ronda")).toBeVisible();
      await expect(offlinePage.locator('.rb-nav-wide a[aria-current="page"]')).toHaveText(
        "Dónde estamos",
      );

      await Promise.all([
        offlinePage.waitForURL(/index\.html$/),
        offlinePage.locator(".rb-nav-wide a", { hasText: "Inicio" }).click(),
      ]);
      await expect(offlinePage.locator("h1")).toHaveText(HEADLINE_EDIT);

      // The whole round trip — three pages, five navigations, zero requests to anything but the
      // files sitting on disk next to each other. This is ADR 0001's promise, extended by this
      // sprint from "one page opens" to "every page's own links actually go somewhere real".
      expect(failed).toEqual([]);
    } finally {
      await offlinePage.context().close();
    }
  });
});

/**
 * Sprint 6 day 1. A regression, and one only a browser can state: the defect is the distance
 * between the page the owner is *looking at* and the page the reducer wrote to.
 *
 * Sprint 5 shipped pages and left `insertSection` resolving `doc.pages[0]` under a comment saying
 * that was a placeholder until `Páginas` arrived. So from a converted page, «Añadir sección aquí»
 * added the section to the home page — and because the pill computes its index from the sections it
 * can see, at a position that meant nothing there either. To the owner the section simply did not
 * appear.
 *
 * **Rewritten on sprint 6 day 6, because the first version passed for an accidental reason.** It
 * reloaded the app and then converted `sec-services` — which the test two blocks above had already
 * converted into a page. On a restored session that section is not on the home page at all, so the
 * click could only ever find it when the *earlier test's autosave had not landed yet*: a debounced
 * 500ms write racing a page load. It won that race on a laptop and lost it on CI, which is the
 * whole of the intermittent failure.
 *
 * That is the second time this suite has been caught resting on the same coincidence — sprint 5
 * day 7 found an assertion that passed only because an autosave was still pending. The lesson
 * taken this time is in the shape of the test rather than in a comment: **it no longer reloads.**
 * The reload was the only thing that made a saved session matter, and it bought nothing — the
 * claim is about what an insertion does, not about what survives a restart, and the flow above
 * already leaves the editor holding exactly the state this one needs.
 */
describe("regression — a section is added to the page you are looking at", () => {
  it("adds it to the converted page, and leaves the home page alone", async () => {
    // Continues from the live editor the previous flow left behind — the sequential model this
    // file's own docstring describes — rather than reloading. Two pages have been made by
    // converting a section, and the canvas is on the home page.
    const frame = page.frameLocator("iframe").first();
    const tabs = page.locator(".overflow-x-auto button");
    await expect(tabs).toHaveCount(3);
    await tabs.first().click();
    await expect(frame.locator("[data-page]")).toHaveAttribute("data-page", "home");
    const homeSectionsBefore = await frame.locator("[data-section]").count();

    // Onto a page a conversion made, and add a section from its own pill. Converting again here
    // would prove nothing this file has not proved twice already, two blocks above.
    await tabs.nth(1).click();
    await expect(frame.locator("[data-page]")).toHaveAttribute("data-page", "page-que-ponemos");
    await frame.getByRole("button", { name: "Añadir sección aquí" }).last().click();
    await frame
      .locator(".rb-menu")
      .first()
      .getByRole("button", { name: /Opiniones/ })
      .click();

    // It is here, on this page, where the owner asked for it.
    await expect(frame.locator('[data-preset="testimonials"]')).toBeVisible();

    // And the home page did not quietly gain one. This is the assertion the bug failed: the
    // section went there instead, and nothing on screen said so.
    await tabs.first().click();
    await expect(frame.locator("[data-page]")).toHaveAttribute("data-page", "home");
    await expect(frame.locator('[data-preset="testimonials"]')).toHaveCount(0);
    // Not one section more than before the insertion. Counting rather than naming, because the
    // failure this guards was never "the wrong section arrived" but "a section arrived here at
    // all, and nothing on screen said so".
    await expect(frame.locator("[data-section]")).toHaveCount(homeSectionsBefore);
  });
});

/**
 * Sprint 6 day 7 — the sprint's own verification line, named in the plan: «el recorrido completo
 * con fotos de verdad subidas desde el panel, el ZIP abierto sin servidor, y el aviso comprobado
 * en navegador.»
 *
 * Not a regression — nothing here was broken and then fixed — and not one of the protocol's five
 * flows either, the same standing sprint 5 day 7's own verification test has above. It exists
 * because three pieces this sprint built each have exactly one way to reach them that a browser
 * click can take, and none of those three had ever been driven end to end: the «Fotos» panel's own
 * «Cambiar» (days 2 and 4), the pre-download warning's «Cambiar» (day 5), and the catalog search
 * (day 6). All three end up in the same `replacePhoto` — `wirePhotos`, the panel and the warning
 * dialog are, in the code's own words, "the same three lines" reached from three doors — so this
 * does not re-test that function three times; it proves the three doors actually open it.
 *
 * Its own browser context rather than the shared `page`: this needs a document with none of the
 * earlier tests' pages or conversions in it, and the shared session by this point in the file has
 * several. Isolation here is free and avoids depending on exactly what state the tests above it
 * happened to leave behind — the coupling this file's own docstring accepts for the five ordered
 * flows was never meant to extend to a test that does not need it.
 */
describe("sprint 6 día 7 — fotos subidas desde el panel y desde el aviso, logo incluido", () => {
  it("uploads through the panel and the warning, and the ZIP that results opens with no server", async () => {
    const walkPage = await (await browser.newContext()).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Taberna Santo Domingo");
      // The logo (day 6): a blue disc, close enough to classic-blue's own primary to choose it.
      await walkPage.locator("#logo").setInputFiles(join(import.meta.dirname, "fixtures/logo.png"));
      await expect(walkPage.getByText(/Hemos sacado los colores de tu logo/)).toBeVisible();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Restaurante y bar", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Comidas", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.fill("#direccion", "Cta. de Santo Domingo, 2, Ronda");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Que reserven", { exact: true }).click();
      await walkPage.fill("#enlace", "https://reservas.example.com/taberna");
      await walkPage.getByRole("button", { name: "Crear mi web" }).click();
      await walkPage.getByText("Ver a tamaño real →").first().click();

      const frame = walkPage.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const fileInput = walkPage.locator('input[type="file"]:not(#logo)');

      // The search (day 6): "fotos" finds «Fotos de trabajos» among the offers and inserts it.
      await frame.getByRole("button", { name: "Añadir sección aquí" }).first().click();
      await frame.locator(".rb-menu-search").fill("fotos");
      const galleryChoice = frame.locator(".rb-menu-list .rb-menu-choice", {
        hasText: "Fotos de trabajos",
      });
      await expect(galleryChoice).toBeVisible();
      await galleryChoice.click();
      await expect(frame.locator('[data-preset="gallery"]')).toBeVisible();

      // The «Fotos» panel's own «Cambiar» (days 2 and 4) — never driven end to end before today.
      await walkPage.getByRole("button", { name: "Fotos", exact: true }).click();
      await expect(walkPage.getByText(/fotos todavía no son tuyas/)).toBeVisible();
      const panelRows = walkPage.locator('ul li:has(button:has-text("Cambiar"))');
      await expect(panelRows).toHaveCount(2);
      await panelRows.first().getByRole("button", { name: "Cambiar" }).click();
      await fileInput.setInputFiles(join(import.meta.dirname, "fixtures/gallery-photo.jpg"));
      // Written into IndexedDB and re-encoded before the chip updates; waited for rather than
      // asserted immediately, the same margin sprint 6 day 5's own walk needed to measure.
      await expect(walkPage.getByText("1 de 2 fotos todavía no son tuyas.")).toBeVisible();

      // The warning's own «Cambiar» (day 5) — one photograph still unfilled, so pressing
      // «Descargar» opens it rather than downloading, and this is the other door onto the same
      // `replacePhoto` the panel just used.
      await walkPage.getByRole("button", { name: "Descargar" }).click();
      const dialog = walkPage.locator('[role="dialog"]', { hasText: "Antes de descargar" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/hueco de foto sin rellenar/)).toBeVisible();
      const dialogRows = dialog.locator('li:has(button:has-text("Cambiar"))');
      await expect(dialogRows).toHaveCount(1);
      await dialogRows.first().getByRole("button", { name: "Cambiar" }).click();
      await fileInput.setInputFiles(join(import.meta.dirname, "fixtures/cover-photo.jpg"));
      await expect(dialog).toHaveCount(0);

      // Every photograph is the owner's now, which is the one state the warning never opens for.
      await expect(walkPage.getByText("Todas las fotos de tu web son tuyas.")).toBeVisible();

      const [download, response] = await Promise.all([
        walkPage.waitForEvent("download"),
        walkPage.waitForResponse((candidate) => candidate.url().includes("/api/download")),
        walkPage.getByRole("button", { name: "Descargar" }).click(),
      ]);
      await expect(
        walkPage.getByText("Antes de descargar"),
        "every photograph was already the owner's — nothing to warn about",
      ).toHaveCount(0);
      expect(response.status()).toBe(200);

      const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-dia7-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      const entries = listZipEntries(zip);
      // Two real photographs, no placeholder — the ZIP's own proof that every "Sin foto" from the
      // panel became a real file, not just a document field that says so.
      expect(entries.filter((entry) => entry.startsWith("assets/")).sort()).toEqual(
        [
          "assets/foto-sec-cover-el-image.jpg",
          "assets/foto-sec-gallery-el-item-1-photo.jpg",
        ].sort(),
      );

      extractAll(zip, dir);
      const filePath = join(dir, "index.html");
      for (const entry of entries) {
        if (entry === "index.html") continue;
        mkdirSync(dirname(join(dir, entry)), { recursive: true });
        writeFileSync(join(dir, entry), extractFileBytes(zip, entry));
      }

      const offlinePage = await (await browser.newContext()).newPage();
      const failed: string[] = [];
      offlinePage.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
        await expect(offlinePage.getByText("Taberna Santo Domingo").first()).toBeVisible();
        // The logo's palette (day 6): classic-blue's own primary, `#1D4ED8`, applied to the
        // headline — not the terracotta `restaurante-bar`'s own sector default would have used.
        await expect(offlinePage.locator("h1")).toHaveCSS("color", "rgb(29, 78, 216)");
        const images = offlinePage.locator("img");
        await expect(images).toHaveCount(2);
        for (const src of await images.evaluateAll((els) =>
          els.map((el) => el.getAttribute("src")),
        )) {
          expect(src, "a relative asset name — ADR 0001, no server behind this page").not.toMatch(
            /^([a-z]+:|\/)/,
          );
        }
        expect(failed, "every byte the page needed was actually inside the ZIP").toEqual([]);
      } finally {
        await offlinePage.context().close();
      }
    } finally {
      await walkPage.context().close();
    }
  });
});

/**
 * Sprint 7 day 3 — the conversion undone, from the «Páginas» panel.
 *
 * `pageToSection` has been written and tested since sprint 5 with **nothing importing it**, so
 * until today converting a section was a one-way trip: an owner who converted the wrong one could
 * delete the page — taking whatever they had put on it — or catch it with Ctrl+Z before doing
 * anything else. The unit tests prove the verb; this proves the panel reaches it, and that the
 * button is offered on exactly the pages where it works.
 *
 * Its own context, for the reason the test above gives: this needs a document with none of the
 * earlier tests' conversions in it, and the shared session by here has several.
 */
describe("sprint 7 día 3 — deshacer una conversión desde «Páginas»", () => {
  it("folds the page back into the section it came from, and offers that on no other page", async () => {
    const walkPage = await (await browser.newContext()).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Taberna Santo Domingo");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Restaurante y bar", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Comidas", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.fill("#direccion", "Cta. de Santo Domingo, 2, Ronda");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Que reserven", { exact: true }).click();
      await walkPage.fill("#enlace", "https://reservas.example.com/taberna");
      await walkPage.getByRole("button", { name: "Crear mi web" }).click();
      await walkPage.getByText("Ver a tamaño real →").first().click();

      const frame = walkPage.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const tabs = walkPage.locator(".overflow-x-auto button");
      await expect(tabs).toHaveCount(1);

      await frame.locator('[data-section="sec-services"]').click();
      await frame
        .locator(
          '[data-section="sec-services"] .rb-action[aria-label="Convertir esta sección en página"]',
        )
        .click();
      await expect(tabs).toHaveCount(2);
      await expect(frame.locator('[data-preset="teaser"]')).toBeVisible();

      await walkPage.getByRole("button", { name: "Páginas", exact: true }).click();
      const fold = walkPage.getByRole("button", { name: "Deshacer la conversión" });
      // One button, on the converted page. The entry page is listed and does not offer it —
      // `pageToSection` refuses the first page, so a button there would be a dead one.
      await expect(fold).toHaveCount(1);
      await fold.click();

      // The page is gone, the avance with it, and the section is back where it was — between the
      // cover and «Dónde estamos», not appended at the end.
      await expect(tabs).toHaveCount(1);
      await expect(frame.locator('[data-preset="teaser"]')).toHaveCount(0);
      await expect(frame.locator('[data-section="sec-services"]')).toBeVisible();
      expect(
        await frame
          .locator("[data-section]")
          .evaluateAll((els) => els.map((el) => el.getAttribute("data-section"))),
      ).toEqual(["sec-cover", "sec-services", "sec-location", "sec-contact", "sec-footer"]);

      // And the derived menu followed: «Qué ponemos» is an anchor on this page again rather than
      // an entry pointing at a file that no longer exists.
      await expect(frame.locator(".rb-nav-wide a", { hasText: "Qué ponemos" })).toHaveAttribute(
        "href",
        "#sec-services",
      );

      // Undone in one step: «Deshacer» brings back the page *and* the avance together.
      await walkPage.getByRole("button", { name: "Deshacer", exact: true }).click();
      await expect(tabs).toHaveCount(2);
      await expect(frame.locator('[data-preset="teaser"]')).toBeVisible();
    } finally {
      await walkPage.context().close();
    }
  });
});

/**
 * Sprint 7 day 5 — the sector without a bank says so.
 *
 * Until today question 2 warned about «Otro sector» alone, which left the other nine looking
 * covered. Seven of them are not: they fall through to `generico`, whose `suggestions` array is
 * empty, so question 3 offers nothing to tick and by ADR 0013 ticking nothing means no services
 * section at all. The sentence was true and shown in one of the eight places it applied.
 *
 * Both directions in one test, because either alone is half a claim: a warning that never appears
 * passes a test that only checks it is absent, and one that always appears passes a test that only
 * checks it is present. `packages/copybank/test/` proves `servesSector` answers correctly, and
 * `drafts.test.ts` proves a drafted-but-unsigned sector still answers no; this proves the screen
 * asks that question at all.
 */
describe("sprint 7 día 5 — el aviso de «sector sin banco»", () => {
  it("warns for a sector with no bank, and not for one that has one", async () => {
    const walkPage = await (await browser.newContext()).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Fisio Ribera");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();

      const warning = walkPage.getByText(/Todavía no tenemos textos preparados/);
      // Nothing chosen yet: nothing to warn about. Always in the layout since sprint 7 day 7
      // (`visibility: hidden` reserves its space so picking a sector never moves the grid), so
      // this checks it is hidden rather than absent.
      await expect(warning).toBeHidden();

      // A sector the bank really does cover says nothing, which is the half that proves the
      // warning is answering a question rather than always being on.
      await walkPage.getByText("Restaurante y bar", { exact: true }).click();
      await expect(warning).toBeHidden();

      // And the case that warns. It used to be «Fisioterapia», one of the seven sectors sprint 7
      // drafted, and that was only safe while nobody had signed them: the subject of the test
      // could be taken away by an act that has nothing to do with the warning. «Otro sector» is
      // the one choice on this screen that can never have a bank of its own — it lands on
      // `generico` by design — so it is the permanent subject.
      await walkPage.getByText("Otro sector", { exact: true }).click();
      await expect(warning).toBeVisible();
      await walkPage.fill("#describe", "cerrajería y apertura de puertas");
      await expect(
        walkPage.getByText(/preparados para cerrajería y apertura de puertas/),
      ).toBeVisible();
    } finally {
      await walkPage.context().close();
    }
  });
});

/**
 * Sprint 7 day 6 — «Equipo», the catalogue's ninth and last section, reached through
 * `canBeBlank` connected to the menu rather than a hand-coded list of exceptions.
 *
 * The unit tests prove the wiring in isolation: `packages/catalog/test/blank.test.ts` names
 * `canBeBlank`'s exact result, and `Variants.tsx` now derives its offer list from it instead of
 * a hardcoded `catalogId !== TEASER_ID`. This proves the real menu actually offers the section
 * that predicate says it should, and still refuses the one it always refused.
 */
describe("sprint 7 día 6 — «Equipo» en el menú, y «Avance» nunca ofrecida", () => {
  it("finds Equipo by search, inserts it with a placeholder card, and never offers Avance", async () => {
    const walkPage = await (await browser.newContext()).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Fisio Ribera");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Fisioterapia", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.fill("#direccion", "Cta. de Santo Domingo, 2, Ronda");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Que me llamen", { exact: true }).click();
      await walkPage.fill("#telefono", "600111222");
      await walkPage.getByRole("button", { name: "Crear mi web" }).click();
      await walkPage.getByText("Ver a tamaño real →").first().click();

      const frame = walkPage.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();

      await frame.getByRole("button", { name: "Añadir sección aquí" }).first().click();
      await frame.locator(".rb-menu-search").fill("equipo");
      const teamChoice = frame.locator(".rb-menu-list .rb-menu-choice", { hasText: "Equipo" });
      await expect(teamChoice).toBeVisible();
      // What `canBeBlank` refuses is absent from the search results too, not merely unlisted at
      // the top: «Avance» answers to nothing typed, because the menu it feeds cannot offer one.
      await expect(
        frame.locator(".rb-menu-list .rb-menu-choice", { hasText: "Avance" }),
      ).toHaveCount(0);
      await teamChoice.click();

      const section = frame.locator('[data-preset="team"]');
      await expect(section).toBeVisible();
      await expect(section.locator('[data-slot="photo"]')).toBeVisible();
      await expect(section.locator('[data-slot="name"]')).toContainText("Escribe aquí");
      await expect(section.locator('[data-slot="job"]')).toContainText("Escribe aquí");

      // And with no search filter at all, «Equipo» is in the unfiltered list — the direct
      // consequence of `canBeBlank` rather than a name this file had to be taught.
      await frame.getByRole("button", { name: "Añadir sección aquí" }).last().click();
      await expect(
        frame.locator(".rb-menu-list .rb-menu-choice", { hasText: "Equipo" }),
      ).toBeVisible();
    } finally {
      await walkPage.context().close();
    }
  });
});

/**
 * Sprint 7 day 7 — two findings from this sprint's own walks, fixed rather than carried into
 * the buffer as debt. Both are layout bugs `apps/editor`'s own test project cannot see:
 * `vitest.config.ts` gives it a node project with no DOM, so a shift measured in real pixels is
 * only ever provable here, against the real, running application.
 */
describe("sprint 7 día 7 — dos hallazgos de esta semana, cerrados", () => {
  it("day 3: the page tab strip never overlaps the device toggle, at three pages", async () => {
    // The finding, precisely: `EditorShell`'s header splits into three flex zones, and the two
    // outer ones used to share the leftover space evenly with each other rather than yielding to
    // the middle one — which is the only zone built to give way (`overflow-x-auto`, since sprint
    // 5). At three pages the right zone lost that split by exactly the width `.rb-panel`'s own
    // "Guardado en este navegador" needs, and undo/redo visibly compressed to two thirds their
    // size on top of the overlap itself.
    const walkPage = await (
      await browser.newContext({ viewport: { width: 1280, height: 900 } })
    ).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Taberna Santo Domingo");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Restaurante y bar", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Comidas", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.fill("#direccion", "Cta. de Santo Domingo, 2, Ronda");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Que reserven", { exact: true }).click();
      await walkPage.fill("#enlace", "https://reservas.example.com/taberna");
      await walkPage.getByRole("button", { name: "Crear mi web" }).click();
      await walkPage.getByText("Ver a tamaño real →").first().click();

      const frame = walkPage.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      for (const id of ["sec-services", "sec-location"]) {
        await frame.locator(`[data-section="${id}"]`).click();
        await frame
          .locator(
            `[data-section="${id}"] .rb-action[aria-label="Convertir esta sección en página"]`,
          )
          .click();
      }
      await expect(walkPage.locator(".overflow-x-auto button")).toHaveCount(3);
      // Autosave is what actually grows the right zone — its "Guardado" tick is what was
      // missing from the header at the instant of the last click, and the overlap only exists
      // once it lands.
      await expect(walkPage.getByText("Guardado en este navegador")).toBeVisible({
        timeout: 5_000,
      });

      const strip = await walkPage.locator(".overflow-x-auto").first().boundingBox();
      const toggle = await walkPage.locator('button[aria-label*="óvil"]').boundingBox();
      expect(strip, "tab strip").not.toBeNull();
      expect(toggle, "device toggle").not.toBeNull();
      if (strip && toggle) {
        expect(
          strip.x + strip.width,
          "strip's right edge vs toggle's left edge",
        ).toBeLessThanOrEqual(toggle.x);
      }

      // And the buttons that were visibly compressed are back to their declared 30×30 size.
      const undo = await walkPage
        .getByRole("button", { name: "Deshacer", exact: true })
        .boundingBox();
      expect(undo?.width, "undo button width").toBeCloseTo(30, 0);
    } finally {
      await walkPage.context().close();
    }
  });

  it("day 5: the warning reserves its space, so picking a sector never moves the grid", async () => {
    // The finding: the warning box used to be conditionally mounted, and `Shell` centers every
    // step's card vertically in the viewport (`ui.tsx`) — so mounting or unmounting anything
    // inside the card recentres the whole thing, moving the card the owner just pressed out from
    // under the pointer. Proved to be about presence rather than position: moving the box below
    // the grid first only flipped which direction the shift went. The fix keeps the box always
    // in the layout and toggles `visibility`, so the card's own height — and everything's
    // position inside it — never depends on which sector is picked.
    const walkPage = await (
      await browser.newContext({ viewport: { width: 1280, height: 950 } })
    ).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Fisio Ribera");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();

      const grid = walkPage.locator("fieldset").first();
      const warning = walkPage.getByText(/Todavía no tenemos textos preparados/);
      const before = await grid.boundingBox();

      // A covered sector: the warning stays hidden and the grid does not move.
      await walkPage.getByText("Restaurante y bar", { exact: true }).click();
      await expect(warning).toBeHidden();
      expect((await grid.boundingBox())?.y).toBe(before?.y);
      const hiddenBox = await warning.boundingBox();

      // And the mechanism itself, measured rather than inferred: the box occupies **the same
      // height whether it is showing or not**, which is what `visibility: hidden` buys and what
      // `display: none` would not.
      //
      // This used to be phrased as "pick an uncovered sector, watch the grid not move", with
      // «Fisioterapia» as the uncovered one. That subject can be signed away — and when the
      // seven drafts are signed there is no *named* sector left without a bank, so the claim
      // would have had no way to be made at all. «Otro sector» is the permanent uncovered case,
      // but selecting it also reveals its own description field, which legitimately does change
      // the card's height; so the comparison is between the warning box's own two states, not
      // between two grid positions.
      await walkPage.getByText("Otro sector", { exact: true }).click();
      await expect(warning).toBeVisible();
      const visibleBox = await warning.boundingBox();

      expect(hiddenBox?.height, "the hidden box still reserves its space").toBeGreaterThan(0);
      expect(visibleBox?.height, "showing it changes nothing about the space it takes").toBe(
        hiddenBox?.height,
      );
    } finally {
      await walkPage.context().close();
    }
  });
});

/**
 * Sprint 7 day 7 — the sprint's own verification line, named in the plan: «el recorrido completo
 * con una galería reordenada, una conversión deshecha, "Equipo" en la página, un sector nuevo
 * elegido en el cuestionario y el ZIP abierto sin servidor.»
 *
 * Every piece has its own unit test elsewhere — `moveItem` (day 2), `pageToSection` (day 3), the
 * seven text banks and the honest warning (days 4-5), `canBeBlank` in the menu (day 6) — and this
 * is not a second proof of any of them. What only this file can show is that five days of work,
 * done by five different hands of the same session, compose: reordering a gallery does not
 * disturb a conversion done after it, undoing that conversion does not disturb Equipo added after
 * that, and the document all five actions built together is still a ZIP that opens with no
 * server. `taller` is the sector — one of the four unsigned drafts, chosen on purpose so the
 * walk also confirms day 5's warning fires in the full journey, not only in isolation.
 */
describe("sprint 7 día 7 — el recorrido completo del sprint", () => {
  it("reorders a gallery, undoes a conversion, adds Equipo, and downloads a ZIP that opens offline", async () => {
    const walkPage = await (await browser.newContext()).newPage();
    try {
      await walkPage.goto(BASE_URL, { waitUntil: "networkidle" });
      await walkPage.fill("#nombre", "Taller Ribera");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();

      // Taller, and this walk says nothing about its bank. It used to assert the "no texts
      // prepared" warning and the empty question 3 here, which was true while the seven drafts
      // were unsigned and stops being true the day they are — and neither claim is this test's
      // job. What this walk exists to prove is that five days of separate work compose; the
      // warning has its own test above, with a subject that cannot be signed away.
      await walkPage.getByText("Taller", { exact: true }).click();
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      // Nothing ticked on question 3, whatever it happens to offer: no services section either
      // way (ADR 0013), which is the state the rest of the walk is written against.
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.fill("#direccion", "Cta. de Santo Domingo, 2, Ronda");
      await walkPage.getByRole("button", { name: "Siguiente" }).click();
      await walkPage.getByText("Que me llamen", { exact: true }).click();
      await walkPage.fill("#telefono", "600111222");
      await walkPage.getByRole("button", { name: "Crear mi web" }).click();
      await walkPage.getByText("Ver a tamaño real →").first().click();

      const frame = walkPage.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();

      // A gallery, reordered (day 2). Two photographs, captioned so the order is legible in the
      // assertions below rather than only in the item ids nobody reading this test would
      // recognise.
      await frame.getByRole("button", { name: "Añadir sección aquí" }).first().click();
      await frame.locator(".rb-menu-search").fill("fotos");
      await frame
        .locator(".rb-menu-list .rb-menu-choice", { hasText: "Fotos de trabajos" })
        .click();
      await frame.locator('[data-preset="gallery"]').waitFor();

      const captions = frame.locator('[data-preset="gallery"] [data-slot="caption"]');
      const blur = () => walkPage.getByText("Haz clic en cualquier texto para cambiarlo").click();
      await captions.first().click();
      await walkPage.keyboard.type("Primera foto");
      await blur();
      await frame.locator('[data-preset="gallery"] .rb-line-add').click();
      await expect(captions).toHaveCount(2);
      await captions.nth(1).click();
      await walkPage.keyboard.type("Segunda foto");
      await blur();

      // «Poner esta foto antes» on the second card puts it first.
      const items = frame.locator('[data-preset="gallery"] [data-item]');
      await items.nth(1).locator('[aria-label="Poner esta foto antes"]').click();
      await expect(captions).toHaveText(["Segunda foto", "Primera foto"]);

      // A conversion, undone (day 3). «Dónde estamos» becomes a page, then folds back.
      const tabs = walkPage.locator(".overflow-x-auto button");
      await expect(tabs).toHaveCount(1);
      await frame.locator('[data-section="sec-location"]').click();
      await frame
        .locator(
          '[data-section="sec-location"] .rb-action[aria-label="Convertir esta sección en página"]',
        )
        .click();
      await expect(tabs).toHaveCount(2);

      await walkPage.getByRole("button", { name: "Páginas", exact: true }).click();
      await walkPage.getByRole("button", { name: "Deshacer la conversión" }).click();
      await expect(tabs).toHaveCount(1);
      await expect(frame.locator('[data-section="sec-location"]')).toBeVisible();

      // «Equipo» (day 6), reached through the same search the gallery was.
      await walkPage.getByRole("button", { name: "Secciones", exact: true }).click();
      await frame.getByRole("button", { name: "Añadir sección aquí" }).last().click();
      await frame.locator(".rb-menu-search").fill("equipo");
      await frame.locator(".rb-menu-list .rb-menu-choice", { hasText: "Equipo" }).click();
      await expect(frame.locator('[data-preset="team"]')).toBeVisible();

      // The cover still carries a placeholder, so «Descargar» opens the warning first, same as
      // every other day-7 walk this repository has (sprint 5, sprint 6).
      await walkPage.getByRole("button", { name: "Descargar" }).click();
      const downloadAnyway = walkPage.getByRole("button", { name: "Descargar igualmente" });
      await downloadAnyway.waitFor();
      const [download, response] = await Promise.all([
        walkPage.waitForEvent("download"),
        walkPage.waitForResponse((candidate) => candidate.url().includes("/api/download")),
        downloadAnyway.click(),
      ]);
      expect(response.status()).toBe(200);

      const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-dia7-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      extractAll(zip, dir);
      const filePath = join(dir, "index.html");

      const offlinePage = await (await browser.newContext()).newPage();
      const failed: string[] = [];
      offlinePage.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
        await expect(offlinePage).toHaveTitle("Taller Ribera");

        // The reorder survived the download: the published order is the canvas order.
        await expect(offlinePage.locator('[data-slot="caption"]')).toHaveText([
          "Segunda foto",
          "Primera foto",
        ]);
        // The undone conversion survived: one page, and «Dónde estamos» is a section of it
        // rather than a link to a file that does not exist.
        await expect(offlinePage.locator('[data-section="sec-location"]')).toBeVisible();
        await expect(offlinePage.locator(".rb-nav-wide a", { hasText: "Inicio" })).toHaveCount(0);
        // Equipo survived, with the marker text an owner who never touched it would see —
        // honest, not invented, exactly as `packages/catalog/test/team.test.ts` asserts in
        // isolation.
        await expect(offlinePage.locator('[data-preset="team"]')).toBeVisible();
        await expect(
          offlinePage.locator('[data-preset="team"] [data-slot="name"]').first(),
        ).toContainText("Escribe aquí");

        // And the whole promise ADR 0001 makes: every byte the page needed was inside the ZIP.
        expect(failed).toEqual([]);
      } finally {
        await offlinePage.context().close();
      }
    } finally {
      await walkPage.context().close();
    }
  });
});

describe("sprint 8 — el modo estudio: encender, diseñar a mano, colocar, y volver", () => {
  /**
   * The studio mode's four days, against the running application.
   *
   * It is here on day 4 rather than day 7 for one reason: **the return is the thing this sprint is
   * not allowed to ship broken.** Escalating without a safe way back is precisely the Wix trap the
   * advanced dossier §2 exists to avoid, and until now the only evidence the dialog worked at all was
   * a walk in a browser that leaves nothing behind. Day 7 adds the rest of the journey.
   *
   * One context of its own, because the design-tools switch lives in `localStorage` and every other
   * flow in this file is written for an owner who never turned it on.
   */
  it("turns the tools on, lays a section out, and comes back without losing a word", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Barbería El Corte");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();

      // `Diseño` does not exist until the tools are on — ADR 0025 §6, and the dead-button rule.
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(0);

      // The switch asks the trade, never the level (dossier §4).
      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      // The question describes the tools rather than asking who the person is — ADR 0025's
      // amendment, accepted 1 October 2026. «¿Montas webs para otros?» granted the capability for
      // an answer about identity, so anyone who wanted it said yes and it filtered nobody.
      await expect(studio.getByText("¿Quieres colocar tú cada elemento?")).toBeVisible();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(1);

      // The offer, and the promise it makes before anybody accepts it.
      await frame.locator('[data-section="sec-cover"]').click();
      await frame.locator('.rb-action[aria-label="Diseñar a mano"]').first().click();
      await expect(frame.getByText("Esta sección la coloca el catálogo")).toBeVisible();

      const headline = frame.locator('[data-section="sec-cover"] [data-id="el-headline"]');
      const wordsBefore = await headline.textContent();
      const boxBefore = await headline.boundingBox();

      await frame.locator(".rb-escalate-yes").click();
      await expect(frame.locator(".rb-handmade-badge")).toHaveText("Diseñada a mano");

      // «No se mueve ni un píxel»: the same words, in the same place, the instant after.
      expect(await headline.textContent()).toBe(wordsBefore);
      expect(await headline.boundingBox()).toEqual(boxBefore);

      // The panel: collapsed on open, because encendiendo las herramientas «añade una puerta, no
      // descarga sesenta controles».
      await studio.getByRole("button", { name: "Diseño" }).click();
      const family = studio.getByRole("button", { name: "Colocación" });
      await expect(family).toHaveAttribute("aria-expanded", "false");
      await family.click();

      // The return is lossless until something moves, and a lossless return does not ask.
      await frame.locator(".rb-handmade-back").click();
      await expect(studio.getByRole("alertdialog")).toHaveCount(0);
      await expect(frame.locator(".rb-handmade")).toHaveCount(0);

      // Do it again, and this time move something, so the return has something to warn about.
      await frame.locator('[data-section="sec-cover"]').click();
      await frame.locator('.rb-action[aria-label="Diseñar a mano"]').first().click();
      await frame.locator(".rb-escalate-yes").click();
      await expect(frame.locator(".rb-handmade-badge")).toHaveText("Diseñada a mano");
      // Already expanded: the family collapses when the panel *opens*, not every time the section
      // changes — somebody working through three sections should not reopen it three times. Clicking
      // unconditionally here would close it, which is what the first version of this test did.
      const reopened = studio.getByRole("button", { name: "Colocación" });
      if ((await reopened.getAttribute("aria-expanded")) === "false") await reopened.click();

      const column = studio.getByRole("button", { name: "Columna: uno más" });
      await column.click();
      await column.click();
      // Rule 4, enforced by the interface rather than repaired afterwards: the arrow stops where the
      // element's own width stops fitting, and `setPlacement` is never sent a value it would refuse.
      while (!(await column.isDisabled())) await column.click();
      const numbers = await studio.locator("aside output").allTextContents();
      expect(Number(numbers[0]) + Number(numbers[1]) - 1).toBe(12);

      // Now the dialog, and what it says.
      await frame.locator(".rb-handmade-back").click();
      const dialog = studio.getByRole("alertdialog");
      await expect(dialog.getByRole("heading")).toHaveText("Volver a la original");
      await expect(dialog.getByText(/La colocación que hiciste a mano se pierde/)).toBeVisible();

      // Cancelling changes nothing at all.
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(frame.locator(".rb-handmade")).toHaveCount(1);
      expect(await studio.locator("aside output").allTextContents()).toEqual(numbers);

      // Confirming puts every word back in its exact slot — «lo que Wix no tiene».
      await frame.locator(".rb-handmade-back").click();
      await dialog.getByRole("button", { name: "Volver a la original" }).click();
      await expect(frame.locator(".rb-handmade")).toHaveCount(0);
      expect(await headline.textContent()).toBe(wordsBefore);
      // The panel is closed first, because it sits *beside* the canvas and narrows it — comparing a
      // box measured with it open against one measured with it shut would compare two viewport
      // widths and call the difference a regression. (It did, the first time this was written.)
      await studio.getByRole("button", { name: "Cerrar el diseño" }).click();
      expect(await headline.boundingBox()).toEqual(boxBefore);

      // And the escalation was one history step all along, so Ctrl+Z is the return of the first
      // minutes exactly as the dossier §5 says it is.
      await studio.locator('button[aria-label="Deshacer"]').click();
      await expect(frame.locator(".rb-handmade")).toHaveCount(1);

      // Turning the tools off leaves the section exactly as it is: depth belongs to the person
      // looking, never to the site (dossier §2, first row of the table).
      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(0);
      await expect(frame.locator(".rb-handmade")).toHaveCount(0);
      // Read the *stored* site, so the claim is about what survives rather than about what React is
      // rendering. Waiting for the editor's own indicator first: autosave is debounced, and flipping
      // the switch does not trigger a save at all — by design, that is `INV_4` — so the write being
      // waited for is the undo's, and reading too early answers `null`.
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      const stillFree = await studio.evaluate(() => {
        const raw = localStorage.getItem("retorika.session.v1");
        if (!raw) return null;
        const session = JSON.parse(raw) as {
          openIndex: number;
          documents: { pages: { sections: { id: string; source: string }[] }[] }[];
        };
        const doc = session.documents[session.openIndex];
        return doc?.pages[0]?.sections.find((s) => s.id === "sec-cover")?.source ?? null;
      });
      expect(stillFree).toBe("free");
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

describe("sprint 8 día 7 — el recorrido completo del sprint", () => {
  /**
   * Every day of the studio mode, in one session, ending in the same promise every day-7 walk since
   * sprint 5 has closed on: a ZIP that opens by double-clicking, with nothing missing.
   *
   * Days 2–4 already have their own e2e (day 4's flow above walks the switch, the offer, the grid and
   * the return in isolation). What none of them prove is **composition through a download** — that a
   * section moved in the grid and patched for mobile survives `render(doc, "html")` and comes back
   * out of the ZIP exactly as the editor left it. That is the one property no unit test can stand in
   * for, because it is a property of the whole pipeline rather than of any one verb.
   *
   * «Volver a la plantilla» happens **twice** on purpose: once to prove the return really does undo
   * everything with nothing left over (the promise this sprint was not allowed to ship broken), and
   * once left in its escalated state, because only a hand-designed section has mobile patches to
   * publish — reverting drops them by rule 1, so a walk that reverted and then downloaded would prove
   * nothing about whether patches reach the ZIP at all.
   */
  it("designs a section by hand, moves it, patches its mobile view, returns once, does it again, and downloads a ZIP that opens offline with the change intact", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Barbería El Corte");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();

      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(1);

      // ---- round one: escalate, move, patch — then revert, and prove nothing is left over ----
      await frame.locator('[data-section="sec-cover"]').click();
      await frame.locator('.rb-action[aria-label="Diseñar a mano"]').first().click();
      await frame.locator(".rb-escalate-yes").click();
      await expect(frame.locator(".rb-handmade-badge")).toHaveText("Diseñada a mano");

      await studio.getByRole("button", { name: "Diseño" }).click();
      await studio.getByRole("button", { name: "Titular", exact: true }).click();
      const placement = studio.getByRole("button", { name: "Colocación" });
      if ((await placement.getAttribute("aria-expanded")) === "false") await placement.click();
      const columnRight = studio.getByRole("button", { name: "Columna: uno más" });
      await columnRight.click();
      await columnRight.click();

      await studio.getByRole("button", { name: "Texto", exact: true }).click();
      const mobileFamily = studio.getByRole("button", { name: "Ajustar solo en móvil" });
      if ((await mobileFamily.getAttribute("aria-expanded")) === "false")
        await mobileFamily.click();
      await studio.getByRole("button", { name: "Ocultar aquí" }).click();
      await expect(studio.getByRole("button", { name: "Mostrar aquí" })).toBeVisible();

      // The return warns first — a placement moved and a mobile patch was written, so it is not
      // lossless (`revertImpact`, day 4).
      await frame.locator(".rb-handmade-back").click();
      const dialog = studio.getByRole("alertdialog");
      await expect(dialog.getByRole("heading")).toHaveText("Volver a la original");
      await dialog.getByRole("button", { name: "Volver a la original" }).click();
      await expect(frame.locator(".rb-handmade")).toHaveCount(0);

      // Nothing left over: a fresh escalation starts from the catalog's own layout again, not from
      // whatever round one moved it to.
      await studio.getByRole("button", { name: "Ver en ordenador" }).click();
      await frame.locator('[data-section="sec-cover"]').click();
      await frame.locator('.rb-action[aria-label="Diseñar a mano"]').first().click();
      await frame.locator(".rb-escalate-yes").click();
      await expect(frame.locator(".rb-handmade-badge")).toHaveText("Diseñada a mano");

      const headlineStyleAfterFreshEscalate = await frame
        .locator('[data-section="sec-cover"] [data-id="el-headline"]')
        .getAttribute("style");
      expect(headlineStyleAfterFreshEscalate).toContain("grid-column:1/span 6");

      // ---- round two: this is the state that goes into the ZIP ----
      await studio.getByRole("button", { name: "Titular", exact: true }).click();
      await columnRight.click();
      await columnRight.click();
      await columnRight.click();
      const columnNow = await studio.locator("aside output").first().textContent();
      expect(columnNow).toBe("4");

      await studio.getByRole("button", { name: "Foto", exact: true }).click();
      await studio.getByRole("button", { name: "Foto menor" }).click();
      // Addressed by what it says rather than by where it sits. `aside p` at `nth(-2)` meant this
      // paragraph until sprint 9 day 5 added a family below it, and then it meant the panel's
      // closing note — a positional locator into a panel changes subject every time the panel
      // grows, which is a test quietly asking a different question.
      await expect(studio.getByText("Ancho en móvil: 9 de 12")).toBeVisible();

      await studio.getByRole("button", { name: "Texto", exact: true }).click();
      await studio.getByRole("button", { name: "Ocultar aquí" }).click();
      await expect(studio.getByRole("button", { name: "Mostrar aquí" })).toBeVisible();

      // Left hand-designed, deliberately: reverting here would drop the placement and the mobile
      // patches by rule 1, and then the download below would prove nothing about whether either
      // survives publishing.
      await studio.getByRole("button", { name: "Cerrar el diseño" }).click();

      // ---- the download, and the ZIP opened with no server (ADR 0001) ----
      await studio.getByRole("button", { name: "Descargar" }).click();
      const downloadAnyway = studio.getByRole("button", { name: "Descargar igualmente" });
      await downloadAnyway.waitFor();
      const [download, response] = await Promise.all([
        studio.waitForEvent("download"),
        studio.waitForResponse((candidate) => candidate.url().includes("/api/download")),
        downloadAnyway.click(),
      ]);
      expect(response.status()).toBe(200);

      const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-sprint8-dia7-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      extractAll(zip, dir);
      const filePath = join(dir, "index.html");

      const offlinePage = await (await browser.newContext()).newPage();
      const failed: string[] = [];
      offlinePage.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
        await expect(offlinePage).toHaveTitle("Barbería El Corte");

        // The placement round two made survived render(doc, "html") and the ZIP: the headline's own
        // grid-column is the one the panel showed, not the catalog's original 1/span 6.
        const headline = offlinePage.locator('[data-id="el-headline"]');
        await expect(headline).toHaveAttribute("style", /grid-column:4\/span 6/);

        // The mobile patches published in their own @media block, and take effect at mobile width —
        // measured with real CSS in a real browser, not read off the stylesheet's text.
        await offlinePage.setViewportSize({ width: 390, height: 800 });
        const mobileState = await offlinePage.evaluate(() => {
          const body = document.querySelector('[data-id="el-body"]') as HTMLElement | null;
          const image = document.querySelector('[data-id="el-image"]') as HTMLElement | null;
          // The headline carries no mobile patch, so it is the automatic derivation's own full
          // width — the baseline the narrowed photo is compared against, rather than against a
          // padding constant this test would have to know by heart.
          const headline = document.querySelector('[data-id="el-headline"]') as HTMLElement | null;
          return {
            bodyDisplay: body ? getComputedStyle(body).display : null,
            imageWidth: image ? image.getBoundingClientRect().width : null,
            headlineWidth: headline ? headline.getBoundingClientRect().width : null,
            scrolls: document.body.scrollWidth > document.body.clientWidth,
          };
        });
        expect(mobileState.bodyDisplay).toBe("none");
        // Nine twelfths, against the unpatched headline's own width as the whole.
        expect(mobileState.imageWidth).not.toBeNull();
        expect(mobileState.headlineWidth).not.toBeNull();
        const ratio = (mobileState.imageWidth as number) / (mobileState.headlineWidth as number);
        expect(ratio).toBeGreaterThan(0.7);
        expect(ratio).toBeLessThan(0.8);
        expect(mobileState.scrolls).toBe(false);

        // And the desktop shape the mobile patches must never touch (rule 7): the photo back to its
        // full desktop placement, wider than at mobile, and the hidden body visible again.
        await offlinePage.setViewportSize({ width: 1280, height: 900 });
        const desktopWidths = await offlinePage.evaluate(() => {
          const image = document.querySelector('[data-id="el-image"]') as HTMLElement | null;
          return { image: image ? image.getBoundingClientRect().width : null };
        });
        expect(desktopWidths.image).not.toBeNull();
        expect(desktopWidths.image as number).toBeGreaterThan(mobileState.imageWidth as number);
        await expect(offlinePage.locator('[data-id="el-body"]')).toBeVisible();

        // The whole promise ADR 0001 makes: every byte the page needed was inside the ZIP.
        expect(failed).toEqual([]);
      } finally {
        await offlinePage.context().close();
      }
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

describe("sprint 8 día 7 — colchón: los tiradores no desplazan el lienzo", () => {
  /**
   * The finding day 3 deferred to this day's buffer and day 5 mentioned again: selecting *any*
   * section made the preview canvas scroll 4px sideways.
   *
   * Measured to the actual cause rather than guessed: `.rb-handle-tr` and `.rb-handle-br` sit at
   * `right: -4px` on a full-bleed section — a deliberate touch, a resize handle straddling its
   * outline rather than hugging it — and the section has no margin to absorb that 4px of bleed.
   * Predates this sprint, and is editor chrome that never reaches a published page: `.rb-handle`
   * appears nowhere in `packages/renderer`.
   *
   * The right measurement is not `scrollWidth > clientWidth` — `scrollWidth` reports an element's
   * content extent regardless of whether `overflow` lets anything scroll to see it, so that
   * comparison stays true after the fix even though nothing can actually be scrolled. The real
   * question is whether the page **can be scrolled**, which is what this test asks directly.
   */
  it("cannot be scrolled sideways after selecting a section, though it could be", async () => {
    const page = await (await browser.newContext()).newPage();
    try {
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
      await page.getByText("Ver a tamaño real →").first().click();

      const frame = page.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').click();

      const scrollable = await frame.locator("body").evaluate(() => {
        const before = window.scrollX;
        window.scrollTo({ left: 9999, behavior: "instant" });
        const after = window.scrollX;
        window.scrollTo({ left: before, behavior: "instant" });
        return after > 0;
      });
      expect(scrollable).toBe(false);

      // The handle keeps its own design — still 4px past the section's right edge, not moved
      // inward to make this pass. `overflow-x: clip` hides the bleed; it does not relocate it.
      const handleBox = await frame.locator(".rb-handle-tr").boundingBox();
      const sectionBox = await frame.locator('[data-section="sec-cover"]').boundingBox();
      expect(handleBox).not.toBeNull();
      expect(sectionBox).not.toBeNull();
      if (handleBox && sectionBox) {
        expect(handleBox.x + handleBox.width).toBeGreaterThan(sectionBox.x + sectionBox.width);
      }
    } finally {
      await page.context().close();
    }
  });
});

/**
 * Sprint 9 day 4 — the floating toolbar.
 *
 * **Both defects this pins were invisible to every other suite**, and both were found by walking
 * the editor rather than by a failing assertion:
 *
 * 1. The bar appeared on the cover and on **no other section**. Clicking from one text straight to
 *    another fires the new element's `focus` before the old one's deferred `blur`, so the blur tore
 *    down the bar it had never opened.
 * 2. It was positioned with `el.offsetTop - section.offsetTop`, and `offsetTop` is already measured
 *    against the section — the nearest positioned ancestor. The subtraction skewed it by however
 *    far down the page the section sat, and it *read* as correct only because the error pushed the
 *    calculation into the flip branch, which pushed the bar back up by about the same amount.
 *
 * A unit test could not have seen either: one is an event ordering in a real document, the other is
 * layout geometry.
 */
describe("sprint 9 día 4 — la barra flotante", () => {
  it("appears on every section, writes a reference, and never saves its own words into the text", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Barbería El Corte");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();

      // The design tools are **off**, and the bar is still there: the advanced dossier §4 gives
      // «color del tema» to everybody, and this is that sentence as a test.
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(0);

      const headline = frame.locator('[data-section="sec-cover"] [data-id="el-headline"]');
      const wordsBefore = await headline.textContent();
      await headline.click();
      const bar = frame.locator(".rb-toolbar");
      await expect(bar).toHaveCount(1);

      // Defect 1's other half: the bar is a child of the **section**, never of the element.
      // `wireEditing` commits `el.textContent` on blur, so a bar inside the `<h1>` would be saved
      // into the heading on the first click.
      expect(await bar.evaluate((el) => el.parentElement?.getAttribute("data-section"))).toBe(
        "sec-cover",
      );

      // Four swatches on a heading: the four foregrounds proved against `color.surface`. Not five
      // — `color.surface` on `color.surface` is 1:1 and is never offered.
      await expect(bar.locator(".rb-toolbar-swatch")).toHaveCount(4);
      await expect(bar.locator('.rb-toolbar-swatch[data-ref="color.surface"]')).toHaveCount(0);

      await bar.locator('.rb-toolbar-swatch[data-ref="color.muted"]').click();
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();

      // The words are untouched, in the document rather than on the screen.
      expect(await frame.locator('[data-id="el-headline"]').textContent()).toBe(wordsBefore);
      const stored = await studio.evaluate(() => {
        const raw = localStorage.getItem("retorika.session.v1");
        if (!raw) return null;
        const session = JSON.parse(raw) as {
          openIndex: number;
          documents: {
            pages: {
              sections: { content: { id: string; style?: unknown; value?: unknown }[] }[];
            }[];
          }[];
        };
        const element = session.documents[session.openIndex]?.pages[0]?.sections[0]?.content.find(
          (c) => c.id === "el-headline",
        );
        return { style: element?.style ?? null, value: element?.value ?? null };
      });
      expect(stored?.style).toEqual({ color: { ref: "color.muted" } });
      expect(stored?.value).toEqual({ kind: "text", text: "Barbería El Corte" });

      // The bar survives the edit. Writing a style rebuilds `srcDoc`, and before this it vanished
      // the moment it was used — one press per click into the text.
      await expect(frame.locator(".rb-toolbar")).toHaveCount(1);

      // Defect 1: every section, not only the first. Each bar belongs to its own section and sits
      // inside it, which the old arithmetic could not have managed for a section 446px down.
      const sections = await frame
        .locator("[data-section]")
        .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset["section"]));
      expect(sections.length).toBeGreaterThan(2);
      for (const id of sections) {
        const target = frame.locator(`[data-section="${id}"] :is(h1,h2,h3,p,a)[data-id]`).first();
        if ((await target.count()) === 0) continue;
        await target.click();
        const open = frame.locator(".rb-toolbar");
        await expect(open, `no toolbar in ${id}`).toHaveCount(1);
        const placement = await open.evaluate((el) => {
          const section = el.parentElement as HTMLElement;
          const bar = el.getBoundingClientRect();
          const box = section.getBoundingClientRect();
          return {
            parent: section.dataset["section"],
            // Generous bounds: what is being checked is that it is near its own section rather
            // than hundreds of pixels adrift, which is what the old subtraction produced.
            near: bar.top > box.top - 80 && bar.bottom < box.bottom + 80,
          };
        });
        expect(placement.parent, `toolbar parented wrongly for ${id}`).toBe(id);
        expect(placement.near, `toolbar adrift from ${id}`).toBe(true);
      }

      // A button's list is computed from its own background, so it is one swatch and not four.
      const button = frame.locator('[data-role="button"]').first();
      if ((await button.count()) > 0) {
        await button.click();
        await expect(frame.locator(".rb-toolbar-swatch")).toHaveCount(1);
        await expect(frame.locator('.rb-toolbar-swatch[data-ref="color.surface"]')).toHaveCount(1);
        await expect(frame.locator(".rb-toolbar-link")).toHaveCount(1);
      }
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

/**
 * Sprint 9 day 5 — measures, spacing, and the first marked exception.
 *
 * The narrow-window case is the one worth an e2e rather than a unit test. With the design tools on
 * the bar reaches 904px, and `MIN_STUDIO_WIDTH` lets the switch be turned on at 1024 — so at an
 * editor 1100px wide the section is 828px and the bar ran past its right edge, behind the frame's
 * own `overflow-x: clip`. The last group was on the screen and could not be pressed. Nothing but a
 * real browser at a real width can see that.
 */
describe("sprint 9 día 5 — medidas, espaciado y la excepción marcada", () => {
  it("writes a reference and an exact value, and the audit takes the exception back off", async () => {
    // Deliberately the width the defect appeared at, not a comfortable one.
    const studio = await (
      await browser.newContext({ viewport: { width: 1100, height: 1000 } })
    ).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Reformas Vega");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const headline = frame.locator('[data-section="sec-cover"] [data-id="el-headline"]');

      // Off: no measurements at all. The "Apagado" row of the §4 table is text, size, colour, link.
      await headline.click();
      await expect(frame.locator(".rb-toolbar-select")).toHaveCount(0);
      await expect(frame.locator(".rb-toolbar-exact")).toHaveCount(0);

      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();
      await headline.click();
      await expect(frame.locator(".rb-toolbar-select")).toHaveCount(2);
      // Three exact inputs since sprint 10 day 6, not two: `fontSize` joined `EXACT_TODAY` the day
      // the gate learned to measure a page at 320px, which is what ADR 0026 §2 held it back for.
      // The size one is **first** in the bar, because it sits beside the three size steps rather
      // than in the measures group — so everything below addresses its input by name instead of by
      // position, which is what this assertion going red taught.
      await expect(frame.locator(".rb-toolbar-exact")).toHaveCount(3);

      // Every control reachable inside the frame, at the width where it was not.
      const reach = await frame.locator(".rb-toolbar").evaluate((bar) => {
        const section = bar.parentElement as HTMLElement;
        const last = bar.querySelector(".rb-toolbar-group:last-child") as HTMLElement;
        return {
          barWider: bar.getBoundingClientRect().width > section.clientWidth,
          lastVisible:
            last.getBoundingClientRect().right <= document.documentElement.clientWidth &&
            last.getBoundingClientRect().left >= 0,
        };
      });
      expect(reach.barWider, "the bar is wider than its section").toBe(false);
      expect(reach.lastVisible, "the last group is off the frame").toBe(true);

      // A reference: the spacing follows the system.
      await frame.locator(".rb-toolbar-select").first().selectOption("space.lg");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      expect(
        await frame
          .locator('[data-id="el-headline"]')
          .evaluate((el) => getComputedStyle(el).padding),
      ).toBe("24px");

      // An exact value: rule 6's second arm, arriving for the first time in the product.
      await headline.click();
      const exactPadding = frame.locator('.rb-toolbar-exact[aria-label^="Espaciado"]');
      await exactPadding.fill("37");
      await exactPadding.dispatchEvent("change");
      await expect(frame.locator('[data-id="el-headline"]')).toHaveCSS("padding", "37px");

      // Marked, in the document, rather than merely applied.
      // Polled rather than read once: autosave is debounced, so the stylesheet shows the new
      // padding before localStorage has it, and a single read answers with the *previous* write.
      // That is what this assertion caught on its first run — `{ref: "space.lg"}`, which was true a
      // moment earlier and is exactly the kind of near-miss a fixed wait hides.
      await expect
        .poll(
          () =>
            studio.evaluate(() => {
              const raw = localStorage.getItem("retorika.session.v1");
              if (!raw) return null;
              const session = JSON.parse(raw) as {
                openIndex: number;
                documents: {
                  pages: { sections: { content: { id: string; style?: unknown }[] }[] }[];
                }[];
              };
              return (
                session.documents[session.openIndex]?.pages[0]?.sections[0]?.content.find(
                  (c) => c.id === "el-headline",
                )?.style ?? null
              );
            }),
          { timeout: 10_000 },
        )
        .toEqual({ padding: { exact: "37px", exception: true } });

      // The audit finds it, names it in the owner's own words, and gives it back to the system.
      await studio.getByRole("button", { name: "Diseño" }).click();
      const panel = studio.locator("aside").first();
      await panel.getByRole("button", { name: /Fuera del sistema \(1\)/ }).click();
      await expect(panel.getByText("Reformas Vega")).toBeVisible();
      await expect(panel.getByText("37px")).toBeVisible();

      await panel.getByRole("button", { name: "Volver al sistema" }).click();
      await expect(frame.locator('[data-id="el-headline"]')).toHaveCSS("padding", "0px");
      // And the audit says what being empty means, rather than showing an empty box.
      await expect(
        panel.getByText("Toda tu web usa los colores y las medidas del sistema.", { exact: false }),
      ).toBeVisible();
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

/**
 * Sprint 9 day 6 — the pre-publish contrast review.
 *
 * The advanced dossier §4 promised it in phase 0 and `docs/tasks/a11y.md` has cited it since
 * sprint 2. It is also the net ADR 0026 §2 couples the exact colour to: the control that can write
 * an unreadable colour and the gate that refuses one ship together, and this is the test that they
 * did.
 *
 * **The chain is the part only a browser could have found.** A site can be two kinds of
 * not-quite-ready at once — an unfilled photo marker and a hard-to-read colour — and «Descargar
 * igualmente» used to call `download()`, so the second warning was never said at all.
 */
describe("sprint 9 día 6 — la revisión de contraste", () => {
  async function studioWithTools(): Promise<Page> {
    const studio = await (await browser.newContext()).newPage();
    await studio.goto(BASE_URL, { waitUntil: "networkidle" });
    await studio.fill("#nombre", "Reformas Vega");
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Peluquería y barbería", { exact: true }).click();
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.fill("#direccion", "Calle Espinel 12, Ronda");
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Que me llamen", { exact: true }).click();
    await studio.fill("#telefono", "600111222");
    await studio.getByRole("button", { name: "Crear mi web" }).click();
    await studio.getByText("Ver a tamaño real →").first().click();
    await studio.frameLocator("iframe").first().locator('[data-section="sec-cover"]').waitFor();
    await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
    await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();
    return studio;
  }

  /** Paint the cover's headline an exact colour, through the toolbar's own control. */
  async function paint(studio: Page, hex: string): Promise<void> {
    const frame = studio.frameLocator("iframe").first();
    await frame.locator('[data-section="sec-cover"] [data-id="el-headline"]').click();
    await frame.locator(".rb-toolbar-color").waitFor();
    // `fill` does not fire `change` on a colour input the way a picker does.
    await frame.locator(".rb-toolbar-color").evaluate((el, value) => {
      (el as HTMLInputElement).value = value as string;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, hex);
    await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
  }

  it("blocks an unreadable colour with no way past, and fixes it in one click", async () => {
    const studio = await studioWithTools();
    try {
      // 1.0:1 — white on white. Measured, not guessed: `color.surface` is #FFFFFF.
      await paint(studio, "#ffffff");
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();

      const dialog = studio.getByRole("alertdialog");
      await expect(dialog.getByText("Hay texto que no se puede leer")).toBeVisible();
      // Named in the owner's own words, with the number that justifies the refusal.
      await expect(dialog.getByText("Reformas Vega")).toBeVisible();
      await expect(dialog.getByText("1,0 de contraste")).toBeVisible();
      // No way past: the same shape `TooManyPhotosDialog` has, because there is nothing to decide.
      await expect(dialog.getByRole("button", { name: "Descargar igualmente" })).toHaveCount(0);

      // The one-click fix is to drop the exception, so the reference underneath shows through.
      await dialog.getByRole("button", { name: "Volver al color del tema" }).click();
      // Polled, for the reason day 5's test records: autosave is debounced, so the document is
      // fixed before storage says so and a single read answers with the state before the click.
      await expect
        .poll(
          () =>
            studio.evaluate(() => {
              const raw = localStorage.getItem("retorika.session.v1");
              if (!raw) return "missing";
              const session = JSON.parse(raw) as {
                openIndex: number;
                documents: {
                  pages: { sections: { content: { id: string; style?: unknown }[] }[] }[];
                }[];
              };
              const element = session.documents[
                session.openIndex
              ]?.pages[0]?.sections[0]?.content.find((c) => c.id === "el-headline");
              return element && "style" in element ? "still styled" : "back to the system";
            }),
          { timeout: 10_000 },
        )
        .toBe("back to the system");
    } finally {
      await studio.context().close();
    }
  }, 120_000);

  it("says both warnings, one after the other, and only then downloads", async () => {
    const studio = await studioWithTools();
    try {
      // 3.95:1 — between the two thresholds, so it warns rather than blocks.
      await paint(studio, "#808080");
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();

      // The photo warning first: it is about the whole site, and a site nobody can read is not in
      // a state where "some of your photographs are still ours" is the useful thing to say.
      await expect(studio.getByText("Antes de descargar")).toBeVisible();
      await studio.getByRole("button", { name: "Descargar igualmente" }).click();

      // Then the contrast one, which used to be skipped entirely.
      const contrast = studio.getByRole("alertdialog");
      await expect(contrast.getByText("Un texto se lee justo")).toBeVisible();
      await expect(contrast.getByText("3,8 de contraste")).toBeVisible();

      const [download] = await Promise.all([
        studio.waitForEvent("download"),
        contrast.getByRole("button", { name: "Descargar igualmente" }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

describe("sprint 9 día 7 — el recorrido completo del sprint", () => {
  /**
   * Every day of the style system, in one session, ending in the promise every day-7 walk since
   * sprint 5 has closed on: a ZIP that opens by double-clicking, with nothing missing — and this
   * time with an element's own style surviving the trip.
   *
   * Days 4–6 already have their own e2e, each in isolation. What none of them prove is
   * **composition through a download**: that a reference, an exact value, and the fix a blocked
   * download forced all survive `render(doc, "html")` and come back out of the ZIP exactly as the
   * editor left them — the one property no unit test can stand in for, because it belongs to the
   * whole pipeline rather than to any single verb.
   *
   * The sequence follows the plan's own words for this day: touch a text, change its size and
   * colour by reference, turn the tools on, press an exact value in, see it marked in the audit,
   * try to download with an illegible colour and fail, fix it in one click, and download.
   */
  it("touches a text, styles it by reference and by exception, is blocked and recovers, and downloads a ZIP with the style intact", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Reformas Vega");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const headline = frame.locator('[data-section="sec-cover"] [data-id="el-headline"]');

      // ---- day 4: a reference, with the tools off ----
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(0);
      await headline.click();
      const bar = frame.locator(".rb-toolbar");
      await expect(bar).toHaveCount(1);
      await bar.locator('.rb-toolbar-step[data-ref="size.subheading"]').click();
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(frame.locator('[data-id="el-headline"]')).toHaveCSS("font-size", "24px");

      await headline.click();
      await frame.locator('.rb-toolbar-swatch[data-ref="color.muted"]').click();
      // #57534E — «peluquería y barbería» generates on `warm-terracotta`, not `classic-blue`, so
      // this is that palette's own `color.muted` rather than the value most of this file's other
      // walks reach for. Measured rather than assumed, which is the whole discipline this file
      // exists to keep.
      await expect(frame.locator('[data-id="el-headline"]')).toHaveCSS("color", "rgb(87, 83, 78)");

      // ---- day 1/5: the tools, and measures behind them ----
      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();
      await expect(studio.getByRole("button", { name: "Diseño" })).toHaveCount(1);

      await headline.click();
      await expect(frame.locator(".rb-toolbar-select")).toHaveCount(2);
      await frame.locator(".rb-toolbar-select").first().selectOption("space.lg");
      await expect(frame.locator('[data-id="el-headline"]')).toHaveCSS("padding", "24px");

      // ---- day 6: an exact colour that blocks, then the one-click fix ----
      await headline.click();
      await frame.locator(".rb-toolbar-color").waitFor();
      await frame.locator(".rb-toolbar-color").evaluate((el) => {
        (el as HTMLInputElement).value = "#ffffff";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();

      // The audit sees it (day 5's surface), marked and named in the owner's own words.
      await studio.getByRole("button", { name: "Diseño" }).click();
      const panel = studio.locator("aside").first();
      await panel.getByRole("button", { name: /Fuera del sistema/ }).click();
      await expect(panel.getByText("Reformas Vega")).toBeVisible();

      // The download is blocked — no way past, with the number that justifies it.
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();
      const blocked = studio.getByRole("alertdialog");
      await expect(blocked.getByText("Hay texto que no se puede leer")).toBeVisible();
      await expect(blocked.getByRole("button", { name: "Descargar igualmente" })).toHaveCount(0);

      // Fixed in one click, from the dialog itself — back to a reference, not a guessed colour.
      await blocked.getByRole("button", { name: "Volver al color del tema" }).click();
      await expect(blocked).toHaveCount(0);

      // ---- press an exact value in for real, this time a legible one, so the ZIP has something
      //      to prove: the exception arm surviving the trip, not just the reference arm ----
      await headline.click();
      await frame.locator(".rb-toolbar-color").waitFor();
      await frame.locator(".rb-toolbar-color").evaluate((el) => {
        (el as HTMLInputElement).value = "#7a1f1f";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await expect
        .poll(() =>
          frame.locator('[data-id="el-headline"]').evaluate((el) => getComputedStyle(el).color),
        )
        .toBe("rgb(122, 31, 31)");

      // ---- the download, and the ZIP opened with no server (ADR 0001) ----
      // The cover's photo is still the catalog's own marker — nobody in this walk uploaded one —
      // so the photo warning stands between here and the file, same as every other download walk
      // in this suite.
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();
      const photoWarning = studio.getByRole("button", { name: "Descargar igualmente" });
      await photoWarning.waitFor();
      const [download, response] = await Promise.all([
        studio.waitForEvent("download"),
        studio.waitForResponse((candidate) => candidate.url().includes("/api/download")),
        photoWarning.click(),
      ]);
      expect(response.status()).toBe(200);

      const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-sprint9-dia7-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      extractAll(zip, dir);
      const filePath = join(dir, "index.html");

      const offlinePage = await (await browser.newContext()).newPage();
      const failed: string[] = [];
      offlinePage.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
        await expect(offlinePage).toHaveTitle("Reformas Vega");

        const el = offlinePage.locator('[data-id="el-headline"]');
        // The reference: still 24px, still color.muted's own size, proving rule 6's first arm
        // survived render(doc, "html") unaltered.
        await expect(el).toHaveCSS("font-size", "24px");
        await expect(el).toHaveCSS("padding", "24px");
        // The exact value: literal, not var(--color-x), and still the colour that was pressed —
        // the exception arm reaching a published page for the first time in the product.
        await expect(el).toHaveCSS("color", "rgb(122, 31, 31)");

        // And the rule 6 block sits above everything else in the stylesheet, exactly as day 3
        // measured: the colour applies even though `.rb-section h1` also sets one.
        const css = await offlinePage.evaluate(() =>
          [...document.styleSheets]
            .flatMap((sheet) => [...sheet.cssRules])
            .some(
              (rule) =>
                "selectorText" in rule &&
                (rule as CSSStyleRule).selectorText?.includes("[data-role]") &&
                (rule as CSSStyleRule).style.color !== "",
            ),
        );
        expect(css).toBe(true);

        expect(failed).toEqual([]);
      } finally {
        await offlinePage.context().close();
      }
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

describe("sprint 9 día 7 — colchón: el diálogo se queda sobre lo que sigue mal", () => {
  /**
   * The finding the day-7 walk made: paint two elements unreadable, open the block dialog, fix
   * the first. Before this, the dialog closed — over a document that still had the second,
   * unfixed finding in it. Closing looked exactly like success, and nothing said another press
   * of «Descargar» was still necessary.
   */
  it("stays open on a remaining finding, and closes without downloading once none are left", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Reformas Vega");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();

      const paint = async (elementId: string, hex: string) => {
        await frame.locator(`[data-section="sec-cover"] [data-id="${elementId}"]`).click();
        await frame.locator(".rb-toolbar-color").waitFor();
        await frame.locator(".rb-toolbar-color").evaluate((el, value) => {
          (el as HTMLInputElement).value = value as string;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, hex);
        await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      };

      // Two elements, both under 3:1 against their own background.
      await paint("el-headline", "#fefefe");
      await paint("el-body", "#fdfdfd");

      await studio.getByRole("button", { name: "Descargar", exact: true }).click();
      const dialog = studio.getByRole("alertdialog");
      await expect(dialog.getByRole("button", { name: "Volver al color del tema" })).toHaveCount(2);

      await dialog.getByRole("button", { name: "Volver al color del tema" }).first().click();

      // The dialog is still here, with the one finding that is still true.
      await expect(studio.getByRole("alertdialog")).toHaveCount(1);
      await expect(
        studio.getByRole("alertdialog").getByRole("button", { name: "Volver al color del tema" }),
      ).toHaveCount(1);

      // The second fix closes it — and does not download on its own. `download` was never
      // triggered by this click; only an explicit press of «Descargar» does that, and this walk
      // does not make one, so no download event should ever fire here.
      const downloadPromise = studio
        .waitForEvent("download", { timeout: 2000 })
        .then(() => "downloaded")
        .catch(() => "no download");
      await studio
        .getByRole("alertdialog")
        .getByRole("button", { name: "Volver al color del tema" })
        .click();
      await expect(studio.getByRole("alertdialog")).toHaveCount(0);
      expect(await downloadPromise).toBe("no download");
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

describe("sprint 9 día 7 — colchón: la barra no traga un clic que era para otro elemento", () => {
  /**
   * Found chasing the CI run of the walk above, which failed on a machine this one did not: the
   * same click, on the same document, blocked on a GitHub Actions runner and succeeded on a
   * laptop. The difference was font metrics between the two Chromium builds, not the logic — and
   * that is exactly why this is pinned at a fixed width rather than left to whatever a given
   * machine happens to render: 1100px, inside `MIN_STUDIO_WIDTH`'s own floor, is where painting the
   * headline's exact colour reliably grows its wrapped bar to 66px tall and puts its bottom edge
   * past the body paragraph's own top — a real, supported width, not a contrived one.
   *
   * The bar's every blank pixel used to be a `<div>`'s own hit-testing box, and its own `click`
   * handler stopped propagation on all of it — so a click meant for the paragraph hidden underneath
   * landed on the bar instead and went nowhere. `pointer-events: none` on the bar with `auto` on
   * each control turns that blank space to glass: the click reaches the paragraph, which opens its
   * own toolbar, while every real button, swatch, select and input keeps working exactly as before.
   */
  it("lets a click through the bar's blank space to the paragraph sitting underneath it", async () => {
    const studio = await (
      await browser.newContext({ viewport: { width: 1100, height: 900 } })
    ).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Reformas Vega");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();

      await frame.locator('[data-section="sec-cover"] [data-id="el-headline"]').click();
      await frame.locator(".rb-toolbar-color").waitFor();
      await frame.locator(".rb-toolbar-color").evaluate((el) => {
        (el as HTMLInputElement).value = "#fefefe";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const bar = frame.locator(".rb-toolbar");
      const body = frame.locator('[data-section="sec-cover"] [data-id="el-body"]');
      const [barBox, bodyBox] = await Promise.all([bar.boundingBox(), body.boundingBox()]);
      // The overlap this test needs to be a real test of the fix, not a green light for nothing.
      expect(barBox, "toolbar not found").not.toBeNull();
      expect(bodyBox, "body not found").not.toBeNull();
      if (barBox && bodyBox) {
        expect(
          barBox.y + barBox.height,
          "the bar's blank space no longer reaches the body",
        ).toBeGreaterThan(bodyBox.y);
      }

      // The click that used to time out.
      await body.click({ timeout: 5000 });
      // And it did what a real click on the paragraph should: the body is now the focused field,
      // not the headline, which is what makes this the paragraph's own toolbar and not the one
      // left over from before.
      await expect(body).toBeFocused();
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

/**
 * Sprint 10 day 7 — the complete walk, and the first e2e for marks at all.
 *
 * Days 3-6 each have their own proof in isolation: the schema's offset arithmetic, the renderer's
 * run-by-run escaping, the toolbar's two buttons, the 320px measurement. None of them is exercised
 * through a real `contentEditable`, a real blur-commit, a real debounced autosave and a real
 * download — which is exactly the seam sprint 9 day 7's walk existed to prove for the style system,
 * and the one no unit test can stand in for here either.
 *
 * **One correction to the plan this sprint was approved on.** The plan said the overflow check
 * would mean a download that "no se pueda" — cannot happen. Day 6 decided the opposite on purpose:
 * overflow *warns*, the same as the photo marker, because the owner can see it in the mobile
 * preview and the commonest cause is a word they typed themselves. This walk follows what was
 * actually built rather than the plan's older wording — it shows the warning, lets a cautious owner
 * back out of it, and downloads once the size is fixed.
 *
 * **And one addition beyond the plan's own words.** Rather than re-opening the hand-written
 * `xss-attempt` fixture — already proven green and untouched on day 4, at the unit level and now in
 * a real browser — this walk types a `<script>` tag into a live, marked, edited field and lets the
 * whole pipeline carry it to a downloaded, double-clicked page. That is a stronger claim than
 * replaying a fixture: it is the one sentence ADR 0024 built this feature on, satisfied by an
 * owner's actual keystrokes rather than by a document nobody but a test ever writes.
 */
async function selectWord(locator: Locator, word: string): Promise<void> {
  const found = await locator.evaluate((el, w) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: the idiomatic shape of a TreeWalker loop
    while ((node = walker.nextNode() as Text | null)) {
      const index = node.textContent?.indexOf(w) ?? -1;
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + w.length);
      const selection = el.ownerDocument.defaultView?.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    }
    return false;
  }, word);
  if (!found) throw new Error(`selectWord: "${word}" not found in ${await locator.innerHTML()}`);
}

/**
 * A collapsed caret at the very start or the very end of the **first occurrence** of `word` inside
 * `locator` — placed this precisely because ADR 0027 §3's asymmetry is about exactly that
 * boundary, not about the word in general.
 *
 * Searches by substring rather than requiring a node whose entire content equals `word`, because
 * after the first mark grows (ADR 0027 §3's own "continúa" row) the run's text node is no longer
 * "beber" alone — it is "beber <script>bad()</script>", with "beber" now only a prefix of it. A
 * helper that only matched a lone, exact node would stop working the moment the feature it tests
 * did what it was supposed to.
 */
async function caretAt(locator: Locator, word: string, edge: "start" | "end"): Promise<void> {
  const found = await locator.evaluate(
    (el, { w, e }) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: the idiomatic shape of a TreeWalker loop
      while ((node = walker.nextNode() as Text | null)) {
        const index = node.textContent?.indexOf(w) ?? -1;
        if (index < 0) continue;
        const offset = e === "start" ? index : index + w.length;
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = el.ownerDocument.defaultView?.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
      }
      return false;
    },
    { w: word, e: edge },
  );
  if (!found) {
    throw new Error(`caretAt: "${word}" not found in ${await locator.innerHTML()}`);
  }
}

describe("sprint 10 día 7 — el recorrido completo del sprint", () => {
  it("marks two words, edits around the mark, triggers and clears an overflow, and downloads a ZIP with the emphasis and the escaping intact", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Taberna del Puerto");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Restaurante y bar", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Comidas", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Muelle 3, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que reserven", { exact: true }).click();
      await studio.fill("#enlace", "https://reservas.example.com/taberna");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const subheadline = frame.locator('[data-id="el-subheadline"]');
      await expect(subheadline).toHaveText("Comer, beber y quedarse un rato");

      // ---- day 5: both marks on the same word, which is what the third session's owner asked
      //      for by naming cursiva and negrita together (docs/sessions/2026-09-30-taller.md) ----
      await subheadline.click();
      await selectWord(subheadline, "beber");
      await frame.locator('.rb-toolbar-mark[data-mark="strong"]').click();
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveText("beber");

      await subheadline.click();
      await selectWord(subheadline, "beber");
      await frame.locator('.rb-toolbar-mark[data-mark="em"]').click();
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      // strong outside, em inside — ADR 0027 §5's fixed nesting order, read back from real markup.
      await expect(subheadline.locator("strong em")).toHaveText("beber");

      // ---- ADR 0027 §3-4: the boundary is asymmetric, and both halves are tested live ----
      // Typing right at the END of the run makes it continue — and this is where the <script>
      // ADR 0024 was built against goes in, so the whole pipeline carries it to the ZIP.
      await subheadline.click();
      await caretAt(subheadline, "beber", "end");
      await studio.keyboard.type(" <script>bad()</script>");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong em")).toHaveText("beber <script>bad()</script>");

      // Typing right at the START of the run does not — the same asymmetry, the other edge.
      await subheadline.click();
      await caretAt(subheadline, "beber", "start");
      await studio.keyboard.type("Muy ");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      // "Muy " sits outside the mark: the bold+italic span is unchanged by the edit at its start.
      await expect(subheadline.locator("strong em")).toHaveText("beber <script>bad()</script>");
      await expect(subheadline).toHaveText(
        "Comer, Muy beber <script>bad()</script> y quedarse un rato",
      );

      // ---- day 6: an exact size big enough to overflow at 320px, on purpose ----
      await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
      await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();

      const headline = frame.locator('[data-id="el-headline"]');
      const sizeInput = frame.locator('.rb-toolbar-exact[aria-label^="Tamaño"]');
      await headline.click();
      await sizeInput.fill("200");
      await sizeInput.dispatchEvent("change");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect
        .poll(() => headline.evaluate((el) => getComputedStyle(el).fontSize))
        .toBe("200px");

      // ---- the download: the photo warning first, then the overflow warning, and a cautious
      //      owner backing out of it rather than publishing past it ----
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();
      await studio.getByRole("button", { name: "Descargar igualmente" }).waitFor();
      await studio.getByRole("button", { name: "Descargar igualmente" }).click();
      await expect(studio.getByText("Algo se sale en el móvil")).toBeVisible();
      await studio.getByRole("button", { name: "Volver", exact: true }).click();
      await expect(studio.getByText("Algo se sale en el móvil")).toHaveCount(0);

      // Fixed, by dropping the exception — back to the system's own size.
      await headline.click();
      await sizeInput.fill("");
      await sizeInput.dispatchEvent("change");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();

      // A fresh press re-evaluates from the document as it now stands (`requestDownload`'s own
      // contract) rather than remembering the overflow that no longer exists.
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();
      const photoWarning = studio.getByRole("button", { name: "Descargar igualmente" });
      await photoWarning.waitFor();
      await expect(studio.getByText("Algo se sale en el móvil")).toHaveCount(0);
      const [download, response] = await Promise.all([
        studio.waitForEvent("download"),
        studio.waitForResponse((candidate) => candidate.url().includes("/api/download")),
        photoWarning.click(),
      ]);
      expect(response.status()).toBe(200);

      const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-sprint10-dia7-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      extractAll(zip, dir);
      const filePath = join(dir, "index.html");

      const offlinePage = await (await browser.newContext()).newPage();
      const dialogs: string[] = [];
      const failed: string[] = [];
      offlinePage.on("dialog", (dialog) => {
        dialogs.push(dialog.message());
        void dialog.dismiss();
      });
      offlinePage.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
        await expect(offlinePage).toHaveTitle("Taberna del Puerto");

        // Nothing ran, and there is nothing that could: the <script> typed into a marked run is
        // text on the page, not a script element — the same claim the day 4 browser test makes
        // against a hand-written fixture, proven here against one a person actually typed.
        expect(await offlinePage.evaluate(() => document.querySelectorAll("script").length)).toBe(
          0,
        );
        expect(dialogs).toEqual([]);

        const publishedSub = offlinePage.locator('[data-id="el-subheadline"]');
        await expect(publishedSub.locator("strong em")).toHaveText("beber <script>bad()</script>");
        await expect(publishedSub).toHaveText(
          "Comer, Muy beber <script>bad()</script> y quedarse un rato",
        );
        // No mark bled into "Muy " or past the end of the script text — the fixed nesting order
        // and the clipped boundaries both survived render(doc, "html").
        await expect(publishedSub.locator("strong")).toHaveCount(1);
        await expect(publishedSub.locator("em")).toHaveCount(1);

        // The exact size was dropped, not merely overridden: the published headline is back to
        // whatever size.subheading resolves to for this palette, not a literal 200px.
        const headlineFontSize = await offlinePage
          .locator('[data-id="el-headline"]')
          .evaluate((el) => getComputedStyle(el).fontSize);
        expect(headlineFontSize).not.toBe("200px");

        // And the whole promise ADR 0001 makes: every byte the page needed was inside the ZIP.
        expect(failed).toEqual([]);
      } finally {
        await offlinePage.context().close();
      }
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

describe("sprint 11 día 7 — el recorrido completo del sprint", () => {
  /**
   * Every day of this sprint, in one session, closing on the same promise every day-7 walk since
   * sprint 5 has closed on: a ZIP that opens by double-clicking, with nothing missing.
   *
   * **The five rows of ADR 0027 §3, chained on one field rather than five pristine ones.** Days 1–2
   * proved each row in isolation — a fresh document per case, so a bug in one could not hide behind
   * the setup of another. What none of that proves is **composition across real focus and blur
   * cycles**: that `beforeinput`'s capture, committed and re-rendered five times in a row, keeps
   * agreeing with itself. The text is ADR 0027's own canonical example, "Solomillo al whisky",
   * walked through grows → continues → does not join → shrinks → removes, with the arithmetic
   * checked by hand below each step so a wrong assertion cannot pass by accident.
   *
   * **Then the type pair, and the ZIP day 6 built.** Switching to «Clásica y seria» is the one
   * action that turns `TYPE_PAIRS` from a stack nobody ships bytes for into one that does — the
   * live path from a click in the Estilo panel to two `woff2` files and a licence inside a
   * downloaded ZIP. And the `<script>` typed into the headline right after is sprint 10 day 7's own
   * check, repeated here on purpose: nothing about this sprint's edits to the capture pipeline
   * (`asTyped`, `beforeinput`, the anchored `shiftMarks`) may be the thing that finally lets one
   * through.
   */
  it("marks and edits a run through all five rows of ADR 0027 §3, switches type pair, and downloads a ZIP with the chosen letter, its licence and the escaping intact", async () => {
    const studio = await (await browser.newContext()).newPage();
    try {
      await studio.goto(BASE_URL, { waitUntil: "networkidle" });
      await studio.fill("#nombre", "Reformas Vega");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Peluquería y barbería", { exact: true }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.fill("#direccion", "Calle Espinel 12, Ronda");
      await studio.getByRole("button", { name: "Siguiente" }).click();
      await studio.getByText("Que me llamen", { exact: true }).click();
      await studio.fill("#telefono", "600111222");
      await studio.getByRole("button", { name: "Crear mi web" }).click();
      await studio.getByText("Ver a tamaño real →").first().click();

      const frame = studio.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const subheadline = frame.locator('[data-id="el-subheadline"]');

      // A controlled string rather than whatever the generator wrote, so every offset below is
      // exact and the reader can check the arithmetic against the text on the page.
      await subheadline.click();
      await studio.keyboard.press("ControlOrMeta+a");
      await studio.keyboard.type("Solomillo al whisky");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline).toHaveText("Solomillo al whisky");

      // Bold on "Solomillo", [0,9) — the mark every step below moves.
      await subheadline.click();
      await selectWord(subheadline, "Solomillo");
      await frame.locator('.rb-toolbar-mark[data-mark="strong"]').click();
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveText("Solomillo");

      // ---- row 1: typing INSIDE the run grows it ----
      // Caret after "Solo" (offset 4, strictly inside [0,9)) · +"XX" → mark [0,11).
      await subheadline.click();
      await caretAt(subheadline, "Solo", "end");
      await studio.keyboard.type("XX");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveText("SoloXXmillo");
      await expect(subheadline).toHaveText("SoloXXmillo al whisky");

      // ---- row 2: typing right AT THE END of the run continues it ----
      // Caret at offset 11, which equals the run's own `to` · +"YY" → mark [0,13).
      await subheadline.click();
      await caretAt(subheadline, "SoloXXmillo", "end");
      await studio.keyboard.type("YY");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveText("SoloXXmilloYY");
      await expect(subheadline).toHaveText("SoloXXmilloYY al whisky");

      // ---- row 3: typing right AT THE START of the run does not join it ----
      // Caret at offset 0, which equals the run's own `from` · +"Hoy: " (5 chars) pushes the run
      // along to [5,18) without taking the inserted text in — the one asymmetry the whole table
      // rests on.
      await subheadline.click();
      await caretAt(subheadline, "SoloXXmilloYY", "start");
      await studio.keyboard.type("Hoy: ");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveText("SoloXXmilloYY");
      await expect(subheadline).toHaveText("Hoy: SoloXXmilloYY al whisky");

      // ---- row 4: deleting PART of the run shrinks it ----
      // "XX" sits entirely inside [5,18) · removing it leaves the run at [5,16).
      await subheadline.click();
      await selectWord(subheadline, "XX");
      await studio.keyboard.press("Backspace");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveText("SolomilloYY");
      await expect(subheadline).toHaveText("Hoy: SolomilloYY al whisky");

      // ---- row 5: deleting ALL of the run removes it, leaving no empty run behind ----
      await subheadline.click();
      await selectWord(subheadline, "SolomilloYY");
      await studio.keyboard.press("Backspace");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(subheadline.locator("strong")).toHaveCount(0);
      await expect(subheadline).toHaveText("Hoy:  al whisky");

      // ---- day 3-4: the type pair that needs a file, chosen from the Estilo panel ----
      await studio.getByRole("button", { name: "Estilo", exact: true }).click();
      await studio.getByText("Clásica y seria", { exact: true }).click();
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();

      // ---- sprint 10 day 7's own check, repeated: this sprint rewrote the capture under the
      //      text an owner types, and the one thing that must never change is that a <script>
      //      typed into a field stays text on the page ----
      const headline = frame.locator('[data-id="el-headline"]');
      await headline.click();
      await studio.keyboard.press("ControlOrMeta+a");
      await studio.keyboard.type("Reformas Vega <script>alert(1)</script>");
      await studio.keyboard.press("Enter");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
      await expect(headline).toHaveText("Reformas Vega <script>alert(1)</script>");

      // ---- day 5-6: download, and the owner's own ZIP ----
      await studio.getByRole("button", { name: "Descargar", exact: true }).click();
      const downloadAnyway = studio.getByRole("button", { name: "Descargar igualmente" });
      await downloadAnyway.waitFor();
      const [download, response] = await Promise.all([
        studio.waitForEvent("download"),
        studio.waitForResponse((candidate) => candidate.url().includes("/api/download")),
        downloadAnyway.click(),
      ]);
      expect(response.status()).toBe(200);

      const dir = mkdtempSync(join(tmpdir(), "retorika-e2e-sprint11-dia7-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      const entries = extractAll(zip, dir);

      // Exactly the files a single-page site on classic-display produces: no sitemap.xml (a
      // download has no baseUrl), nothing from an earlier fixture — and, since day 6, the two
      // faces this pair asks for **with the OFL text beside them**.
      expect([...entries].sort()).toEqual(
        [
          "fonts/OFL-PlayfairDisplay.txt",
          "fonts/playfair-display-latin-400-normal.woff2",
          "fonts/playfair-display-latin-700-normal.woff2",
          "index.html",
          "robots.txt",
        ].sort(),
      );

      const licence = readFileSync(join(dir, "fonts", "OFL-PlayfairDisplay.txt"), "utf8");
      expect(licence).toContain("SIL OPEN FONT LICENSE Version 1.1");
      expect(licence).toContain('Reserved Font Name "Playfair Display"');

      const filePath = join(dir, "index.html");
      const offlinePage = await (await browser.newContext()).newPage();
      const dialogs: string[] = [];
      const failed: string[] = [];
      offlinePage.on("dialog", (dialog) => {
        dialogs.push(dialog.message());
        void dialog.dismiss();
      });
      offlinePage.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offlinePage.goto(`file://${filePath}`, { waitUntil: "load" });
        await offlinePage.waitForTimeout(500); // let @font-face settle before reading document.fonts

        // The <script> an owner typed is text on the published page and never an element — the
        // same claim ADR 0024 was built on, satisfied again under this sprint's own capture.
        expect(await offlinePage.evaluate(() => document.querySelectorAll("script").length)).toBe(
          0,
        );
        expect(dialogs).toEqual([]);
        await expect(offlinePage.locator('[data-id="el-headline"]')).toHaveText(
          "Reformas Vega <script>alert(1)</script>",
        );

        // The letter that arrives is the one that was chosen: both faces this pair names loaded
        // from the ZIP's own fonts/ folder, with no server behind the page.
        const faces = await offlinePage.evaluate(() =>
          [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
        );
        expect(faces.length).toBeGreaterThan(0);
        for (const face of faces) {
          expect(face, face).toContain("Playfair Display");
          expect(face, face).toContain("loaded");
        }

        // And the whole promise ADR 0001 makes: every byte the page needed, fonts included, was
        // actually inside the ZIP.
        expect(failed).toEqual([]);
      } finally {
        await offlinePage.context().close();
      }
    } finally {
      await studio.context().close();
    }
  }, 120_000);
});

/**
 * Sprint 12 day 3 — the panel's own box is anchored, and the keyboard reaches the history.
 *
 * Both halves are the same wiring seen from two sides: a key pressed over an `<input>`. The edit is
 * measured where it happens rather than guessed afterwards, and the undo shortcut deliberately does
 * **not** fire while that box has the caret.
 */
describe("sprint 12 día 3 — el input anclado y el atajo de deshacer", () => {
  async function tavern(): Promise<Page> {
    const studio = await (await browser.newContext()).newPage();
    await studio.goto(BASE_URL, { waitUntil: "networkidle" });
    await studio.fill("#nombre", "Taberna del Puerto");
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Restaurante y bar", { exact: true }).click();
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Comidas", { exact: true }).click();
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.fill("#direccion", "Muelle 3, Ronda");
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Que reserven", { exact: true }).click();
    await studio.fill("#enlace", "https://reservas.example.com/taberna");
    await studio.getByRole("button", { name: "Crear mi web" }).click();
    await studio.getByText("Ver a tamaño real →").first().click();
    await studio.frameLocator("iframe").first().locator('[data-section="sec-cover"]').waitFor();
    return studio;
  }

  it("keeps a mark on its own word when the edit is committed from the fields panel", async () => {
    // **The exact case sprint 11 day 1 measured the diff getting wrong**, committed from the panel
    // rather than from the canvas: in «pan y pan y aceite», deleting the *second* «pan y » destroys
    // a bold on the first «pan», whose own letters nobody touched. The panel used to reach
    // `setElementText` without ever having watched the keystroke, so it took that guess.
    const studio = await tavern();
    try {
      const frame = studio.frameLocator("iframe").first();
      const sub = frame.locator('[data-id="el-subheadline"]');

      await sub.click();
      await studio.keyboard.type("pan y pan y aceite");
      await studio.keyboard.press("Enter");
      await expect(sub).toHaveText("pan y pan y aceite");

      await sub.click();
      await selectWord(sub, "pan");
      await frame.locator('.rb-toolbar-mark[data-mark="strong"]').click();
      await expect(sub.locator("strong")).toHaveText("pan");

      await frame.locator('[data-section="sec-cover"]').click();
      await frame.getByRole("button", { name: "Campos de esta sección" }).click();
      const box = studio.getByLabel("Subtítulo");
      await expect(box).toHaveValue("pan y pan y aceite");
      await box.click();
      await box.evaluate((el) => (el as HTMLInputElement).setSelectionRange(6, 12));
      await studio.keyboard.press("Delete");
      await expect(box).toHaveValue("pan y aceite");
      await studio.getByRole("button", { name: "Cerrar los campos" }).click();

      await expect(sub).toHaveText("pan y aceite");
      // The bold is still on the word it was put on, and has not swallowed or lost anything.
      await expect(sub.locator("strong")).toHaveText("pan");
    } finally {
      await studio.close();
    }
  }, 180_000);

  it("undoes and redoes from the keyboard, and leaves the panel's own box alone", async () => {
    const studio = await tavern();
    try {
      const frame = studio.frameLocator("iframe").first();
      const undoBtn = studio.getByRole("button", { name: "Deshacer", exact: true });
      const redoBtn = studio.getByRole("button", { name: "Rehacer", exact: true });

      /**
       * Back onto the canvas before each press, and **it is not ceremony.**
       *
       * Undoing re-renders the canvas, which replaces the `<iframe>`'s document — and with it the
       * `keydown` listener `wireInteractions` installs on load. Between the new document existing
       * and that listener arriving there is a window in which a keystroke reaches neither document.
       * Measured: at machine speed, a second press sent immediately after the first is lost; with
       * 400ms between them it is not. A click is deterministic where a sleep is a guess, so the
       * test clicks — and the limit is written down rather than papered over.
       */
      const onCanvas = () => frame.locator('[data-section="sec-cover"]').click();

      await expect(undoBtn).toBeDisabled();
      await expect(redoBtn).toBeDisabled();

      await onCanvas();
      await frame.getByRole("button", { name: "Campos de esta sección" }).click();
      const box = studio.getByLabel("Titular");
      await box.fill("Primero");
      await box.blur();
      await expect(undoBtn).toBeEnabled();
      await expect(redoBtn).toBeDisabled();

      await onCanvas();
      await studio.keyboard.press("Meta+z");
      await expect(redoBtn).toBeEnabled();

      await onCanvas();
      await studio.keyboard.press("Meta+Shift+z");
      await expect(redoBtn).toBeDisabled();

      await onCanvas();
      await studio.keyboard.press("Control+z");
      await expect(redoBtn).toBeEnabled();

      // The third redo binding, which is the Windows one and not a macOS convention.
      await onCanvas();
      await studio.keyboard.press("Control+y");
      await expect(redoBtn).toBeDisabled();

      await onCanvas();
      await studio.keyboard.press("Meta+z");
      await expect(redoBtn).toBeEnabled();

      // **The condition the shortcut was written under.** With the caret in the panel's own box the
      // browser keeps its undo, so the document must not step: the redo that was available stays
      // available, because nothing consumed it.
      await box.click();
      await studio.keyboard.press("Control+y");
      await studio.waitForTimeout(500);
      await expect(redoBtn).toBeEnabled();
    } finally {
      await studio.close();
    }
  }, 180_000);
});

/**
 * Sprint 12's full walk, composed: the six days in one session, against the real application.
 *
 * It closes on the promise every day-7 walk since sprint 5 has closed on — **a ZIP that opens by
 * double-clicking, with nothing missing** — and adds the one this sprint owes: the `<head>` of that
 * file says what the link will show, and the picture it names is really inside the ZIP.
 *
 * Its own context, like every other day-7 walk: this needs a document the ordered flows above have
 * not already converted, styled and marked.
 */
describe("sprint 12 día 7 — el recorrido completo del sprint", () => {
  it("fills a card's description from the panel, keeps its mark through an anchored edit, undoes from the keyboard, sees the width the gate measures, and downloads a ZIP whose head says what a shared link shows", async () => {
    const walk = await (await browser.newContext()).newPage();
    try {
      await walk.goto(BASE_URL, { waitUntil: "networkidle" });
      await walk.fill("#nombre", "Taberna del Puerto");
      await walk.getByRole("button", { name: "Siguiente" }).click();
      await walk.getByText("Restaurante y bar", { exact: true }).click();
      await walk.getByRole("button", { name: "Siguiente" }).click();
      await walk.getByText("Comidas", { exact: true }).click();
      await walk.getByRole("button", { name: "Siguiente" }).click();
      await walk.fill("#direccion", "Muelle 3, Ronda");
      await walk.getByRole("button", { name: "Siguiente" }).click();
      await walk.getByText("Que reserven", { exact: true }).click();
      await walk.fill("#enlace", "https://reservas.example.com/taberna");
      await walk.getByRole("button", { name: "Crear mi web" }).click();
      await walk.getByText("Ver a tamaño real →").first().click();

      const frame = walk.frameLocator("iframe").first();
      await frame.locator('[data-section="sec-cover"]').waitFor();
      const fileInput = walk.locator('input[type="file"]:not(#logo)');

      // ---- day 2: the slot nothing could reach ----------------------------------------------
      // «Qué hago» has one card and the catalog gives it no description: `0..1`, so absent from the
      // document, so nothing on the page to click. Before this sprint there was no way in at all.
      await frame.locator('[data-section="sec-services"]').click();
      await frame.getByRole("button", { name: "Campos de esta sección" }).click();
      const description = walk.getByLabel("Descripción");
      await expect(description).toHaveValue("");
      // The text is chosen to be the case the diff gets wrong: deleting the second «pan y » from
      // this leaves a string two different edits could have produced.
      await description.fill("pan y pan y aceite de la tierra");
      await description.blur();
      const card = frame.locator('[data-preset="services"] .rb-item').first();
      await expect(card).toContainText("pan y pan y aceite de la tierra");

      // ---- day 3a: a mark on it, then an edit from the panel that the diff would have broken --
      const cardDescription = card.locator("p").first();
      await cardDescription.click();
      await selectWord(cardDescription, "pan");
      await frame.locator('.rb-toolbar-mark[data-mark="strong"]').click();
      await expect(cardDescription.locator("strong")).toHaveText("pan");

      // The panel never closed: it is a fixed aside, and the canvas stayed clickable underneath the
      // whole time. Re-opening it here is what the first attempt did, and the button never settled
      // — the canvas re-renders after a mark, so a click on chrome inside the frame is a race.
      const marked = walk.getByLabel("Descripción");
      await expect(marked).toHaveValue("pan y pan y aceite de la tierra");
      await marked.click();
      // [6,12) — the *second* «pan y ». The diff attributes this to the first one and destroys a
      // bold whose own letters nobody touched; `beforeinput` measures it instead (ADR 0027 §4b).
      await marked.evaluate((el) => (el as HTMLInputElement).setSelectionRange(6, 12));
      await walk.keyboard.press("Delete");
      await expect(marked).toHaveValue("pan y aceite de la tierra");
      await walk.getByRole("button", { name: "Cerrar los campos" }).click();

      await expect(cardDescription).toHaveText("pan y aceite de la tierra");
      await expect(cardDescription.locator("strong")).toHaveText("pan");

      // ---- what this walk found: undoing with the panel open, and the box that lied -----------
      // **The colchón's finding.** These inputs are uncontrolled, so an undo reverted the page and
      // left the box showing the text that had just been undone — and then *clicking into it and
      // out again*, typing nothing, wrote the undone edit back and cleared the redo stack. The
      // walk keeps the whole sequence, because the second half is what made it a trap rather than
      // a blemish.
      await frame.locator('[data-section="sec-services"]').click();
      await frame.getByRole("button", { name: "Campos de esta sección" }).click();
      const open = walk.getByLabel("Descripción");
      await expect(open).toHaveValue("pan y aceite de la tierra");

      await walk.getByRole("button", { name: "Deshacer", exact: true }).click();
      await expect(cardDescription).toHaveText("pan y pan y aceite de la tierra");
      // The box followed the document rather than keeping what is no longer there.
      await expect(open).toHaveValue("pan y pan y aceite de la tierra");

      // Touched and left, with nothing typed: the page must not move.
      await open.click();
      await open.blur();
      await expect(cardDescription).toHaveText("pan y pan y aceite de la tierra");
      await expect(walk.getByRole("button", { name: "Rehacer", exact: true })).toBeEnabled();

      await walk.getByRole("button", { name: "Rehacer", exact: true }).click();
      await expect(cardDescription).toHaveText("pan y aceite de la tierra");
      await expect(open).toHaveValue("pan y aceite de la tierra");
      await expect(cardDescription.locator("strong")).toHaveText("pan");
      await walk.getByRole("button", { name: "Cerrar los campos" }).click();

      // ---- day 3b: the keyboard reaches the history, and leaves a text box alone --------------
      const undoBtn = walk.getByRole("button", { name: "Deshacer", exact: true });
      const redoBtn = walk.getByRole("button", { name: "Rehacer", exact: true });
      await expect(undoBtn).toBeEnabled();

      await frame.locator('[data-section="sec-cover"]').click();
      await walk.keyboard.press("Meta+z");
      await expect(cardDescription).toHaveText("pan y pan y aceite de la tierra");
      await expect(redoBtn).toBeEnabled();

      await frame.locator('[data-section="sec-cover"]').click();
      await walk.keyboard.press("Control+y");
      await expect(cardDescription).toHaveText("pan y aceite de la tierra");

      // Inside a text being edited the browser keeps its own undo, which is the condition the
      // shortcut was written under: taking it would mean correcting a word costs the sentence.
      const headline = frame.locator('[data-id="el-headline"]');
      await headline.click();
      await walk.keyboard.press("Meta+z");
      await walk.keyboard.press("Escape");
      await expect(headline).toHaveText("Taberna del Puerto");
      await expect(cardDescription).toHaveText("pan y aceite de la tierra");

      // ---- day 4: the canvas shows the width the gate measures --------------------------------
      await walk.getByRole("button", { name: "Ver en móvil" }).click();
      await expect
        .poll(async () =>
          frame.locator("body").evaluate(() => document.documentElement.clientWidth),
        )
        .toBe(320);
      await walk.getByRole("button", { name: "Ver en ordenador" }).click();

      // ---- the cover needs a real photograph, or there is no card to show at all --------------
      // The generator's cover is the grey marker: a `data:` URI whose payload is an SVG, which
      // ADR 0029 §4 refuses twice over. An owner's own JPEG is what makes `og:image` possible.
      await walk.getByRole("button", { name: "Fotos", exact: true }).click();
      const photoRows = walk.locator('ul li:has(button:has-text("Cambiar"))');
      await photoRows.first().getByRole("button", { name: "Cambiar" }).click();
      await fileInput.setInputFiles(join(import.meta.dirname, "fixtures/cover-photo.jpg"));
      await expect(walk.getByText("Todas las fotos de tu web son tuyas.")).toBeVisible();

      // ---- day 5: the two fields, and the address normalising in front of the owner -----------
      await walk.getByRole("button", { name: "Compartir" }).click();
      const shareText = walk.getByLabel("Frase que acompaña al enlace");
      // The placeholder is the cover's subheadline — what publishes if this is left alone.
      await expect(shareText).toHaveAttribute("placeholder", "Comer, beber y quedarse un rato");
      await shareText.fill("Cocina de puerto, con la lonja a cien metros");
      await shareText.blur();

      const domain = walk.getByLabel("Dirección de tu web");
      await domain.fill("TabernaDelPuerto.es/");
      await domain.blur();
      await expect(walk.getByText("Se publicará como https://tabernadelpuerto.es")).toBeVisible();

      // ---- day 6: the head of the real file, and the picture it names ------------------------
      const [download] = await Promise.all([
        walk.waitForEvent("download"),
        walk.getByRole("button", { name: "Descargar" }).click(),
      ]);
      const dir = mkdtempSync(join(tmpdir(), "retorika-s12-"));
      const zipPath = join(dir, download.suggestedFilename());
      await download.saveAs(zipPath);
      const zip = new Uint8Array(readFileSync(zipPath));
      const entries = extractAll(zip, dir);
      const html = new TextDecoder().decode(extractFileBytes(zip, "index.html"));

      expect(html).toContain(
        '<meta name="description" content="Cocina de puerto, con la lonja a cien metros">',
      );
      expect(html).toContain('<meta property="og:title" content="Taberna del Puerto">');
      expect(html).toContain('<meta property="og:url" content="https://tabernadelpuerto.es">');

      // **The picture it names is really in the ZIP**, checked against the entries rather than
      // against a string. An og:image pointing at a file that does not travel renders a broken
      // card, which is worse than a plain link.
      const ogImage = /<meta property="og:image" content="([^"]+)">/.exec(html);
      expect(ogImage, "no og:image was emitted").not.toBeNull();
      const named = new URL(ogImage?.[1] ?? "").pathname.replace(/^\//, "");
      expect(entries, `og:image names "${named}", which is not in the ZIP`).toContain(named);

      // ---- and the promise every day 7 closes on ---------------------------------------------
      const offline = await (await browser.newContext()).newPage();
      const failed: string[] = [];
      offline.on("requestfailed", (request) => failed.push(request.url()));
      try {
        await offline.goto(`file://${join(dir, "index.html")}`, { waitUntil: "load" });
        await expect(offline.getByText("pan y aceite de la tierra")).toBeVisible();
        // The mark survived the panel, the undo, the redo and the ZIP.
        await expect(offline.locator("strong", { hasText: "pan" }).first()).toBeVisible();
        // An absolute og:image does not dent ADR 0001: it is metadata and nothing fetches it. The
        // relative one is the `<img>`, and an empty `failed` is what says it was really inside.
        expect(failed).toEqual([]);
      } finally {
        await offline.context().close();
      }

      // ---- the other half of ADR 0029: no address, no picture, and the sentence stays ---------
      await walk.getByRole("button", { name: "Compartir" }).click();
      const clearDomain = walk.getByLabel("Dirección de tu web");
      await clearDomain.fill("");
      await clearDomain.blur();
      await expect(walk.getByText(/Se publicará como/)).toHaveCount(0);

      const [second] = await Promise.all([
        walk.waitForEvent("download"),
        walk.getByRole("button", { name: "Descargar" }).click(),
      ]);
      const secondPath = join(dir, `sin-dominio-${second.suggestedFilename()}`);
      await second.saveAs(secondPath);
      const withoutDomain = new TextDecoder().decode(
        extractFileBytes(new Uint8Array(readFileSync(secondPath)), "index.html"),
      );
      expect(withoutDomain).toContain(
        '<meta name="description" content="Cocina de puerto, con la lonja a cien metros">',
      );
      expect(withoutDomain).toContain('<meta property="og:title"');
      expect(withoutDomain).not.toContain("og:image");
      expect(withoutDomain).not.toContain("og:url");
    } finally {
      await walk.context().close();
    }
  });
});

/**
 * Sprint 13 day 2 — the half of the floating toolbar that was drawn and could not be used.
 *
 * **Every test in this file drove these controls programmatically, which is why seven sprints went
 * by.** `selectOption` sets `.value` and dispatches `change`; `fill()` focuses by API; the colour
 * input was written with `evaluate(el => { el.value = …; dispatch })`. All three skip the gesture,
 * and the gesture was the broken part: `mousedown` was cancelled on the whole bar, so a `<select>`
 * never opened, an `<input>` never took focus, and **the digits typed into a size field landed in
 * the headline** — measured against the old code, which turned a business called «Taberna del
 * Puerto» into one called «42».
 *
 * So these are pointer tests on purpose, and they assert the two things a real press changes:
 * **what has focus**, and **where the characters go**.
 */
describe("sprint 13 día 2 — la barra se deja usar con el ratón", () => {
  async function barOpen(): Promise<{ studio: Page; frame: FrameLocator }> {
    const studio = await (await browser.newContext()).newPage();
    await studio.goto(BASE_URL, { waitUntil: "networkidle" });
    await studio.fill("#nombre", "Taberna del Puerto");
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Restaurante y bar", { exact: true }).click();
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Comidas", { exact: true }).click();
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.fill("#direccion", "Muelle 3, Ronda");
    await studio.getByRole("button", { name: "Siguiente" }).click();
    await studio.getByText("Que reserven", { exact: true }).click();
    await studio.fill("#enlace", "https://reservas.example.com/taberna");
    await studio.getByRole("button", { name: "Crear mi web" }).click();
    await studio.getByText("Ver a tamaño real →").first().click();
    const frame = studio.frameLocator("iframe").first();
    await frame.locator('[data-section="sec-cover"]').waitFor();
    await studio.getByRole("switch", { name: "Herramientas de diseño" }).click();
    await studio.getByRole("button", { name: "Sí, enciéndelas" }).click();
    await frame.locator('[data-id="el-headline"]').click();
    await frame.locator(".rb-toolbar").waitFor();
    return { studio, frame };
  }

  /** Whether this element is the frame's `activeElement` — the one thing a cancelled `mousedown`
   * takes away, and the one a `fill()` or a `selectOption` grants without ever pressing. */
  const focused = (locator: Locator) =>
    locator.evaluate((el) => el.ownerDocument.activeElement === el);

  it("gives a real press the focus, on all four kinds of control that are not buttons", async () => {
    const { studio, frame } = await barOpen();
    try {
      // Two selects, three number fields and one colour field: the whole design half of the bar.
      await expect(frame.locator(".rb-toolbar-select")).toHaveCount(2);
      await expect(frame.locator(".rb-toolbar-exact")).toHaveCount(3);
      await expect(frame.locator(".rb-toolbar-color")).toHaveCount(1);

      for (const selector of [".rb-toolbar-select", ".rb-toolbar-exact", ".rb-toolbar-color"]) {
        const all = frame.locator(selector);
        for (let i = 0; i < (await all.count()); i += 1) {
          const control = all.nth(i);
          await control.click();
          expect(await focused(control), `${selector} #${i} took no focus from a real press`).toBe(
            true,
          );
          // And the bar is still there: a press that moved focus out of the text used to be exactly
          // what the cancelled `mousedown` existed to stop.
          await expect(frame.locator(".rb-toolbar")).toHaveCount(1);
        }
      }
    } finally {
      await studio.context().close();
    }
  }, 180_000);

  it("types a size into the size field, and not into the business name", async () => {
    // **The measured symptom, and the worst of the six.** Against the old code this press left the
    // field empty and unfocused, and «42» replaced the headline.
    const { studio, frame } = await barOpen();
    try {
      const headline = frame.locator('[data-id="el-headline"]');
      const exact = frame.locator('.rb-toolbar-exact[aria-label^="Tamaño"]');
      await exact.click();
      await studio.keyboard.type("42");
      await expect(exact).toHaveValue("42");
      await expect(headline).toHaveText("Taberna del Puerto");

      // And it commits on `change`, which a blur is: the size reaches the document.
      await frame.locator('[data-section="sec-cover"]').click();
      await expect
        .poll(async () => (await headline.evaluate((el) => getComputedStyle(el).fontSize)) ?? "")
        .toBe("42px");
    } finally {
      await studio.context().close();
    }
  }, 180_000);

  it("changes a spacing from the keyboard once the press has focused it", async () => {
    // A native `<select>` popup is drawn by the browser and Playwright cannot click inside it, so
    // what is driven here is the half that was broken — the press that focuses — followed by typing
    // an option's first letter, which is a real gesture and fires `change` the same way choosing
    // with the mouse does. `selectOption`, which every earlier test used, would skip both.
    const { studio, frame } = await barOpen();
    try {
      const select = frame.locator(".rb-toolbar-select").first();
      await expect(select).toHaveValue("");
      await select.click();
      expect(await focused(select)).toBe(true);
      await studio.keyboard.type("a"); // «Amplio»
      await expect(select).toHaveValue("space.lg");
      await expect(studio.getByText("Guardado en este navegador")).toBeVisible();
    } finally {
      await studio.context().close();
    }
  }, 180_000);

  it("does not cancel the press on a control that is not a button", async () => {
    /**
     * **The change itself, measured where it is decidable.**
     *
     * Read on the frame's **document**, which the event reaches after the bar — a listener on the
     * control itself runs in the target phase, before the bar's, and sees `false` either way. That
     * is why the first probe written for this could not tell the two builds apart and focus could.
     *
     * **Only the select half is asserted here, and that is a limit rather than an omission.** The
     * other half — that a press on a *button* is still cancelled — cannot be read the same way: a
     * button press writes a style, which changes the document, which reloads the frame and takes
     * the recording with it. What covers it instead is every other toolbar test in this file: they
     * all drive buttons, and a button that stopped being cancelled would fire `blur` before
     * `click`, commit a text edit at the wrong moment and close the bar under the pointer — which
     * is what those tests were written against and what they would catch.
     */
    const { studio, frame } = await barOpen();
    try {
      await frame.locator(".rb-toolbar").evaluate((bar) => {
        const w = bar.ownerDocument.defaultView as unknown as { cancelled: boolean[] };
        w.cancelled = [];
        bar.ownerDocument.addEventListener("mousedown", (event) => {
          w.cancelled.push(event.defaultPrevented);
        });
      });

      await frame.locator(".rb-toolbar-select").first().click();
      await frame.locator('.rb-toolbar-exact[aria-label^="Tamaño"]').click();

      const cancelled = await frame
        .locator("body")
        .evaluate(() => (window as unknown as { cancelled: boolean[] }).cancelled);
      expect(cancelled.length, "neither press reached the document").toBe(2);
      expect(cancelled, "a press on a select or an input must not be cancelled").toEqual([
        false,
        false,
      ]);
    } finally {
      await studio.context().close();
    }
  }, 180_000);
});
