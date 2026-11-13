// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRAND_SLIDE_RULE,
  brandMoved,
  canSlide,
  canvasMotion,
  HEADER_PAGE_RULE,
  namesSheet,
  PAGING_CLASS,
  SLIDE_NAMES_ID,
  SLIDING_CLASS,
  sectionOrder,
  shouldSlide,
  slide,
} from "../src/editor/sectionSlide.ts";

/**
 * Sections slide (sprint 35 día 3). What only a browser can show — that each section glides and
 * the page around it does not fade — is in the walks. What is here is the decision, which must be
 * exact: a typed letter that went through a view transition would wait a frame and animate the
 * page, and a moved section that did not would jump.
 */

const page = (ids: string[]) =>
  `<main>${ids.map((id) => `<section data-section="${id}"><h2>${id}</h2></section>`).join("")}</main>`;

let reduced = false;
beforeEach(() => {
  reduced = false;
  document.body.innerHTML = page(["sec-cover", "sec-services", "sec-contact"]);
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reduced,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  document.head.innerHTML = "";
  document.documentElement.className = "";
});

describe("which patches slide", () => {
  const before = ["sec-cover", "sec-services", "sec-contact"];

  it("reads the order of a page's sections", () => {
    expect(sectionOrder(document.body)).toEqual(before);
  });

  it("slides a section moved, inserted, duplicated or deleted", () => {
    expect(shouldSlide(before, ["sec-services", "sec-cover", "sec-contact"], true)).toBe(true);
    expect(shouldSlide(before, [...before, "sec-new"], true)).toBe(true);
    expect(
      shouldSlide(before, ["sec-cover", "sec-services", "sec-services-2", "sec-contact"], true),
    ).toBe(true);
    expect(shouldSlide(before, ["sec-cover", "sec-contact"], true)).toBe(true);
  });

  it("never slides a patch that leaves the order as it was — a letter, a colour, a photograph", () => {
    expect(shouldSlide(before, [...before], true)).toBe(false);
  });

  it("never slides another page: a page shown is drawn, not rearranged", () => {
    expect(shouldSlide(before, ["sec-a", "sec-b"], false)).toBe(false);
  });
});

/**
 * **Which movement a patch is drawn with** (sprint 36 día 7): another page crosses over, a change of
 * order slides, a brand that moved settles, and a typed letter is patched at once. One call, one
 * answer, so the caller has nothing to combine.
 */
describe("which movement a patch is drawn with", () => {
  const before = ["sec-cover", "sec-services", "sec-contact"];

  it("crosses over to another page, whatever its sections and its bar", () => {
    expect(canvasMotion(before, ["sec-a", "sec-b"], false, false)).toEqual({ kind: "page" });
    expect(canvasMotion(before, [...before], false, true)).toEqual({ kind: "page" });
  });

  it("slides the sections whose order changed, and settles a brand that moved, on the same page", () => {
    expect(canvasMotion(before, ["sec-services", "sec-cover", "sec-contact"], true, false)).toEqual(
      { kind: "slide", sections: true, brand: false },
    );
    expect(canvasMotion(before, [...before], true, true)).toEqual({
      kind: "slide",
      sections: false,
      brand: true,
    });
  });

  it("draws a typed letter at once", () => {
    expect(canvasMotion(before, [...before], true, false)).toEqual({ kind: "none" });
  });
});

describe("when a document can slide", () => {
  it("not without view transitions", () => {
    expect(canSlide(document)).toBe(false);
  });

  it("with them, unless the reader asked for less movement", () => {
    (document as { startViewTransition?: unknown }).startViewTransition = () => ({});
    expect(canSlide(document)).toBe(true);
    reduced = true;
    expect(canSlide(document)).toBe(false);
  });
});

