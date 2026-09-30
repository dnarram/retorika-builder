import type { RetorikaDocument, StyleException } from "@retorika/schema";
import { listStyleExceptions } from "@retorika/schema";
import { AA_NORMAL_TEXT, contrastRatio } from "@retorika/tokens";
import { backgroundOf } from "./textToolbar.ts";

/**
 * The pre-publish contrast review — the advanced dossier §4's «Antes de publicar, una revisión
 * avisa de contraste insuficiente… con arreglo en un clic», cited by `docs/tasks/a11y.md` since
 * sprint 2 and never built.
 *
 * **It is the net the exact colour ships behind** (ADR 0026 §2). `REVIEW.md` refused a free colour
 * picker because «a site built with one is a site that gets published»; what arrives instead is
 * rule 6's marked exception with this in front of it, and the two are one deliverable.
 *
 * **It lives in the editor and not in the renderer, and not by preference.**
 * `scripts/renderer-deps.ts` allows `packages/renderer` exactly two dependencies —
 * `@retorika/schema` and `@retorika/catalog` — so it cannot import `@retorika/tokens`, where the
 * WCAG arithmetic is. And the schema cannot either, because `tokens` depends on *it*. The editor is
 * the one place the two halves can meet, and it is where `downloadGate.ts` already lives.
 *
 * **No new arithmetic.** `contrastRatio` implements WCAG 2.1 and has since sprint 1; this is a
 * consumer, not a second implementation.
 */

/**
 * The level below which nothing is readable enough to publish.
 *
 * 3:1 is WCAG's own threshold for large text — so a colour under it fails even the most forgiving
 * bar the standard offers, at any size. There is nothing to warn about there, only something to fix
 * first, which is the same shape as the dead destination and «demasiadas fotos».
 *
 * Decided by David in the planning of sprint 9, not by direction (ADR 0026 §3).
 */
export const CONTRAST_BLOCKS_BELOW = 3;

/** Above this, silence: it meets AA for normal text. Re-exported from `packages/tokens` rather
 * than written again, so the gate and the palette tests cannot disagree about what AA is. */
export const CONTRAST_WARNS_BELOW = AA_NORMAL_TEXT;

export interface ContrastFinding {
  exception: StyleException;
  /** The measured ratio against the background the renderer actually paints under this element. */
  ratio: number;
  /** `"block"` under 3:1, `"warn"` between 3:1 and 4.5:1. Nothing above is a finding at all. */
  level: "block" | "warn";
}

export interface StyleReview {
  blocking: ContrastFinding[];
  warning: ContrastFinding[];
}

/**
 * Every exact colour in the document that does not clear AA against its own background.
 *
 * **Only `color` exceptions are judged**, and only visible ones:
 *
 * - A `padding` or `borderRadius` exception makes no legibility claim. Judging it would mean
 *   inventing a rule nobody has stated, which is how a gate starts blocking things for reasons its
 *   own author cannot defend.
 * - A **hidden** element publishes nothing — the renderer drops it entirely — so blocking a
 *   download over a colour nobody can see is the mistake `listDeadDestinations` already refuses to
 *   make. `listStyleExceptions` marks them precisely so this reader can skip them while the
 *   `Diseño` panel's audit still shows them.
 *
 * A reference is never judged either, and that is not an omission: every reference the toolbar can
 * write is a pair `packages/tokens` has proved at 4.5:1 in all four palettes. The exception arm is
 * the only way an unproved combination can enter a document at all, which is what makes this review
 * exactly as large as the hazard it exists for.
 */
export function reviewStyle(doc: RetorikaDocument): StyleReview {
  const blocking: ContrastFinding[] = [];
  const warning: ContrastFinding[] = [];

  for (const exception of listStyleExceptions(doc)) {
    if (exception.property !== "color" || exception.hidden) continue;

    const background = doc.theme[backgroundOf(exception.role)];
    const ratio = contrastRatio(exception.exact, background);
    if (ratio >= CONTRAST_WARNS_BELOW) continue;

    const finding: ContrastFinding = {
      exception,
      ratio,
      level: ratio < CONTRAST_BLOCKS_BELOW ? "block" : "warn",
    };
    (finding.level === "block" ? blocking : warning).push(finding);
  }

  return { blocking, warning };
}

/** How the ratio is written for a person: one decimal, with a Spanish comma, never «3.4». */
export function formatRatio(ratio: number): string {
  return ratio.toFixed(1).replace(".", ",");
}
