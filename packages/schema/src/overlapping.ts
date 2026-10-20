import type { Placement, RetorikaDocument } from "./document.ts";

/**
 * **What overlaps what, and the one case worth telling an owner about** (ADR 0050 §6, sprint 25
 * día 5).
 *
 * Overlapping is allowed since día 3: a drop onto an occupied cell lands, the later element in the
 * document paints on top, and that is what Canva and Word do. David's second condition when he
 * decided it names the exception: «Texto sobre texto avisa […] dos elementos de texto cuyos
 * rectángulos se solapan generan un aviso ahí, no un bloqueo.»
 *
 * **Why text over text and not everything.** A photograph under a heading is a design — the
 * renderer even draws a panel behind the words so they stay legible (`panelArea`) — and an owner who
 * puts one there has done something deliberate and visible. Two *texts* on top of each other are
 * illegible at every width and fail WCAG for a reason no palette can fix: there is no contrast
 * between a sentence and another sentence. So that pair is listed before the download, in the same
 * review the contrast findings use, and **it never blocks**: the owner decides.
 *
 * Pure, and in the schema because it is a statement about the document: the editor's review reads
 * it, and `overlaps` — the same predicate the renderer's panel and the editor's drag both need —
 * lives here so there is one definition of «these two share a cell» in the product.
 */

/** The part of a placement that is geometry: no element id, because overlap is about rectangles. */
export type GridArea = Pick<Placement, "column" | "columnSpan" | "row" | "rowSpan">;

/**
 * Whether two grid areas share any cell.
 *
 * **The whole rectangle on both sides** — column, span, row, span — which is David's own definition
 * from sprint 24, given exactly because a looser one would have made the ordinary move impossible:
 * «Moverlo una columna a la derecha solapa sus propias celdas y no debe rechazarse.» Touching edges
 * do not overlap: an element in units 1..8 and one starting at 9 are neighbours, not a stack.
 */
export function overlaps(a: GridArea, b: GridArea): boolean {
  return (
    a.column < b.column + b.columnSpan &&
    b.column < a.column + a.columnSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

/** One pair of texts sitting on top of each other, with the words of both so the review can say
 * which they are. The owner thinks in sentences, not in element ids. */
export interface OverlappingTexts {
  readonly pageId: string;
  readonly sectionId: string;
  readonly first: { readonly elementId: string; readonly words: string };
  readonly second: { readonly elementId: string; readonly words: string };
}

/**
 * Every pair of text elements whose placements overlap, in document order.
 *
 * **Only a hand-designed section**, because only there does the document hold placements at all: a
 * catalog section's geometry is the preset's, and the catalog does not stack its own texts.
 *
 * **Only elements the page draws.** A hidden element renders as nothing (rule 3 keeps it in the
 * document so the place to fill it in still exists), and warning about an overlap nobody can see
 * would be warning about the document rather than about the site.
 *
 * **Only text over text**, by the value's own kind: a link, a button and an image are not it. A
 * link's words are text, but a link is a thing you press and the one case that matters here is two
 * sentences competing for the same pixels — adding every pressable thing would turn the warning
 * into noise over a layout somebody meant.
 *
 * Deterministic: pages, then sections, then the pairs in content order, so the review reads the
 * same way twice and `INV_5`'s habit of mind holds here too.
 */
export function overlappingTexts(doc: RetorikaDocument): OverlappingTexts[] {
  const found: OverlappingTexts[] = [];

  for (const page of doc.pages) {
    for (const section of page.sections) {
      const layout = section.layout;
      if (!layout) continue;

      const placed = section.content
        .filter((element) => !element.hidden && element.value?.kind === "text")
        .map((element) => ({
          element,
          placement: layout.placements.find((candidate) => candidate.elementId === element.id),
        }))
        .filter(
          (entry): entry is { element: typeof entry.element; placement: Placement } =>
            entry.placement !== undefined,
        );

      for (const [index, mine] of placed.entries()) {
        for (const other of placed.slice(index + 1)) {
          if (!overlaps(mine.placement, other.placement)) continue;
          found.push({
            pageId: page.id,
            sectionId: section.id,
            first: { elementId: mine.element.id, words: wordsOf(mine.element.value) },
            second: { elementId: other.element.id, words: wordsOf(other.element.value) },
          });
        }
      }
    }
  }

  return found;
}

/** The words of a text value. Narrowed rather than cast: the filter above has already decided. */
function wordsOf(value: { kind: string; text?: string } | undefined): string {
  return value?.kind === "text" ? (value.text ?? "") : "";
}
