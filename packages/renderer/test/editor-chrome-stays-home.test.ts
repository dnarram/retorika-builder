import { render } from "@retorika/renderer";
import { describe, expect, it } from "vitest";
import { loadCorpus } from "./corpus.ts";

/**
 * **Nothing the editor's keyboard needs reaches the page a client downloads.**
 *
 * Sprint 17 gives the canvas a keyboard: every section becomes focusable with a roving `tabindex`,
 * carries `role="group"` with its Spanish name, and the chosen one is marked and announced. All of
 * it is drawn by `wireInteractions` into the **live iframe's** DOM, and none of it belongs in
 * `render(doc, "html")` — ADR 0001 is why: a downloaded site is static HTML and CSS that must work
 * from `file://`, and editor affordances in it are at best noise and at worst a promise that
 * nothing answers. A `tabindex` on every section of a published page would make a visitor Tab
 * through five to nine stops that do nothing.
 *
 * **This is David's guard, asked for when he approved the sprint**: «una prueba que asevere que
 * tabindex y los atributos ARIA del lienzo solo existen en el documento del editor: el corpus
 * golden no se mueve en todo el sprint».
 *
 * It is the sibling of `pnpm renderer:deps`, and for the same reason: what travels to the client's
 * site is watched in the package that produces it, not in the one that draws over it. And it is
 * worth more than the golden corpus here, because a regenerated golden simply describes whatever
 * the renderer now emits — `UPDATE_GOLDEN=1` turns a regression into the new baseline — while a
 * test of absence cannot be satisfied that way.
 *
 * **The subject is the tree, not the text, and the first version of the modal-dialog guard is why.**
 * That one searched source text and counted a CSS selector as a dialog. Here the trap is the same
 * shape and already present: `aria-current` appears in **every** page of the corpus as the selector
 * `.rb-nav a[aria-current=page]` in the inlined stylesheet, and `aria-current="page"` is correct
 * and wanted on the menu entry naming the visitor's own page (`menu.ts`, covered by `menu.test.ts`
 * and by an `e2e` walk on a page opened with no server). So `aria-current` is forbidden **on a
 * section** and left alone on an anchor, and the stylesheet is cut out before anything is counted.
 */

/** Everything between `<style>` and `</style>`, blanked. CSS is where the false positive lives. */
function withoutStylesheets(html: string): string {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "<style></style>");
}

/** The opening tags of the document, as text, with the stylesheet taken out. */
function openingTags(html: string): string[] {
  return withoutStylesheets(html).match(/<[a-zA-Z][^>]*>/g) ?? [];
}

const corpus = loadCorpus();

/**
 * Attributes the editor's canvas keyboard uses and a published page must never carry anywhere.
 *
 * `role="group"` rather than `role=` in general: the published page legitimately emits
 * `role="list"` on `ul.rb-list` and `role="button"` on an anchor whose document role is a button,
 * both valid and both wanted. Measured rather than assumed — a guard that forbade `role=` outright
 * would have failed all seventeen pages for two correct attributes.
 */
const FORBIDDEN_ANYWHERE = ["tabindex", "aria-live", 'role="group"', "aria-activedescendant"];

describe("the editor's canvas keyboard stays in the editor", () => {
  it("has a corpus to check, so an empty sweep cannot pass", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  it.each(corpus.map((entry) => entry.name))("%s carries none of it", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    expect(entry).toBeDefined();
    if (!entry) return;
    const { html } = render(entry.document, "html");
    const body = withoutStylesheets(html);
    for (const attribute of FORBIDDEN_ANYWHERE) {
      expect(
        body.includes(attribute),
        `${name} emits ${attribute}. That is editor chrome: it is drawn by wireInteractions into ` +
          "the live iframe and has no business in a page somebody downloads (ADR 0001).",
      ).toBe(false);
    }
  });

  it.each(corpus.map((entry) => entry.name))("%s marks no section as current", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    expect(entry).toBeDefined();
    if (!entry) return;
    const { html } = render(entry.document, "html");
    // Every opening tag that is a section, and none of them may say it is the chosen one. The
    // menu's own `aria-current="page"` is on an anchor and is deliberately not in scope.
    const sections = openingTags(html).filter((tag) => tag.includes("data-section="));
    expect(
      sections.length,
      `${name} rendered no sections: this check would prove nothing`,
    ).toBeGreaterThan(0);
    for (const tag of sections) {
      expect(
        tag.includes("aria-current"),
        `${name} has a section marked aria-current. The chosen section is a fact about the editor, ` +
          `not about the page: ${tag.slice(0, 120)}`,
      ).toBe(false);
    }
  });

  it("still lets the menu mark the visitor's own page, which is not what this forbids", () => {
    /**
     * The other half, and the reason the two checks above are narrow. Without it, somebody reading
     * only the failures above would widen them to «no aria-current at all» and delete correct
     * navigation — which is what the first draft of this file would have done.
     *
     * Asserted on a page that is **not** the home page, because that is the only place the
     * attribute appears: `menu.ts` leaves out the entry for the page you are on when it is the
     * home page, so the default render of every corpus document carries the selector in its
     * stylesheet and the attribute nowhere. The golden corpus therefore never exercised this, which
     * is itself worth knowing.
     */
    const withPages = corpus.find((entry) => entry.document.pages.length > 1);
    expect(withPages, "the corpus has no multi-page document to check the menu with").toBeDefined();
    if (!withPages) return;
    const marked = withPages.document.pages
      .map((page) => render(withPages.document, "html", { pageId: page.id }).html)
      .filter((html) => withoutStylesheets(html).includes('aria-current="page"'));
    expect(
      marked.length,
      "no page of the multi-page document marks its own menu entry: either menu.ts stopped doing " +
        "it, or this test stopped reaching the branch that does.",
    ).toBeGreaterThan(0);
    // And where it appears it is on an anchor, never on a section — which is the distinction the
    // two checks above are built on.
    for (const html of marked) {
      for (const tag of openingTags(html).filter((candidate) =>
        candidate.includes("aria-current"),
      )) {
        expect(tag.startsWith("<a "), `aria-current on something that is not a link: ${tag}`).toBe(
          true,
        );
      }
    }
  });
});
