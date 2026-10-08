import { servesSector } from "@retorika/copybank";
import { SECTOR_IDS } from "@retorika/generator";
import { hasSamplePhotos, sectorsInBank } from "@retorika/photobank";
import { describe, expect, it } from "vitest";

/**
 * The one thing the two banks have to agree on, and the sentence that depends on it.
 *
 * `questionnaire.step2.other.warning` says «Todavía no tenemos textos ni fotos preparados para
 * {sector}» — one sentence naming both banks — while the condition that shows it,
 * `Step2Sector.tsx`'s `noBank`, asks only `servesSector`, which is the *copy* bank. That was
 * harmless from 29 September to 8 October 2026, because the photo bank was empty everywhere and
 * «ni fotos» had been removed from the sentence for exactly that reason.
 *
 * The first approved photograph brings the sentence back and makes the coupling real. It holds
 * today because the only sector with photographs, restaurante-bar, also has texts — but that is a
 * fact about the order the work happened in, not a property of the code. Photograph a sector
 * before writing it and the screen would tell its owner we have no photographs for them while
 * showing them three cards with ours.
 *
 * So it is asserted rather than assumed. The failure this catches is a sentence on a screen, which
 * is the kind nothing else here would catch: no type, no schema and no renderer knows that those
 * two banks are named in one line of Spanish.
 */
describe("the two banks, where a single sentence speaks for both", () => {
  it("never has photographs for a sector it has no texts for", () => {
    for (const sector of sectorsInBank()) {
      if (!hasSamplePhotos(sector)) continue;
      expect(
        servesSector(sector),
        `${sector} has photographs but no texts — «ni fotos» in the step 2 warning is now a lie`,
      ).toBe(true);
    }
  });

  it("covers every sector the questionnaire can actually offer", () => {
    // The guard against the loop above going quiet: it iterates the photo bank's own sectors, so a
    // sector the questionnaire offers and the photo bank has never heard of would slip past it.
    const known = new Set(sectorsInBank());
    for (const sector of SECTOR_IDS) {
      expect(known.has(sector), `${sector} is offered but the photo bank has no file for it`).toBe(
        true,
      );
    }
  });

  it("has at least one sector with photographs, or the first assertion checks nothing", () => {
    expect(sectorsInBank().filter(hasSamplePhotos).length).toBeGreaterThan(0);
  });
});
