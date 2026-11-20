import { blankSection } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import { collectionFromList, insertSection, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  collectionCandidates,
  looseListOf,
  sectionDisplayName,
} from "../src/editor/collectionCandidates.ts";

/**
 * «Listas» offers only what the verb can do (sprint 40 día 1): the offer is asked by trying
 * `collectionFromList`, so a section whose cards carry a photograph — a Galería, an Equipo — is not
 * offered rather than offered and then refused with «Algo ha fallado».
 */

/** A restaurant: the one sector whose photo bank is filled, so it is born with a Galería (ADR 0039). */
function restaurant(): RetorikaDocument {
  return generate({
    ...EMPTY_ANSWERS,
    businessName: "Taberna del Puerto",
    sector: "restaurante-bar",
    services: ["Comidas"],
    address: "Muelle 3, Ronda",
    mainAction: "call",
    phone: "600111222",
  }).document;
}

function sectionOf(doc: RetorikaDocument, catalogId: string) {
  const section = doc.pages
    .flatMap((page) => page.sections)
    .find((candidate) => candidate.preset.catalogId === catalogId);
  if (!section) throw new Error(`no ${catalogId} section in this document`);
  return section;
}

describe("collectionCandidates", () => {
  it("offers «Qué hago» on a restaurant and not its Galería, whose cards carry a photograph", () => {
    const doc = restaurant();
    // The precondition the defect rests on: the Galería is there, has cards, and is not bound — so
    // the old reader offered it. Asserted so the case cannot quietly stop being the case.
    const gallery = sectionOf(doc, "gallery");
    expect(looseListOf(doc, gallery.id)).toBeDefined();

    expect(collectionCandidates(doc)).toEqual([
      {
        sectionId: sectionOf(doc, "services").id,
        slot: "services",
        suggestedName: "Qué hago",
      },
    ]);
  });

  it("does not offer an Equipo either: its cards carry a photograph too", () => {
    const doc = restaurant();
    const page = doc.pages[0];
    if (!page) throw new Error("a generated site has a page");
    const withTeam = insertSection(doc, page.id, 1, blankSection("team", "stacked", "sec-team"));
    expect(looseListOf(withTeam, "sec-team")).toBeDefined();
    expect(collectionCandidates(withTeam).map((candidate) => candidate.sectionId)).toEqual([
      sectionOf(doc, "services").id,
    ]);
  });

  it("stops offering a list once it is bound", () => {
    const doc = restaurant();
    const services = sectionOf(doc, "services");
    const bound = collectionFromList(doc, services.id, "services", "Qué hago");
    expect(collectionCandidates(bound)).toEqual([]);
  });

  it("names the list after the catalog's name for the section", () => {
    const doc = restaurant();
    expect(sectionDisplayName(doc, sectionOf(doc, "services").id)).toBe("Qué hago");
    expect(sectionDisplayName(doc, "sec-nowhere")).toBe("sec-nowhere");
  });
});