describe("the transition itself", () => {
  it("names each section by its place, never by its id, so any id is a valid name", () => {
    expect(namesSheet(['sec-"odd"', "sec-cover"])).toBe(
      '[data-section="sec-\\"odd\\""] { view-transition-name: rb-s-0; }\n' +
        '[data-section="sec-cover"] { view-transition-name: rb-s-1; }',
    );
  });

  it("runs the update inside the document's transition, with the names on, and takes them off after", async () => {
    let finish: () => void = () => {};
    const seen: { named: boolean; sliding: boolean }[] = [];
    const start = vi.fn((update: () => void) => {
      update();
      return {
        finished: new Promise<void>((done) => {
          finish = done;
        }),
        ready: Promise.reject(new Error("skipped")),
        updateCallbackDone: Promise.resolve(),
      };
    });
    (document as { startViewTransition?: unknown }).startViewTransition = start;
    slide(document, ["sec-services"], () => {
      seen.push({
        named: document.getElementById(SLIDE_NAMES_ID) !== null,
        sliding: document.documentElement.classList.contains(SLIDING_CLASS),
      });
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ named: true, sliding: true }]);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById(SLIDE_NAMES_ID)).toBeNull();
    expect(document.documentElement.classList.contains(SLIDING_CLASS)).toBe(false);
  });

  /**
   * **Another page crosses over with the bar still** (sprint 36 día 7): the same transition, the
   * root marked as crossing rather than sliding while it runs, and the bar named for it alone.
   */
  it("marks the root as crossing over and names the bar, for that transition only", async () => {
    let finish: () => void = () => {};
    const seen: { paging: boolean; sliding: boolean; bar: boolean }[] = [];
    (document as { startViewTransition?: unknown }).startViewTransition = (update: () => void) => {
      update();
      return {
        finished: new Promise<void>((done) => {
          finish = done;
        }),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
    slide(
      document,
      [],
      () => {
        const root = document.documentElement.classList;
        seen.push({
          paging: root.contains(PAGING_CLASS),
          sliding: root.contains(SLIDING_CLASS),
          bar: (document.getElementById(SLIDE_NAMES_ID)?.textContent ?? "").includes("rb-header"),
        });
      },
      HEADER_PAGE_RULE,
      PAGING_CLASS,
    );
    expect(seen).toEqual([{ paging: true, sliding: false, bar: true }]);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.classList.contains(PAGING_CLASS)).toBe(false);
    expect(document.getElementById(SLIDE_NAMES_ID)).toBeNull();
  });

  /**
   * **A newer transition takes the root whole.** A transition skipped by a newer one still has its
   * update called — after the newer one cleared the root — and its end arrives late: neither may
   * leave its class on the root, where a slide's would hide every gap for good.
   */
  it("leaves no class behind when a newer transition skips an older one", async () => {
    const pending: { update: () => void; finish: () => void }[] = [];
    (document as { startViewTransition?: unknown }).startViewTransition = (update: () => void) => {
      let finish: () => void = () => {};
      const finished = new Promise<void>((done) => {
        finish = done;
      });
      pending.push({ update, finish });
      return { finished, ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    };
    const root = document.documentElement.classList;
    slide(document, ["sec-services"], () => {});
    slide(document, [], () => {}, HEADER_PAGE_RULE, PAGING_CLASS);
    // The browser calls the skipped one's update first, then the newer one's, then ends both.
    pending[0]?.update();
    pending[1]?.update();
    expect(root.contains(SLIDING_CLASS), "the skipped slide took the root back").toBe(false);
    expect(root.contains(PAGING_CLASS)).toBe(true);
    pending[0]?.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.contains(PAGING_CLASS), "the skipped slide's end cleared the crossing").toBe(true);
    pending[1]?.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.contains(PAGING_CLASS)).toBe(false);
    expect(root.contains(SLIDING_CLASS)).toBe(false);
    expect(document.getElementById(SLIDE_NAMES_ID)).toBeNull();
  });

  /**
   * **The brand settles** (sprint 35 día 6): a patch that moves the bar's brand — its place, its
   * logo's size, the layout it sits in — names the brand for the transition; a patch that leaves
   * those as they were, a typed letter, does not. And the brand's rule rides the same sheet.
   */
  it("names the brand when its place, its logo's size or its layout changed, and not otherwise", () => {
    const bar = (attributes: Record<string, string>) => {
      const root = document.implementation.createHTMLDocument("bar");
      const header = root.createElement("header");
      header.className = "rb-header";
      for (const [name, value] of Object.entries(attributes)) header.setAttribute(name, value);
      root.body.append(header);
      return root.body;
    };
    const plain = bar({ "data-layout": "brand-left" });
    expect(brandMoved(plain, bar({ "data-layout": "brand-left" }))).toBe(false);
    expect(brandMoved(plain, bar({ "data-layout": "brand-left", "data-brand-place": "end" }))).toBe(
      true,
    );
    expect(brandMoved(plain, bar({ "data-layout": "brand-left", "data-logo-size": "lg" }))).toBe(
      true,
    );
    expect(brandMoved(plain, bar({ "data-layout": "stacked" }))).toBe(true);
    // A bar that is not drawn on either side: nothing to settle.
    const none = document.implementation.createHTMLDocument("none").body;
    expect(brandMoved(none, plain)).toBe(false);
    expect(brandMoved(plain, none)).toBe(false);
    expect(namesSheet([], BRAND_SLIDE_RULE)).toBe(BRAND_SLIDE_RULE);
    expect(namesSheet(["sec-cover"], BRAND_SLIDE_RULE)).toContain("rb-s-0");
    expect(namesSheet(["sec-cover"], BRAND_SLIDE_RULE)).toContain("rb-brand");
    expect(namesSheet(["sec-cover"])).not.toContain("rb-brand");
  });
});
