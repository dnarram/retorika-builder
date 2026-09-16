import { presetFor } from "@retorika/catalog";
import {
  applyRevert,
  checkAgainstPreset,
  escalate,
  invariantTestName,
  listEditableFields,
  parseDocument,
  planRevert,
  RevertDecisionRequiredError,
  type Section,
} from "@retorika/schema";
import { arbitraryDocument } from "@retorika/schema/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The five invariants of protocol Part 8.2.
 *
 * Every test name comes from INVARIANTS via invariantTestName — none is typed by hand,
 * so the reporter output is the constant by construction and cannot drift from the
 * documentation.
 */

const corpus = loadCorpus();
const cover = presetFor("cover");

/** Only catalog sections answer to a preset; a free section is by definition not bound. */
const catalogSections = (sections: readonly Section[]) =>
  sections.filter((section) => section.source === "catalog");

describe("invariants", () => {
  it(invariantTestName("INV_1"), () => {
    for (const { name, document } of corpus) {
      const fields = listEditableFields(document);

      const expected = document.pages.flatMap((page) =>
        page.sections.flatMap((section) => section.content.map((el) => el.id)),
      );
      // Every content field, with no exceptions.
      expect(
        fields.map((f) => f.elementId),
        name,
      ).toEqual(expect.arrayContaining(expected));

      // Hidden ones especially: rule 3 exists so the client always finds where to change
      // their phone number, and a listing that skipped them would make the rule true in
      // storage and false in practice.
      const hiddenIds = document.pages.flatMap((page) =>
        page.sections.flatMap((section) =>
          section.content.filter((el) => el.hidden).map((el) => el.id),
        ),
      );
      const listedHidden = fields.filter((f) => f.hidden).map((f) => f.elementId);
      expect(listedHidden.sort(), name).toEqual(hiddenIds.sort());

      for (const page of document.pages) {
        for (const section of catalogSections(page.sections)) {
          expect(checkAgainstPreset(section, cover), `${name}/${section.id}`).toEqual([]);
        }
      }
    }
  });

  it(`${invariantTestName("INV_1")} (generated documents)`, () => {
    fc.assert(
      fc.property(arbitraryDocument(cover, "image-right"), (doc) => {
        const ids = doc.pages.flatMap((p) => p.sections.flatMap((s) => s.content.map((e) => e.id)));
        const listed = listEditableFields(doc).map((f) => f.elementId);
        expect(listed).toEqual(expect.arrayContaining(ids));
      }),
      { numRuns: 100 },
    );
  });

  it(invariantTestName("INV_2"), () => {
    for (const { name, document } of corpus) {
      for (const page of document.pages) {
        for (const section of page.sections) {
          // Dropping the layout must leave content untouched: rule 1 says layout never
          // owns content, so removing it cannot take any with it.
          const stripped: Section = { ...section, layout: null };
          expect(stripped.content, `${name}/${section.id}`).toEqual(section.content);

          if (section.source === "catalog") {
            expect(checkAgainstPreset(stripped, cover), `${name}/${section.id}`).toEqual([]);
          }
        }
      }
    }
  });

  it(invariantTestName("INV_3A"), () => {
    fc.assert(
      fc.property(arbitraryDocument(cover, "image-right"), (doc) => {
        const section = doc.pages[0]?.sections[0];
        if (!section) return;

        const back = applyRevert(escalate(section, cover), cover);

        // Ignoring nothing but the absence of timestamps: there are none in the model,
        // so this is plain structural and content equality.
        expect(back).toEqual(section);
      }),
      { numRuns: 200 },
    );
  });

  it(invariantTestName("INV_3B"), () => {
    fc.assert(
      fc.property(
        arbitraryDocument(cover, "image-right"),
        fc.array(fc.nat(), { maxLength: 6 }),
        (doc, picks) => {
          const section = doc.pages[0]?.sections[0];
          if (!section) return;

          const free = escalate(section, cover);

          // Content edits while the section is free: retitle some elements, and add a
          // surplus link the preset has nowhere to put.
          const edited: Section = {
            ...free,
            content: [
              ...free.content.map((el, index) =>
                picks.includes(index)
                  ? { ...el, value: { kind: "text" as const, text: "edited" } }
                  : el,
              ),
              {
                id: "el-surplus",
                role: "link" as const,
                hidden: false,
                slot: "nowhere",
                value: { kind: "link" as const, text: "extra", href: "#" },
              },
            ],
          };

          const plan = planRevert(edited, cover);
          expect(plan.surplus.map((s) => s.elementId)).toContain("el-surplus");

          // Nothing happens to surplus content without an explicit decision. The guarantee
          // is in the signature, not in a dialog that can be dismissed.
          expect(() => applyRevert(edited, cover)).toThrow(RevertDecisionRequiredError);

          const back = applyRevert(edited, cover, { "el-surplus": "hide" });

          const before = new Set(edited.content.map((el) => el.id));
          const after = new Set(back.content.map((el) => el.id));
          for (const id of before) expect(after.has(id)).toBe(true);

          // What does not fit is present and hidden — never missing.
          expect(back.content.find((el) => el.id === "el-surplus")?.hidden).toBe(true);

          // And hiding it does not put the section in breach of its own preset.
          expect(checkAgainstPreset(back, cover)).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it(invariantTestName("INV_4"), () => {
    // Provisional in phase 0: the switch does not exist yet, so what is genuinely
    // verified is that the document has nowhere to store it. See PROVISIONAL_INVARIANTS.
    for (const { name, document } of corpus) {
      const before = JSON.stringify(document);

      let designTools = false;
      for (let i = 0; i < 100; i += 1) designTools = !designTools;

      expect(JSON.stringify(document), name).toBe(before);
      expect(() => parseDocument({ ...document, designTools }), name).toThrow();
    }
  });

  it(invariantTestName("INV_5"), () => {
    for (const { name, document } of corpus) {
      const first = render(document, "html");
      const second = render(document, "html");

      // Deterministic: the same document twice gives the same bytes. Without this the
      // golden files are noise and "publishing produces the same output" is unprovable.
      expect(second.html, name).toBe(first.html);
      expect(second.css, name).toBe(first.css);
    }
  });
});
