import type { TokenKey } from "@retorika/schema";

export type FontKey = Extract<TokenKey, `font.${string}`>;

/**
 * How a pair keeps its heading apart from its body **when no font file arrives** — which is every
 * site today, and still some sites after ADR 0028's option A ships (a pair that names no downloadable
 * face ships no bytes).
 *
 * This is option C of issue #9, decided pair by pair on 1 October 2026. It exists as a declared field
 * rather than a comment because it is the thing a test can hold still: the three pairs keep their
 * distinctness in three different ways, and each way breaks differently.
 *
 * - **`generic`** — the two stacks end in **different generic keywords**, so a browser with no
 *   matching family at all still renders a serif against a sans. This is the only kind that is
 *   guaranteed on a platform nobody has measured, because `serif` and `sans-serif` always resolve.
 * - **`named`** — both stacks end in the same generic keyword and keep apart by **naming different
 *   faces**. It holds wherever those faces exist and collapses where none of them do, so it is
 *   best-effort by construction and the ADR records which platforms were measured.
 * - **`weightAndSize`** — the pair sets heading and body in **one family on purpose**, and its
 *   contrast is the heading's weight and size. Measured in Chromium: `h1` computes to **700** at
 *   **2.5×** the body's size against the body's **400** (`build.ts` sets no `font-weight`, so the
 *   heading keeps the browser's bold). No absent font can take that away, which makes this the most
 *   robust of the three rather than the weakest.
 */
export type FontContrast = "generic" | "named" | "weightAndSize";

export interface TypePair {
  id: string;
  nameKey: string;
  /** How this pair survives getting no font file. See `FontContrast`. */
  contrast: FontContrast;
  fonts: Record<FontKey, string>;
}

/** The families of a CSS font stack, unquoted and in order. For the tests that hold the three
 * decisions below still, and for the Windows check in `fixtures/font-check.html`. */
export function familiesOf(stack: string): string[] {
  return stack.split(",").map((part) => part.trim().replace(/^['"]|['"]$/g, ""));
}

/**
 * The three pairs, named by character and never by font — the rule the style panel has followed
 * since sprint 4, and the half of option C that was already built.
 *
 * **This is the other half, decided 1 October 2026: what each pair *is* when its letter does not
 * arrive.** Measured first, on macOS with neither Inter nor Playfair Display installed, through the
 * accessibility harness's font report (`CSS.getPlatformFontsForNode`, the platform font rather than
 * the declaration):
 *
 * ```
 *   editorial-serif  heading: Georgia   body: .SF NS     <- still a serif against a sans
 *   modern-sans      heading: .SF NS    body: .SF NS     <- one family, and deliberately
 *   classic-display  heading: Georgia   body: Georgia    <- the whole character gone
 * ```
 *
 * **ADR 0028 read that as "two of the three lose the contrast that makes them a pair at all", and
 * that was too strong.** Heading and body also differ by weight and size, which no missing font
 * touches, so a visitor never sees one undifferentiated block. What the third row loses is not the
 * pairing: it is the **character** the owner chose, which is a different and narrower complaint, and
 * the one worth fixing without any font at all.
 */
export const TYPE_PAIRS: readonly TypePair[] = [
  {
    id: "editorial-serif",
    nameKey: "typography.editorialSerif",
    /**
     * **Unchanged, and it is the only pair that already degraded well.** Its stacks end in different
     * generic keywords, so the serif-against-sans reading survives even on a machine with no named
     * family from either list — which is the strongest guarantee any of the three can have, and the
     * reason this one needs no decision beyond writing down why.
     *
     * `Cambria` is Windows-only (measured absent on macOS, 1 October 2026) and stays: it is a
     * fallback, and a fallback that only some platforms can take is doing its job.
     */
    contrast: "generic",
    fonts: {
      "font.heading": "Georgia, Cambria, 'Times New Roman', Times, serif",
      "font.body": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  },
  {
    id: "modern-sans",
    nameKey: "typography.modernSans",
    /**
     * **Also unchanged, and that is the decision rather than the absence of one.**
     *
     * «Moderna y neutra» is neutral on purpose. A neutral sans system sets heading and body in one
     * family and separates them by weight and size, which is what this does the moment Inter is
     * missing — and what it would still do with Inter present, since the body asks for Inter too via
     * `system-ui` on no platform at all. Forcing a family contrast here was considered and refused:
     * adding `'Helvetica Neue', Arial` after Inter would give macOS a Helvetica heading over an SF
     * body, Windows one family for both, and Linux something else again — **a difference between
     * platforms bought for a design distinction nobody asked for**, and less neutral than the name
     * promises.
     *
     * So the contrast is the 700 weight and the 2.5× size, measured, and the browser test asserts
     * them. If someone ever sets `h1 { font-weight: 400 }` this pair is the one that breaks, and
     * that test is where it will say so.
     */
    contrast: "weightAndSize",
    fonts: {
      "font.heading": "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      "font.body": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  },
  {
    id: "classic-display",
    nameKey: "typography.classicDisplay",
    /**
     * **The one that changes, because it is the one that genuinely lost everything.** Heading and
     * body both resolved to Georgia, so «Clásica y seria» rendered as one serif at two sizes and the
     * display letterform the owner picked was simply absent.
     *
     * The heading now names faces that stand in for Playfair's didone character where they exist, and
     * the body names a text serif that is **not** the heading's next fallback. Chosen from what is
     * actually installed, measured on this machine on 1 October 2026 rather than assumed — `Bodoni
     * MT`, `Palatino Linotype`, `Book Antiqua`, `Constantia` and `Garamond` all came back absent on
     * macOS and are kept only as Windows fallbacks:
     *
     * ```
     *   present on macOS : Didot, Big Caslon, Baskerville, Hoefler Text, Palatino, Charter,
     *                      Iowan Old Style, Georgia, Times New Roman
     *   absent on macOS  : Playfair Display, Bodoni MT, Palatino Linotype, Book Antiqua,
     *                      Constantia, Cambria, Garamond
     * ```
     *
     * So on macOS the heading lands on **Didot** and the body on **Charter** — a didone over a text
     * serif, which is the shape of the pair the name promises. Windows is **not measured here** and is
     * the platform most of a neighbourhood site's visitors use; `fixtures/font-check.html` is the
     * procedure for checking it by hand, and ADR 0028 carries the result.
     *
     * **This kind is `named`, so it is best-effort and says so.** Both stacks end in `serif`, so on a
     * platform that has none of the named faces the two collapse together again. That is the floor
     * option A exists to lift, and pretending a stack can guarantee it would be the dishonest half of
     * option C.
     */
    contrast: "named",
    fonts: {
      "font.heading":
        "'Playfair Display', Didot, 'Bodoni MT', 'Big Caslon', Georgia, 'Times New Roman', serif",
      "font.body":
        "Charter, 'Iowan Old Style', Palatino, 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', Times, serif",
    },
  },
];
