import { COVER_ID } from "@retorika/catalog";
import { headerDrawn } from "@retorika/renderer";
import type {
  HeaderBackground,
  HeaderPart,
  RetorikaDocument,
  StyleException,
} from "@retorika/schema";
import { listHeaderStyleExceptions, listStyleExceptions } from "@retorika/schema";
import { AA_NORMAL_TEXT, contrastRatio, relativeLuminance } from "@retorika/tokens";
import es from "../locales/es.json" with { type: "json" };
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
  const judge = (exception: StyleException, background: string) => {
    const ratio = contrastRatio(exception.exact, background);
    if (ratio >= CONTRAST_WARNS_BELOW) return;
    const finding: ContrastFinding = {
      exception,
      ratio,
      level: ratio < CONTRAST_BLOCKS_BELOW ? "block" : "warn",
    };
    (finding.level === "block" ? blocking : warning).push(finding);
  };

  for (const exception of listStyleExceptions(doc)) {
    if (exception.property !== "color" || exception.hidden) continue;
    judge(exception, doc.theme[backgroundOf(exception.role)]);
  }

  // **The header's parts, against the bar they sit on** (ADR 0057, sprint 30 día 2). The bar's own
  // `color` is its background and makes no legibility claim by itself; the words — brand, links,
  // button — are judged against it: the exact background the owner wrote, or the scheme's token.
  // A transparent bar sits on the cover's surface. The button's words sit on the button, which is
  // `color.primary` on a surface bar and `color.surface` on a coloured one.
  const headerExceptions = listHeaderStyleExceptions(doc);
  const scheme = doc.header?.look?.background ?? "surface";
  const bar = headerBarBackground(doc);
  const buttonBackground =
    scheme === "surface" || scheme === "transparent"
      ? doc.theme["color.primary"]
      : doc.theme["color.surface"];
  for (const exception of headerExceptions) {
    if (exception.property !== "color" || exception.part === "bar") continue;
    judge(asStyleException(doc, exception), exception.part === "action" ? buttonBackground : bar);
  }

  return { blocking, warning };
}

/** The token each scheme paints the bar with; `transparent` shows the cover's surface through it. */
const HEADER_BACKGROUND_TOKEN: Record<
  HeaderBackground,
  "color.surface" | "color.primary" | "color.secondary" | "color.ink"
> = {
  surface: "color.surface",
  transparent: "color.surface",
  primary: "color.primary",
  secondary: "color.secondary",
  ink: "color.ink",
};

/** The colour the bar is actually painted, as a hex: the exact one the owner wrote, or the scheme's
 * token resolved in this theme. What the brand, the links and the logo are judged against. */
export function headerBarBackground(doc: RetorikaDocument): string {
  const exact = listHeaderStyleExceptions(doc).find(
    (e) => e.part === "bar" && e.property === "color",
  )?.exact;
  return exact ?? doc.theme[HEADER_BACKGROUND_TOKEN[doc.header?.look?.background ?? "surface"]];
}

/**
 * The level below which the logo is said to be hard to see on its bar (ADR 0059, David's
 * adjustment 4 of the sprint 30 plan): **3:1, WCAG 1.4.11's minimum for a graphical object**, and
 * not the 4.5:1 text is held to. A logo is a graphic, not text; and what is measured is the mean
 * luminance of a whole mark, which for a logo of several colours lands in the middle and would
 * fail 4.5 against every bar while reading perfectly well. The same number as
 * `CONTRAST_BLOCKS_BELOW`, deliberately — one floor in this file — but it **warns**, never blocks:
 * a faint logo is taste, not a dead link, and the owner is looking at it in the panel.
 */
export const LOGO_CONTRAST_WARNS_BELOW = 3;

export interface LogoFinding {
  src: string;
  /** The contrast of the logo's mean luminance against the bar it sits on. */
  ratio: number;
  /** The bar's colour, for the dialog's swatch. */
  background: string;
}

/**
 * Whether the logo is hard to see on the bar: its mean luminance (from the bytes, computed by
 * `logoLuminanceOf` in the editor's session — never stored) against the bar's colour, through the
 * WCAG contrast formula over two luminances. `undefined` when there is no logo, when its bytes
 * have not been read, or when it reads well enough.
 */
export function reviewLogo(
  doc: RetorikaDocument,
  luminance: number | null,
): LogoFinding | undefined {
  const src = doc.header?.brand?.logo?.src;
  if (src === undefined || luminance === null) return undefined;
  const background = headerBarBackground(doc);
  const behind = relativeLuminance(background);
  const ratio = (Math.max(luminance, behind) + 0.05) / (Math.min(luminance, behind) + 0.05);
  if (ratio >= LOGO_CONTRAST_WARNS_BELOW) return undefined;
  return { src, ratio, background };
}

/**
 * The pages whose transparent bar lies over a photograph — the one pair the palettes cannot prove
 * (ADR 0057 §look, the sprint 30 plan's `headerOverPhoto`). **A warning, never a block**: the owner
 * chose a bar over their cover on purpose, and whether the words read depends on a photograph no
 * arithmetic here can see. The bar lies over the first section of every page, so every page is
 * asked: a cover with its photograph behind the text and that photograph not hidden. An
 * `image-right` cover puts the photograph beside the words, not under the bar, and says nothing.
 */
export function headerOverPhoto(doc: RetorikaDocument): string[] {
  if (doc.header?.look?.background !== "transparent" || !headerDrawn(doc)) return [];
  return doc.pages
    .filter((page) => {
      const first = page.sections[0];
      return (
        first !== undefined &&
        first.preset.catalogId === COVER_ID &&
        first.preset.variantId === "image-background" &&
        first.content.some((element) => element.role === "image" && !element.hidden)
      );
    })
    .map((page) => page.title);
}

/** How a part is named to a person — «Cabecera · botón» — in the audit and in the review alike. */
export function headerPartName(part: HeaderPart): string {
  return es["editor.header.partOf"].replace("{part}", es[`editor.header.part.${part}`]);
}

/**
 * A header part's exception in the shape the gate's dialog already lists — addressed to `header` as
 * its section and the part as its element, so the dialog can take the owner to the «Menú» panel the
 * way it takes them to a section. A part is a link or a button for the purpose of the sentence.
 */
function asStyleException(
  doc: RetorikaDocument,
  exception: { part: HeaderPart; property: StyleException["property"]; exact: string },
): StyleException {
  return {
    pageId: doc.pages[0]?.id ?? "",
    sectionId: "header",
    elementId: exception.part,
    slot: exception.part,
    role: exception.part === "action" ? "button" : "link",
    property: exception.property,
    exact: exception.exact,
    label: headerPartName(exception.part),
    hidden: false,
  };
}

/** How the ratio is written for a person: one decimal, with a Spanish comma, never «3.4». */
export function formatRatio(ratio: number): string {
  return ratio.toFixed(1).replace(".", ",");
}
