import { FONT_GALLERY, type FontKind, GENERIC_OF, type TokenKey } from "@retorika/schema";

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
     * **The heading face is EB Garamond since 18 October 2026** (sprint 24 día 4, ADR 0045), where it
     * was Playfair Display. A licence matter rather than a change of taste: Playfair Display is
     * published «with Reserved Font Name "Playfair Display"» and what we ship is a latin slice in
     * woff2, which OFL 1.1 calls a Modified Version twice over. EB Garamond reserves no name. Both
     * are shipped faces, so the owner gets the letter they chose either way; what changed is which
     * classical serif it is, and the pair's name never promised a particular one.
     *
     * The heading names faces of the heading's own character where they exist, and the body names a
     * text serif that is **not** the heading's next fallback. Chosen from what is actually installed,
     * measured on this machine on 1 October 2026 rather than assumed — `Bodoni MT`, `Palatino
     * Linotype`, `Book Antiqua`, `Constantia` and `Garamond` all came back absent on macOS and are
     * kept only as Windows fallbacks:
     *
     * ```
     *   present on macOS : Didot, Big Caslon, Baskerville, Hoefler Text, Palatino, Charter,
     *                      Iowan Old Style, Georgia, Times New Roman
     *   absent on macOS  : Playfair Display, Bodoni MT, Palatino Linotype, Book Antiqua,
     *                      Constantia, Cambria, Garamond
     * ```
     *
     * So with the face shipped the heading lands on **EB Garamond** everywhere, and the body on
     * **Charter** on macOS — a Garamond over a transitional text serif, which is the shape of the
     * pair the name promises. **Without** our file the heading would fall to `Garamond` (absent on
     * macOS) and then `Baskerville`, which that same measurement found present and which is the same
     * family of letterform: the fallback chain degrades in character rather than collapsing onto the
     * body's serif. Windows is **not measured here** and is the platform most of a neighbourhood
     * site's visitors use; `fixtures/font-check.html` is the procedure for checking it by hand, and
     * ADR 0028 carries the result.
     *
     * **This kind is `named`, so it is best-effort and says so.** Both stacks end in `serif`, so on a
     * platform that has none of the named faces the two collapse together again. That is the floor
     * option A exists to lift, and pretending a stack can guarantee it would be the dishonest half of
     * option C.
     */
    contrast: "named",
    fonts: {
      "font.heading":
        "'EB Garamond', Garamond, Baskerville, 'Big Caslon', Georgia, 'Times New Roman', serif",
      "font.body":
        "Charter, 'Iowan Old Style', Palatino, 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', Times, serif",
    },
  },
];

/**
 * A family the owner may choose **by its real name**, because this product ships its faces
 * (ADR 0046).
 *
 * The rule the Estilo panel has followed since sprint 4 is that letters are named by character and
 * never by font, and the reason was never taste: a stack is a list of wishes, so a label reading
 * «Inter» promised a face that might never arrive. ADR 0028 removed that reason for the faces we
 * send, and ADR 0046 turns the removal into eight of them. **Sending the face is what makes naming
 * it honest**, and the three pairs above stay exactly where they are, first, for the owner who wants
 * one click and no questions.
 */
export interface GalleryFamily {
  /**
   * The family's name, spelled **exactly** as `SHIPPABLE_FAMILIES` spells it in the renderer, which
   * is what makes the face travel: that table ships a face only when a stack's first family matches
   * a row by exact equality. `packages/renderer/test/fonts.test.ts` holds the two level.
   */
  family: string;
  /**
   * Which species it is, and it earns its place in the data rather than in a comment: the stack has
   * to end in the generic keyword `GENERIC_OF` gives it, so that a visitor whose browser fetched no
   * face at all still gets a serif where a serif was chosen. Asserted over every row.
   */
  kind: FontKind;
  /**
   * The stack a theme carries when this family is chosen — the family first, then the fallbacks.
   *
   * **Where a pair above already names this family first, the stack here is that pair's own,
   * verbatim.** Otherwise choosing from the gallery the very family a document already has would
   * rewrite the token to an equivalent-but-different string, and the pair's tick in the panel would
   * vanish for a choice that changed nothing a visitor can see. Asserted, so the two cannot part.
   */
  stack: string;
}

/** Everything after the chosen family, by the generic keyword its species falls back to. Two chains
 * and not one per family: with the face shipped for every row, these run only when the file did not
 * arrive, so what they owe is the species and not a character. The sans chain is `modern-sans`'s own
 * body stack and the serif one `editorial-serif`'s own heading stack, minus its first family. */
const FALLBACK: Readonly<Record<"sans-serif" | "serif", string>> = {
  "sans-serif": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
};

/**
 * **Where a pair already names a family first, the gallery's stack is that pair's own, verbatim** —
 * see `GalleryFamily.stack`. Two families, and a test holds them to the pairs.
 */
const VERBATIM_STACKS: Readonly<Record<string, string>> = {
  // `classic-display`'s heading stack.
  "EB Garamond":
    "'EB Garamond', Garamond, Baskerville, 'Big Caslon', Georgia, 'Times New Roman', serif",
  // `modern-sans`'s heading stack.
  Inter: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

/** A family as a stack names it: quoted when it has a space, bare when it is one word, which is how
 * every stack written by hand here has spelled them since sprint 4. */
const named = (family: string) => (family.includes(" ") ? `'${family}'` : family);

/**
 * The gallery, **derived from `FONT_GALLERY`** in `@retorika/schema` (ADR 0055), and so alphabetical:
 * the order the owner reads and the order the renderer's own table is in. Until sprint 29 this was one
 * of four parallel copies of the names; now the stack is the only thing this package adds — the
 * family, then its species' fallback, or a pair's own stack where a pair names it.
 */
export const GALLERY_FAMILIES: readonly GalleryFamily[] = FONT_GALLERY.map(({ family, kind }) => ({
  family,
  kind,
  stack: VERBATIM_STACKS[family] ?? `${named(family)}, ${FALLBACK[GENERIC_OF[kind]]}`,
}));
