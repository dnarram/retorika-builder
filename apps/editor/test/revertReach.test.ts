import { presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import {
  escalateSection,
  fillSlot,
  type RetorikaDocument,
  revertImpact,
  revertSection,
  setPlacement,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { elementLabels } from "../src/editor/designTree.ts";
import { sectionFields } from "../src/editor/sectionFields.ts";

/**
 * How far the return dialog's branches can actually be reached — the question day 4 of the plan said
 * to answer **before** writing the dialog rather than after.
 *
 * The answer turned out sharper than expected, and it is the reason the surplus branch is built
 * rather than deferred:
 *
 * - **No click produces a surplus element.** The fields panel offers one more row only while
 *   `existing.length < slot.max`, so the interface cannot overfill a slot.
 * - **`packages/schema` can.** `fillSlot` enforces "the only occurrence you can create is the next
 *   one" — deliberately, and its comment explains why — but it does **not** know the preset's
 *   maximum, because it takes a slot order rather than a preset. So the state the dialog exists for
 *   is one missing check away from real, not impossible.
 *
 * Both halves are asserted here. The first is what makes it honest to say the branch is unreachable
 * today; the second is what makes it dishonest to call it dead code. If somebody widens the panel,
 * the first test fails and this file is where the claim gets corrected.
 */

const answers = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["Comidas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
};

const doc: RetorikaDocument = generate(answers).document;
const cover = presetFor("cover");
const free = escalateSection(doc, "sec-cover", cover);

const COVER_SLOTS = [
  "headline",
  "subheadline",
  "body",
  "image",
  "primaryAction",
  "secondaryAction",
];

/** A second headline on a cover whose preset allows one — surplus, by the third of `planRevert`'s
 * three reasons. Built through the schema because nothing else can build it. */
function withSecondHeadline(): RetorikaDocument {
  return fillSlot(free, {
    sectionId: "sec-cover",
    slot: "headline",
    occurrence: 1,
    role: "heading",
    value: { kind: "text", text: "Un segundo titular" },
    slotOrder: COVER_SLOTS,
  });
}

describe("what the interface can and cannot produce", () => {
  it("never offers a row past the preset's maximum, so no click overfills a slot", () => {
    for (const slot of cover.slots) {
      const rows = sectionFields(free, "sec-cover").filter((row) => row.slot === slot.slot);
      expect(rows.length, `${slot.slot} offers at most its maximum`).toBeLessThanOrEqual(slot.max);
    }
  });

  it("so a section straight off the escalation has nothing surplus to decide about", () => {
    expect(revertImpact(free, "sec-cover", cover)).toMatchObject({ surplus: [], lossless: true });
  });

  it("but the schema can overfill a slot, which is why the branch is built", () => {
    // `fillSlot` refuses to create the third of something when there is no second — and stops
    // there. It takes a slot order, not a preset, so it has no way to know the maximum.
    const impact = revertImpact(withSecondHeadline(), "sec-cover", cover);
    expect(impact?.surplus).toEqual([
      { elementId: "el-headline-2", slot: "headline", reason: 'slot "headline" shows at most 1' },
    ]);
    expect(impact?.lossless).toBe(false);
  });
});

describe("the two decisions, applied", () => {
  it("hiding keeps the element and its words, and the fields panel still lists it", () => {
    const back = revertSection(withSecondHeadline(), "sec-cover", cover, {
      "el-headline-2": "hide",
    });
    const element = back.pages[0]?.sections
      .find((section) => section.id === "sec-cover")
      ?.content.find((candidate) => candidate.id === "el-headline-2");

    expect(element?.hidden).toBe(true);
    expect(element?.value).toEqual({ kind: "text", text: "Un segundo titular" });
    // Rule 3's whole point: hidden is not gone, and the panel is where it is found again — which is
    // exactly what the dialog's «La encontrarás en los campos de la sección» promises.
    expect(sectionFields(back, "sec-cover").some((row) => row.elementId === "el-headline-2")).toBe(
      true,
    );
  });

  it("deleting removes it, and only it", () => {
    const before = withSecondHeadline();
    const back = revertSection(before, "sec-cover", cover, { "el-headline-2": "delete" });
    const content = back.pages[0]?.sections.find((section) => section.id === "sec-cover")?.content;

    expect(content?.some((candidate) => candidate.id === "el-headline-2")).toBe(false);
    expect(content?.some((candidate) => candidate.id === "el-headline")).toBe(true);
  });

  it("the default, when the interface names no decision, is to hide", () => {
    // What `revertSection` does with an empty `decisions` — the path a lossless return takes, where
    // there was nothing to decide, and the backstop that keeps a reducer from being thrown into.
    const back = revertSection(withSecondHeadline(), "sec-cover", cover);
    const element = back.pages[0]?.sections
      .find((section) => section.id === "sec-cover")
      ?.content.find((candidate) => candidate.id === "el-headline-2");
    expect(element?.hidden).toBe(true);
  });
});

describe("elementLabels — one name per element, for all three surfaces", () => {
  it("names an element the layout does not place", () => {
    // The reason this is not simply `designRows`. A surplus element created after the section was
    // escalated has no placement — `escalate` drew the layout from the elements that existed then —
    // so the tree cannot name it and the dialog must.
    const overfilled = withSecondHeadline();
    const placed = overfilled.pages[0]?.sections
      .find((section) => section.id === "sec-cover")
      ?.layout?.placements.map((placement) => placement.elementId);

    expect(placed).not.toContain("el-headline-2");
    expect(elementLabels(overfilled, "sec-cover").get("el-headline-2")).toBe("Titular 2");
  });

  it("names the first of a slot without a number, and the second with one", () => {
    const labels = elementLabels(withSecondHeadline(), "sec-cover");
    expect(labels.get("el-headline")).toBe("Titular");
    expect(labels.get("el-headline-2")).toBe("Titular 2");
  });

  it("agrees with the design tree wherever both can name the same element", () => {
    // The whole reason it is one function: two panels calling one element two things is the defect
    // this prevents, and moving an element must not change what it is called.
    const moved = setPlacement(free, "sec-cover", "el-headline", { column: 3, columnSpan: 4 });
    const labels = elementLabels(moved, "sec-cover");
    for (const row of [
      { elementId: "el-headline", label: "Titular" },
      { elementId: "el-subheadline", label: "Subtítulo" },
    ]) {
      expect(labels.get(row.elementId)).toBe(row.label);
    }
  });

  it("is empty for a section that is not there", () => {
    expect(elementLabels(doc, "sec-nope").size).toBe(0);
  });
});
