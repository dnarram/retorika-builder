import {
  HEADER_BACKGROUNDS,
  HEADER_LAYOUTS,
  PAGES_POSITIONS,
  SECTIONS_ON_MOBILE,
  SECTIONS_POSITIONS,
} from "@retorika/schema";
import { PALETTES } from "@retorika/tokens";
import { type Combination, headerCase } from "../../../packages/renderer/test/browser-fixtures.ts";

/**
 * **The menu audit's matrix** (sprint 33 día 2): every pair of places × every scheme × fixed or
 * not — 3 × 5 × 5 × 2 = 150 documents — with the phone's choice and the layout **rotated** over
 * them rather than multiplied: the full product is 1 350 documents, which over seven widths and three
 * engines is 28 350 states, and a list that long is never read. Each of the three phone choices and
 * each of the three layouts appears in a third of the 150, never aligned with each other (the layout
 * advances every three documents, the phone choice every one), so every place pair meets every phone
 * choice and every scheme meets every layout somewhere in the matrix. The counts are printed by the
 * run; what is not covered is a *particular* phone choice with a *particular* layout on a *particular*
 * pair, and the sprint 32 harness holds the sheet's own geometry per phone choice already.
 *
 * Then the cases the rotation cannot reach, each the thing it is named for: the brand and the button
 * sent to the pages' column; the sections hidden on the phone under a row drawn at every width; a row
 * at every width with «Ir a…» on the phone. On the fixed palette: colour is a property of a scheme and
 * a palette, and `a11y.browser.test.ts` runs the five schemes over the five palettes with axe already.
 */
export function auditCombinations(): Combination[] {
  const palette = PALETTES[0];
  if (!palette) throw new Error("no palette");
  const out: Combination[] = [];
  let i = 0;
  for (const pages of PAGES_POSITIONS) {
    for (const sections of SECTIONS_POSITIONS) {
      for (const background of HEADER_BACKGROUNDS) {
        for (const sticky of [false, true]) {
          const mobile = SECTIONS_ON_MOBILE[i % SECTIONS_ON_MOBILE.length];
          const layout = HEADER_LAYOUTS[Math.floor(i / 3) % HEADER_LAYOUTS.length];
          if (!mobile || !layout) throw new Error("the rotation ran out of values");
          out.push(
            headerCase(
              `audit/${pages}-${sections}/${background}/${sticky ? "fixed" : "flow"}/${mobile}/${layout}`,
              palette.id,
              {
                pages: { shown: true, position: pages },
                sections: { shown: true, position: sections, mobile },
                look: { background },
                sticky,
                layout,
              },
            ),
          );
          i += 1;
        }
      }
    }
  }
  out.push(
    headerCase("audit/special/brand-with-pages", palette.id, {
      pages: { shown: true, position: "left" },
      sections: { shown: true, position: "right", mobile: "fold" },
      brandWithPages: true,
      sticky: true,
    }),
    headerCase("audit/special/row-hidden-on-phone", palette.id, {
      pages: { shown: true, position: "bar" },
      sections: { shown: true, position: "row", mobile: "hidden" },
      sticky: true,
    }),
    headerCase("audit/special/row-fold-on-phone", palette.id, {
      pages: { shown: true, position: "bar" },
      sections: { shown: true, position: "row", mobile: "fold" },
    }),
  );
  return out;
}

/** How often each rotated value appears, for the run's own report. */
export function rotationCounts(combinations: readonly Combination[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of combinations) {
    const [, , , , mobile, layout] = c.id.split("/");
    if (!mobile || !layout) continue;
    counts[`mobile:${mobile}`] = (counts[`mobile:${mobile}`] ?? 0) + 1;
    counts[`layout:${layout}`] = (counts[`layout:${layout}`] ?? 0) + 1;
  }
  return counts;
}
