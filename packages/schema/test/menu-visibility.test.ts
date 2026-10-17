import { describe, expect, it } from "vitest";
import { listDeadDestinations } from "../src/destinations.ts";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { pageToSection, sectionToPage, setPageInMenu, setSectionInMenu } from "../src/index.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * **Taking a destination out of the menu takes it out of the menu, and out of nothing else**
 * (ADR 0043 §3, and David's own condition on approving the sprint).
 *
 * This is the file that holds the line between «fuera del menú» and «fuera de la web». A section
 * the owner has pruned is still on the page, still carries its id, still answers to its anchor —
 * so a link written at it, by an avance or by hand, is still a live destination and the download
 * is not refused. Without this, «quitar del menú» would quietly become a way to break a link the
 * owner wrote somewhere else, and the first they would hear of it is a refused download.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function section(id: string, catalogId: string, title: string): Section {
  return {
    id,
    preset: { catalogId, variantId: catalogId === "cover" ? "image-right" : "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: `el-${id}`,
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: title },
      },
    ],
  };
}

/** A home page whose contact section points at «Dónde estamos» by its anchor, plus a second page. */
function documentWithALinkToTheSection(): RetorikaDocument {
  return {
    schemaVersion: "1.10.0",
    id: "doc-menu",
    siteName: "Taberna",
    theme,
    collections: [],
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Taberna",
        sections: [
          section("sec-cover", "cover", "Taberna"),
          section("sec-location", "location", "Dónde estamos"),
          {
            ...section("sec-contact", "contact", "Te esperamos"),
            content: [
              {
                id: "el-contact-heading",
                role: "heading",
                hidden: false,
                slot: "headline",
                value: { kind: "text", text: "Te esperamos" },
              },
              {
                id: "el-contact-link",
                role: "button",
                hidden: false,
                slot: "primaryAction",
                value: { kind: "link", text: "Cómo llegar", href: "#sec-location" },
              },
            ],
          },
        ],
      },
      {
        id: "p2",
        slug: "carta",
        title: "Nuestra carta",
        sections: [section("sec-carta", "prices", "Nuestra carta")],
      },
    ],
  };
}

describe("taking a section out of the menu", () => {
  it("does not change its id, its heading or where it sits", () => {
    const before = documentWithALinkToTheSection();
    const after = setSectionInMenu(before, "sec-location", false);
    const was = before.pages[0]?.sections[1];
    const now = after.pages[0]?.sections[1];
    expect(now?.id).toBe("sec-location");
    expect(now?.id).toBe(was?.id);
    expect(now?.content).toEqual(was?.content);
    // Everything except the one key is the document it was.
    expect({ ...now, inMenu: undefined }).toEqual({ ...was, inMenu: undefined });
    expect(now?.inMenu).toBe(false);
  });

  /**
   * **The one that matters.** `listDeadDestinations` is what the download gate asks before it
   * writes a ZIP: a link whose anchor resolves to nothing refuses the download. A section out of
   * the menu is not a section that is gone, so a link at it must stay alive.
   */
  it("leaves a link that points at it alive, so the download is not refused", () => {
    const before = documentWithALinkToTheSection();
    expect(listDeadDestinations(before)).toEqual([]);
    const after = setSectionInMenu(before, "sec-location", false);
    expect(listDeadDestinations(after)).toEqual([]);
  });

  it("is still a decision when it says yes, because absence is not the same as a choice", () => {
    // The key's presence is what tells a curated document from one nobody has touched, which is
    // what lets the threshold of three step aside (ADR 0043 §5).
    const doc = setSectionInMenu(documentWithALinkToTheSection(), "sec-location", true);
    expect(doc.pages[0]?.sections[1]?.inMenu).toBe(true);
    // And writing the same answer twice changes nothing, so no history step opens.
    expect(setSectionInMenu(doc, "sec-location", true)).toBe(doc);
  });

  it("refuses an id that is not there, rather than doing nothing", () => {
    expect(() => setSectionInMenu(documentWithALinkToTheSection(), "sec-nope", false)).toThrow();
  });
});

describe("taking a page out of the menu", () => {
  it("writes the choice on the page and nothing else", () => {
    const after = setPageInMenu(documentWithALinkToTheSection(), "p2", false);
    expect(after.pages[1]?.inMenu).toBe(false);
    expect(after.pages[1]?.slug).toBe("carta");
    expect(after.pages[1]?.sections).toEqual(documentWithALinkToTheSection().pages[1]?.sections);
  });

  /**
   * **«Inicio» is not curatable, and a drawn page is in no menu to begin with.** An editor cannot
   * reach either switch; this is what keeps a document from storing a decision that means nothing
   * — the same reasoning `movePage` uses to refuse the first page.
   */
  it("refuses the entry page, which is «Inicio» rather than an entry", () => {
    expect(() => setPageInMenu(documentWithALinkToTheSection(), "home", false)).toThrow(/Inicio/);
  });

  it("refuses a page drawn per entry, which is in no menu (ADR 0040)", () => {
    const doc = documentWithALinkToTheSection();
    const bound: RetorikaDocument = {
      ...doc,
      collections: [{ id: "col", name: "La carta", entries: [] }],
      pages: [
        doc.pages[0] as NonNullable<(typeof doc.pages)[0]>,
        {
          ...(doc.pages[1] as NonNullable<(typeof doc.pages)[1]>),
          binding: { collectionId: "col", titleField: "nombre" },
        },
      ],
    };
    expect(() => setPageInMenu(bound, "p2", false)).toThrow(/per entry/);
  });
});

/**
 * **The conversion, there and back** — reachable only since the owner can prune a page at all
 * (sprint 23 day 4), and two different questions that look like one.
 */
describe("the conversion, there and back", () => {
  const teaser = ({ sectionId, href }: { sectionId: string; href: string }): Section => ({
    id: sectionId,
    preset: { catalogId: "teaser", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-link",
        role: "link",
        hidden: false,
        slot: "link",
        value: { kind: "link", text: "Ver más", href },
      },
    ],
  });

  /**
   * **A pruned section comes back pruned**, and not because anything carries it: the section object
   * itself travels into the page and back out with its own `inMenu` on it. The page's copy, which
   * `sectionToPage` stamps so the destination does not reappear as a page, is a second record of
   * the same decision — and this is the test that says the first one is not lost on the way home.
   */
  it("brings a pruned section back pruned", () => {
    const hidden = setSectionInMenu(documentWithALinkToTheSection(), "sec-location", false);
    const asPage = sectionToPage(hidden, "sec-location", teaser);
    const made = asPage.pages.at(-1);
    expect(made?.inMenu).toBe(false);

    const back = pageToSection(asPage, made?.id ?? "");
    expect(back.pages[0]?.sections.find((s) => s.id === "sec-location")?.inMenu).toBe(false);
  });

  /**
   * **A page's own choice goes with the page, and is not spread over its sections.** The other
   * direction has no honest answer: a page holds any number of sections, so stamping one page's
   * answer onto all of them would hide sections nobody decided about — and stamping it onto the
   * first would be arbitrary. The sections come back saying what each of them says, which for a
   * section nobody has pruned is nothing at all.
   */
  it("drops a page's own choice with the page rather than spreading it", () => {
    const asPage = sectionToPage(documentWithALinkToTheSection(), "sec-location", teaser);
    const pageId = asPage.pages.at(-1)?.id ?? "";
    const hiddenPage = setPageInMenu(asPage, pageId, false);

    const back = pageToSection(hiddenPage, pageId);
    expect(back.pages[0]?.sections.find((s) => s.id === "sec-location")?.inMenu).toBeUndefined();
  });
});
