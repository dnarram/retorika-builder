import { blankItem, blankSection, GALLERY_ID } from "@retorika/catalog";
import { flattenElements } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { photoSrcFor } from "../src/editor/photos.ts";

/**
 * What an uploaded photograph is called inside the ZIP.
 *
 * This is a regression test for a defect the eighth catalog section exposed and that no unit test
 * could have found: the name was derived from the section alone, which was unique for as long as a
 * section held at most one image. "Fotos de trabajos" holds up to eight, so every card in a gallery
 * resolved to `foto-sec-gallery.jpg` — each upload silently overwrote the previous one's bytes, and
 * the published page showed the same photograph eight times over. Nothing threw; it was found by
 * uploading three photographs in a browser and noticing all three had one name.
 */

describe("the name an uploaded photo takes", () => {
  it("is different for every image in the same section", () => {
    // The defect, stated as the property it violated.
    const gallery = blankSection(GALLERY_ID, "stacked", "sec-gallery");
    const extra = [1, 2, 3].map((n) => ({
      id: `item-${n + 1}`,
      elements: blankItem(GALLERY_ID).elements.map((element) => ({
        ...element,
        id: `${element.id}-${n}`,
      })),
    }));
    const list = gallery.content.find((element) => element.role === "list");
    if (!list) throw new Error("a blank gallery has no list");
    const withMore = { ...list, items: [...(list.items ?? []), ...extra] };

    const images = flattenElements([withMore]).filter((element) => element.role === "image");
    expect(images.length, "the fixture must hold several photographs").toBe(4);

    const names = images.map((image) => photoSrcFor("sec-gallery", image.id));
    expect(new Set(names).size, `collided: ${names.join(", ")}`).toBe(names.length);
  });

  it("is different for the same element id in two different sections", () => {
    // The property the old name already had, which the fix must not lose: two galleries added to
    // one page mint different section ids but reuse the same element ids inside them.
    expect(photoSrcFor("sec-a", "el-item-photo")).not.toBe(photoSrcFor("sec-b", "el-item-photo"));
  });

  it("is stable, so uploading again over one photograph replaces it", () => {
    // What stops a ZIP accumulating every photograph an owner ever tried.
    expect(photoSrcFor("sec-cover", "el-image")).toBe(photoSrcFor("sec-cover", "el-image"));
  });

  it("is a plain file name a ZIP and a file:// link can both carry", () => {
    // It ends up in `assets/<name>` in the bundle and in an `src` on the published page, so it may
    // not need escaping and may not walk out of the directory.
    const name = photoSrcFor("sec-gallery", "el-item-1-photo");
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*\.jpg$/);
    expect(name).not.toContain("..");
  });
});
