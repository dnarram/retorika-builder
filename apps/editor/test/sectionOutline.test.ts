import { teaserSection } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import { type RetorikaDocument, sectionToPage } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { dropOf, gapAt, outlineOf, type RowBox } from "../src/editor/sectionOutline.ts";

/** The restaurant the product generates: a cover, its sections and a footer, on one page. */
const site = (): RetorikaDocument => {
  const [first] = generateVariants({
    ...EMPTY_ANSWERS,
    businessName: "Taberna Santo Domingo",
    sector: "restaurante-bar",
    services: ["comidas", "tapas"],
    address: "Cta. de Santo Domingo, 2, Ronda",
    mainAction: "book",
    bookingLink: "https://reservas.example.com/taberna",
  });
  if (!first) throw new Error("the generator produced no variant");
  return first.document;
};

/** And with «Qué ponemos» made a page of its own, as an owner does. */
const twoPages = (): RetorikaDocument =>
  sectionToPage(site(), "sec-services", ({ sectionId, href }) =>
    teaserSection(sectionId, href, "Ver más"),
  );

const rows = (pages: readonly { pageId: string; ids: readonly string[] }[]): RowBox[] => {
  const out: RowBox[] = [];
  let y = 0;
  for (const page of pages) {
    y += 40; // the page's own heading
    for (const id of page.ids) {
      out.push({ pageId: page.pageId, sectionId: id, top: y, bottom: y + 30 });
      y += 32;
    }
  }
  return out;
};

describe("gapAt", () => {
  const boxes = rows([
    { pageId: "a", ids: ["s1", "s2", "s3"] },
    { pageId: "b", ids: ["t1"] },
  ]);

  it("finds the gap above a row, and the one below a page's last", () => {
    expect(gapAt(boxes, 41)).toMatchObject({ pageId: "a", index: 0 });
    expect(gapAt(boxes, 106)).toMatchObject({ pageId: "a", index: 2 });
    expect(gapAt(boxes, 136)).toMatchObject({ pageId: "a", index: 3 });
    expect(gapAt(boxes, 900)).toMatchObject({ pageId: "b", index: 1 });
  });

  it("answers nothing over an empty outline", () => {
    expect(gapAt([], 10)).toBeNull();
  });
});

describe("outlineOf and dropOf, against the sample site", () => {
  it("lists each page's sections, and offers no other page while there is none", () => {
    const doc = site();
    const outline = outlineOf(doc);
    expect(outline).toHaveLength(doc.pages.length);
    expect(outline[0]?.rows.map((row) => row.sectionId)).toEqual(
      doc.pages[0]?.sections.map((s) => s.id),
    );
    expect(outline[0]?.rows.every((row) => row.pages.length === 0)).toBe(true);
    expect(outline[0]?.rows[0]?.name).not.toBe("");
  });

  it("within its page, counts the carried row out: the gap under the next row is one place down", () => {
    const doc = site();
    const ids = doc.pages[0]?.sections.map((s) => s.id) ?? [];
    const pageId = doc.pages[0]?.id ?? "";
    const second = ids[1] ?? "";
    // The gap above the fourth row is below the second and third: the second ends third (index 2).
    expect(dropOf(doc, second, { pageId, index: 3, y: 0 })).toEqual({ kind: "within", toIndex: 2 });
    // Upwards nothing is counted out.
    expect(dropOf(doc, ids[3] ?? "", { pageId, index: 1, y: 0 })).toEqual({
      kind: "within",
      toIndex: 1,
    });
    // Its own two gaps change nothing.
    expect(dropOf(doc, second, { pageId, index: 1, y: 0 })).toBeNull();
    expect(dropOf(doc, second, { pageId, index: 2, y: 0 })).toBeNull();
  });
});

describe("dropOf to another page", () => {
  it("offers the other page to a section that may go, and none to the cover or the footer", () => {
    const doc = twoPages();
    const home = outlineOf(doc)[0];
    const second = doc.pages[1]?.id ?? "";
    expect(home?.rows.find((row) => row.sectionId === "sec-gallery")?.pages).toEqual([
      { id: second, title: doc.pages[1]?.title },
    ]);
    expect(home?.rows.find((row) => row.sectionId === "sec-cover")?.pages).toEqual([]);
    expect(home?.rows.find((row) => row.sectionId === "sec-footer")?.pages).toEqual([]);
  });

  it("lands at the gap on the other page, held above a footer that closes it", () => {
    const doc = twoPages();
    const home = doc.pages[0];
    const second = doc.pages[1]?.id ?? "";
    expect(dropOf(doc, "sec-gallery", { pageId: second, index: 0, y: 0 })).toEqual({
      kind: "page",
      pageId: second,
      index: 0,
    });
    // From the second page to the bottom of the home page: above its footer.
    expect(
      dropOf(doc, "sec-services", {
        pageId: home?.id ?? "",
        index: home?.sections.length ?? 0,
        y: 0,
      }),
    ).toEqual({ kind: "page", pageId: home?.id, index: (home?.sections.length ?? 0) - 1 });
  });

  it("writes nothing for a section dropped on a page it may not go to", () => {
    const doc = twoPages();
    expect(dropOf(doc, "sec-cover", { pageId: doc.pages[1]?.id ?? "", index: 0, y: 0 })).toBeNull();
  });
});
