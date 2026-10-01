import { COVER_ID, FOOTER_ID, presetFor, TEASER_ID } from "@retorika/catalog";
import {
  type ContentElement,
  GRID_COLUMNS,
  mobileSequence,
  type Page,
  type Placement,
  type RetorikaDocument,
  type Section,
  SORTED_TOKEN_KEYS,
  STYLE_PROPERTIES,
  type StyleProperty,
  tokenToCssVariable,
} from "@retorika/schema";
import { cssAttributeValue, cssThemeValue, safeUrl } from "./escape.ts";
import { menuNodes } from "./menu.ts";
import { commentNode, element, type RenderNode } from "./nodes.ts";
import type { ResolvedRenderOptions } from "./options.ts";
import { textElement } from "./runs.ts";

/**
 * Document -> node tree. Layout, grid and tokens live here and nowhere else (Part 3.2).
 *
 * Deterministic by construction: no clock, no randomness, and every collection is walked
 * in a fixed order. INV_5 and the golden files rest on that, and so does the ability to
 * tell a real change from noise when reviewing a golden diff.
 */

type GridArea = Pick<Placement, "column" | "columnSpan" | "row" | "rowSpan">;

function placementStyle(placement: GridArea): string {
  return [
    `grid-column:${placement.column}/span ${placement.columnSpan}`,
    `grid-row:${placement.row}/span ${placement.rowSpan}`,
  ].join(";");
}

/**
 * A heading tag for a level, or an explicit error: past h6 there is no tag, and quietly
 * clamping would publish an outline that lies about the page's structure.
 */
function headingTag(level: number): string {
  if (level < 1 || level > 6) throw new Error(`No heading tag for level ${level}`);
  return `h${level}`;
}

/**
 * A list, drawn the same way for every section that has one: a semantic <ul> whose items
 * are <li>, each item's elements rendered one heading level below the section's.
 *
 * role="list" because WebKit drops list semantics from a <ul> with list-style: none, and
 * VoiceOver users would lose "list, 4 items". An item with nothing visible is not emitted,
 * and neither is a list with no item left: an empty <li> or <ul> would be published.
 */
function listNode(
  el: ContentElement,
  options: ResolvedRenderOptions,
  level: number,
  base: Record<string, string>,
): RenderNode | undefined {
  const items: RenderNode[] = [];
  for (const item of el.items ?? []) {
    const children = item.elements
      .map((child) => elementNode(child, options, level + 1))
      .filter((node) => node !== undefined);
    if (children.length === 0) continue;
    items.push(element("li", { class: "rb-item", "data-item": item.id }, children));
  }
  if (items.length === 0) return undefined;
  return element("ul", { ...base, class: "rb-list", role: "list" }, items);
}

/**
 * `level` is the heading level of the section the element sits in: a `heading` is h{level}
 * and a `subheading` h{level + 1}. Headings are levelled by section, not by role, so a page
 * reads h1 (the cover), h2 (each other section), h3 (the cards inside a section's list).
 */
function elementNode(
  el: ContentElement,
  options: ResolvedRenderOptions,
  level: number,
): RenderNode | undefined {
  if (el.hidden) return undefined;

  // data-id, alongside the section's own data-section and a list item's data-item: the
  // same document id, carried into both targets, is what lets the editor address exactly
  // this element later (day 6's click-to-edit) without inventing a second identity scheme.
  const base = { "data-id": el.id, "data-role": el.role, "data-slot": el.slot };

  // A list holds items rather than a value, so it is handled before the value check.
  if (el.role === "list") return listNode(el, options, level, base);

  const value = el.value;
  if (!value) return undefined;

  switch (value.kind) {
    case "text":
      // Nothing to say is drawn as nothing, not as an empty tag. A text element whose value is
      // blank used to publish `<h2></h2>` or `<p></p>` into the client's ZIP — invisible, but a
      // real node that still takes the flex gap between its siblings, and exactly the thing
      // `blank.ts` refuses to create when it says a required slot "cannot be filled with an empty
      // string". The editor is where they come from: click-to-edit commits whatever is in the
      // field on blur, and deleting a sentence commits "".
      //
      // This is also what makes an optional slot genuinely optional once it exists. A price on a
      // carta line is 0..1 and gets created with a marker, because there is no other way to reach
      // it; a line that has no price is one whose price the owner emptied, and it has to leave no
      // trace. Hiding stays the document-level answer (rule 3) — this is the render-level one,
      // and neither removes anything.
      if (value.text.trim() === "") return undefined;
      switch (el.role) {
        case "heading":
          return textElement(headingTag(level), base, value.text, value.marks);
        case "subheading":
          // A paragraph, not a heading (#19). A subheadline is a tagline — "Reserva en treinta
          // segundos" — and it heads nothing: marked up as h{level+1} it appears in a screen
          // reader's heading list and rotor as if a section of the page started there, so the
          // outline claims more sections than the page has (WCAG 1.3.1). The role in the document
          // is unchanged and so is the look; only the tag the renderer picks for it changes.
          return textElement("p", { ...base, class: "rb-subtitle" }, value.text, value.marks);
        default:
          return textElement("p", base, value.text, value.marks);
      }

    case "image":
      return element("img", { ...base, src: safeUrl(value.src), alt: value.alt });

    case "link":
      return textElement(
        "a",
        { ...base, href: safeUrl(value.href), ...(el.role === "button" ? { role: "button" } : {}) },
        value.text,
        // ADR 0027 §6: the schema allows marks on a link's text, so the renderer splits it the same
        // way as any other. **One path through the code that escapes a string in pieces** is the
        // reason, and it is worth the unused capability — the editor does not draw `B` and `I` here.
        value.marks,
      );

    case "map": {
      // ADR 0004: a map publishes as a static image plus a link to the maps application.
      // An interactive map would need JavaScript, which counts against the budget.
      const href = `https://www.openstreetmap.org/?mlat=${value.latitude}&mlon=${value.longitude}`;
      return element("a", { ...base, href }, [value.label]);
    }

    case "field":
      return element("label", base, [
        value.label,
        element("input", { name: value.name, type: "text" }),
      ]);

    case "embed":
      // Off by default. The payload is the one thing on a published page we cannot
      // escape, so it never reaches the output unless a caller has explicitly opted in,
      // and enabling that needs its own ADR.
      if (!options.allowEmbeds) {
        return commentNode(`retorika:embed withheld (${value.label})`);
      }
      return element("div", { ...base, "data-embed": "true" }, [value.payload]);
  }
}

/** Half-open intervals: an area ending where another starts does not touch it. */
function intersects(a: GridArea, b: GridArea): boolean {
  return (
    a.column < b.column + b.columnSpan &&
    b.column < a.column + a.columnSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

/**
 * The area of the panel behind text that overlaps an image, or undefined if there is none.
 *
 * Text drawn over a photo has no contrast anyone can guarantee or measure (PR #6, finding 2).
 * So wherever a visible element sits on a visible image, a panel of color.surface — the one
 * background every palette guarantees its text colours against — goes under the text and
 * over the photo, covering the bounding box of the overlapping elements.
 *
 * Placement-driven rather than tied to a variant name: a free section with text placed on a
 * picture needs the same thing. The panel is render-only — no role, no slot, never in the
 * document — and an empty sibling rather than a wrapper, so every document element keeps the
 * grid area it was given (document rules 1 and 4).
 */
function panelArea(
  emitted: readonly { el: ContentElement; placement: Placement | undefined }[],
): GridArea | undefined {
  const placed = emitted.filter(
    (entry): entry is { el: ContentElement; placement: Placement } => entry.placement !== undefined,
  );
  const images = placed.filter(({ el }) => el.value?.kind === "image");
  const over = placed.filter(
    ({ el, placement }) =>
      el.value?.kind !== "image" && images.some((image) => intersects(placement, image.placement)),
  );
  if (over.length === 0) return undefined;

  const column = Math.min(...over.map(({ placement }) => placement.column));
  const row = Math.min(...over.map(({ placement }) => placement.row));
  const columnEnd = Math.max(
    ...over.map(({ placement }) => placement.column + placement.columnSpan),
  );
  const rowEnd = Math.max(...over.map(({ placement }) => placement.row + placement.rowSpan));
  return { column, columnSpan: columnEnd - column, row, rowSpan: rowEnd - row };
}

/**
 * What an «Avance» shows, read from the page it points at rather than stored in the document.
 *
 * The dossier §6 asks for «un resumen con un enlace», and the decision behind this function is
 * that the summary is never written down: the teaser holds a link and nothing else, and the title
 * and the line under it are read from the destination every time the page is drawn. A teaser that
 * copied the words would be two copies of one text with nothing to keep them together, drifting
 * apart the first time the owner edited the page it came from.
 *
 * The line is the first visible body or tagline text **at the top level of the destination's first
 * section** — deliberately not `flattenElements`, which would reach inside a list and could offer a
 * carta line's price as the summary of a page. A section whose introduction the owner deleted
 * simply has no line, and the teaser then shows a title and a link, which is honest.
 *
 * `undefined` when the destination does not exist. The renderer does not throw here, against its
 * usual rule, and the reason is that the alternative is worse in the one place it would happen:
 * deleting a page would blank the whole editor preview rather than show one broken teaser. The
 * link is then simply dead, `listDeadDestinations` catches it, and the download is refused — which
 * is the rule that already governs every other button pointing nowhere.
 */
interface TeaserTarget {
  title: string;
  line: string | undefined;
}

const TEASER_LINE_ROLES: ReadonlySet<string> = new Set(["body", "subheading"]);

function teaserTarget(doc: RetorikaDocument, href: string): TeaserTarget | undefined {
  const match = /^\.\/([^#]+)\.html(?:#.*)?$/.exec(href.trim());
  if (!match) return undefined;
  const page = doc.pages.find((candidate) => candidate.slug === match[1]);
  if (!page) return undefined;

  const first = page.sections[0];
  const line = first?.content.find(
    (el) =>
      !el.hidden &&
      TEASER_LINE_ROLES.has(el.role) &&
      el.value?.kind === "text" &&
      el.value.text.trim() !== "",
  );
  return {
    title: page.title,
    line: line?.value?.kind === "text" ? line.value.text : undefined,
  };
}

/** The same inline grid style every placed element gets, for the two nodes a teaser derives. */
function derivedArea(row: number): string {
  return placementStyle({ column: 1, columnSpan: 12, row, rowSpan: 1 });
}

/** A teaser's destination: the href of its one visible link, or "" if it has none to read. */
function hrefOf(section: Section): string {
  const link = section.content.find((el) => !el.hidden && el.value?.kind === "link");
  return link?.value?.kind === "link" ? link.value.href : "";
}

function sectionNode(
  section: Section,
  options: ResolvedRenderOptions,
  isH1: boolean,
  target?: TeaserTarget,
): RenderNode {
  const preset = presetFor(section.preset.catalogId);
  const elements = section.content;

  // A free section brings its own layout; a catalog section borrows the preset's.
  // Rule 1 in practice: either way the layout only names element ids.
  const layout = section.layout ?? preset.layoutFor(section.preset.variantId, elements);
  const placementById = new Map(layout.placements.map((p) => [p.elementId, p]));

  // The page's <h1> is the cover when there is one, and the page's first section when there is
  // not (sprint 5): a converted page carries no cover — the cover is one of the three sections
  // ADR 0022 refuses to convert — and would otherwise publish with no h1 at all, which axe marks.
  // `isH1` is resolved once per page in `buildTree`, not per section, because "is there a cover
  // on this page" is a fact about the page and not about any one section in it.
  const level = isH1 ? 1 : 2;

  const emitted: { el: ContentElement; node: RenderNode; placement: Placement | undefined }[] = [];
  for (const el of elements) {
    const node = elementNode(el, options, level);
    if (!node) continue;

    // **The accessible name of a teaser's link**, and the one thing on it that is not the owner's
    // words. Three teasers on a home page all read «Ver más» — which is correct, because a Spanish
    // template with a heading dropped into it breaks on gender («Ver Nuestra carta completo») — but
    // a screen reader's list of links would then be three identical entries going to three
    // different places, which is WCAG 2.4.4. The colon sidesteps agreement entirely: there is no
    // sentence left to agree with.
    //
    // `aria-label` rather than the visually-hidden `<span>` the sprint plan named, and the reason
    // is the editor rather than the page: click-to-edit makes this `<a>` `contentEditable` and
    // commits `el.textContent` on blur, so a hidden child would be swallowed into the stored label
    // on the very first click — and then re-suffixed on the next render, compounding. It also
    // needs no new CSS, which is what keeps the golden corpus still today. WCAG 2.5.3 is satisfied
    // because the accessible name still begins with the visible words.
    if (target && el.role === "link" && el.value?.kind === "link") {
      node.attributes["aria-label"] = `${el.value.text}: ${target.title}`;
    }

    const placement = placementById.get(el.id);
    if (placement) node.attributes["style"] = placementStyle(placement);
    emitted.push({ el, node, placement });
  }

  // The two nodes an «Avance» derives from the page it points at, ahead of the link the document
  // does hold. No class and no new stylesheet rule: an h{level} and a p inside `.rb-section` are
  // already drawn, and adding a rule would move all eleven golden files on a day whose whole point
  // is that nothing published changes.
  const derived: RenderNode[] = target
    ? [
        element(headingTag(level), { style: derivedArea(1) }, [target.title]),
        ...(target.line ? [element("p", { style: derivedArea(2) }, [target.line])] : []),
      ]
    : [];

  const panel = panelArea(emitted);
  const children: RenderNode[] = [
    ...(panel
      ? [
          element(
            "div",
            { "aria-hidden": "true", class: "rb-panel", style: placementStyle(panel) },
            [],
          ),
        ]
      : []),
    ...derived,
    ...emitted.map(({ node }) => node),
  ];

  // `<footer>` for the footer, `<section>` for everything else. The same shape of correction
  // issue #19 made for the cover's tagline: markup that says what the thing is rather than what
  // the renderer happens to emit for everything. The class stays `.rb-section`, so every rule
  // and every `[data-section]` query is untouched.
  //
  // It is not the page's `contentinfo` landmark, and that is worth saying plainly: a `<footer>`
  // only becomes one as a direct child of `<body>`, and this sits inside `<main>` like every
  // other section. Moving it out is a change to how a page is assembled rather than to how a
  // section is drawn, and it has not been made.
  return element(
    section.preset.catalogId === FOOTER_ID ? "footer" : "section",
    {
      // The anchor, and deliberately the section's own id rather than a slug of its Spanish
      // name: a slug would have to come from the catalog's locale, and this package may not
      // import the catalog (`pnpm renderer:deps` allows two dependencies, and everything in
      // here travels to the client's site). The section id is already unique document-wide and
      // already deterministic, which is what the golden corpus needs.
      id: section.id,
      "data-section": section.id,
      "data-preset": section.preset.catalogId,
      "data-variant": section.preset.variantId,
      class: `rb-section rb-${section.preset.catalogId} rb-${section.preset.variantId}`,
    },
    children,
  );
}

/**
 * The page a render call is drawing: the one named by `options.pageId`, or the document's first
 * when it names none. Shared with `index.ts`, which needs the same page to pick its `<title>`.
 */
export function resolvePage(doc: RetorikaDocument, pageId: string | undefined): Page {
  if (pageId === undefined) {
    const first = doc.pages[0];
    if (!first) throw new Error("Document has no pages");
    return first;
  }
  const page = doc.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`render: no page "${pageId}"`);
  return page;
}

export function buildTree(doc: RetorikaDocument, options: ResolvedRenderOptions): RenderNode[] {
  const page = resolvePage(doc, options.pageId);

  // Which section(s) get the h1. Unchanged for a page that has a cover: every section built on
  // the cover preset is h1, exactly as before — including a free section on that preset, which
  // `hidden-and-embed` in the golden corpus tests deliberately (see the comment in `sectionNode`).
  // New for sprint 5: a page with *no* cover section at all — a converted page, since ADR 0022
  // forbids converting the cover — used to publish with no h1, which axe marks. Its first section
  // is promoted instead.
  const hasCover = page.sections.some((section) => section.preset.catalogId === COVER_ID);
  // A teaser is skipped when choosing the fallback: its heading is borrowed from another page, and
  // promoting it to h1 would make this page claim to be about somewhere else. The first section
  // that is not a teaser takes it instead — falling back to the very first section for a page that
  // is nothing but teasers, because one borrowed h1 still beats the none that axe marks.
  const fallbackH1Id = hasCover
    ? undefined
    : (page.sections.find((section) => section.preset.catalogId !== TEASER_ID)?.id ??
      page.sections[0]?.id);

  // The footer, drawn on every page from the home page's own (ADR 0023). A converted page with no
  // footer looks unfinished, and repeating it is not duplicating it: there is still exactly one
  // footer in the document, belonging to one page, as rule 5 requires. Derived like the menu, so it
  // is never something the owner has to remember to add to a page they just made.
  const hasFooter = page.sections.some((section) => section.preset.catalogId === FOOTER_ID);
  const borrowedFooter = hasFooter
    ? []
    : (doc.pages[0]?.sections.filter((section) => section.preset.catalogId === FOOTER_ID) ?? []);

  return [
    // Before `<main>`, so a keyboard or screen-reader user reaches the navigation first, which is
    // where every page's structure is announced.
    ...menuNodes(doc, page),
    element("main", { class: "rb-page", "data-page": page.id }, [
      ...page.sections.map((section) =>
        sectionNode(
          section,
          options,
          section.preset.catalogId === COVER_ID || section.id === fallbackH1Id,
          section.preset.catalogId === TEASER_ID ? teaserTarget(doc, hrefOf(section)) : undefined,
        ),
      ),
      ...borrowedFooter.map((section) => sectionNode(section, options, false)),
    ]),
  ];
}

/**
 * The theme as CSS custom properties, in a fixed alphabetical order.
 *
 * The order is what makes the output byte-identical across runs, which is what INV_5
 * and the golden tests check. It also means a golden diff shows real changes rather
 * than reshuffled lines.
 */
/**
 * Document rule 7, finally honoured: the per-element mobile patches, as CSS.
 *
 * The rule has been in `docs/document-rules.md` since phase 0 and this is the renderer's first
 * reading of `layout.breakpoints`. The proof it was never read is in the corpus: `physio-free-cover`
 * asks for its photograph at `order: 2` and its headline at `order: 1`, and the golden file has
 * published `img { order: -1 }` — the exact opposite — with every test green.
 *
 * **The shared `@media` block above is not touched, and that is a condition rather than a
 * preference.** That block is the mobile layout of *every* site this product has ever published,
 * including those of owners who will never turn the design tools on. Loosening it so a patch could
 * win would charge all of them for a feature one person uses. So the patches win where they exist
 * and nowhere else, by specificity:
 *
 * | | shared rule | patch rule | why the patch wins |
 * |---|---|---|---|
 * | order | `.rb-section > img` — (0,1,1) | `[data-section=…] [data-id=…]` — (0,2,0) | two attributes outrank one class and one type |
 * | hidden | nothing sets `display` | same | nothing to beat |
 * | width | nothing sets `width` on a child | same | nothing to beat |
 *
 * **No `!important` anywhere here**, which is worth stating because the obvious way to beat
 * `grid-column: 1 / -1 !important` would have been to match it. That was not needed: width on mobile
 * is not a grid span (see below), so the one declaration carrying `!important` is never contested.
 */
function breakpointCss(doc: RetorikaDocument): string[] {
  const rules: string[] = [];

  for (const page of doc.pages) {
    for (const section of page.sections) {
      const breakpoints = section.layout?.breakpoints;
      if (!breakpoints) continue;

      // A tablet patch is a valid document and this renderer has nowhere to put it: no stylesheet,
      // mockup or ADR names a tablet width. Emitting nothing would publish a page that quietly
      // disobeys the document, which is the failure an explicit error exists to prevent — the same
      // reason an unknown section throws rather than rendering an empty box.
      if ((breakpoints.tablet?.length ?? 0) > 0) {
        throw new Error(
          `buildCss: section "${section.id}" carries tablet breakpoint patches, and no tablet ` +
            "width is defined. Only mobile patches can be published today.",
        );
      }

      const mobile = breakpoints.mobile ?? [];
      if (mobile.length === 0) continue;

      /**
       * Every element's position, not only the patched ones — and this is the correction a real
       * browser had to make to a rule that looked right on paper.
       *
       * Emitting `order` only where a patch named one was measured at 390px and put the **body
       * first**: it carries no patch, so it kept CSS's default `order: 0`, which is ahead of a
       * headline patched to `1`. The document said "headline first" and the page said "body first".
       *
       * So the numbers in a patch are **positions among the section's elements**, and an element
       * nobody numbered keeps the place the document already gives it — its own position in content
       * order, one-based. Two elements can land on the same number, which CSS settles by document
       * order; that is deterministic, and `INV_5` still holds.
       *
       * This is still a patch over the automatic derivation and not a parallel layout (rule 7): the
       * derivation decides everything about mobile except these three adjustments, and one of the
       * three is where a thing sits in the sequence.
       */
      // `mobileSequence` is the rule, and it lives in `packages/schema` so the editor's «Subir»
      // and this emission cannot drift apart. Two implementations of one rule is how the design
      // panel and the canvas came to disagree about the selected element on day 3.
      for (const slot of mobileSequence(section)) {
        if (slot.patched) continue;
        rules.push(
          `  [data-section="${cssAttributeValue(section.id)}"] ` +
            `[data-id="${cssAttributeValue(slot.elementId)}"] { order: ${slot.order}; }`,
        );
      }

      for (const patch of mobile) {
        const declarations: string[] = [];

        // Rule 7's first adjustment: «Ocultar aquí». Nothing in the shared block sets `display` on a
        // section's child, so there is nothing to outrank.
        if (patch.hidden === true) declarations.push("display: none");

        // The second: «Subir». This is the one the shared block contests, with `img { order: -1 }`.
        if (patch.order !== undefined) declarations.push(`order: ${patch.order}`);

        // The third: «Foto menor» — and **a width, not a grid span**. On mobile the section is one
        // column wide (`grid-template-columns: 1fr`), so `grid-column: span 6` would not narrow
        // anything: it would ask for six columns that do not exist and the grid would invent them,
        // pushing the page sideways. A span of the *document's* twelve read as a fraction is what
        // the adjustment means on a one-column page, and it is what the control in mockup 14 says
        // it does.
        //
        // A span of twelve is the derivation's own width, so it emits nothing at all: rule 7 says
        // mobile is a patch, and a patch that changes nothing should not be published. That is why
        // `physio-free-cover`'s `columnSpan: 12` on its photograph produces no declaration.
        if (patch.columnSpan !== undefined && patch.columnSpan < GRID_COLUMNS) {
          const percent = Math.round((patch.columnSpan / GRID_COLUMNS) * 1e4) / 100;
          declarations.push(`width: ${percent}%`);
        }

        if (declarations.length === 0) continue;
        rules.push(
          `  [data-section="${cssAttributeValue(section.id)}"] ` +
            `[data-id="${cssAttributeValue(patch.elementId)}"] { ${declarations.join("; ")}; }`,
        );
      }
    }
  }

  // Its own `@media` block, after the shared one. Source order is a tiebreaker this does not need —
  // the selectors already win — but placing it second means a future rule of equal specificity
  // behaves the way somebody reading the file would expect.
  return rules.length === 0 ? [] : ["@media (max-width: 720px) {", ...rules, "}", ""];
}

/** The CSS property each of rule 6's four properties writes. Written out rather than derived by
 * camel-to-kebab, so adding a fifth is a decision somebody makes here rather than a transformation
 * that happens to produce something. */
const CSS_PROPERTY: Record<StyleProperty, string> = {
  color: "color",
  fontSize: "font-size",
  padding: "padding",
  borderRadius: "border-radius",
};

/**
 * Document rule 6, finally emitted: an element's own style.
 *
 * `ContentElement.style` has been in the schema since phase 0 and **this is the first code that
 * reads it**. Sprint 9 day 2 closed its vocabulary; this is the half that reaches a published page,
 * and it is the obligation `docs/tasks/theme-css-values.md` left by name for «the task that starts
 * emitting them».
 *
 * **A reference becomes `var(--token)`, and that is not an implementation detail — it is what makes
 * rule 6 true.** «Cambiar la paleta sigue funcionando en toda la web, incluidas las secciones
 * diseñadas a mano»: the custom property does that work, so an element that references
 * `color.primary` follows the palette forever. An exact value is emitted literally and does not,
 * which is precisely what «excepción» means.
 *
 * **A rule block in the stylesheet, never an inline `style` attribute**, for three reasons that are
 * all visible in this file:
 *
 * - The `grid-column: 1 / -1 !important` in the shared mobile block exists *because*
 *   `placementStyle` writes the grid inline. Inline style beats every selector, so each future
 *   override would have to answer with another `!important`, and `breakpointCss` earned the right
 *   to say it carries none.
 * - `attributesToString` sorts attributes, so a new `style` attribute rewrites the middle of an
 *   existing golden line. A rule block adds contiguous lines at the end. One diff is read, the
 *   other is skimmed.
 * - `build.ts:303` is then not touched at all, and the placement path stays exactly as the golden
 *   corpus recorded it.
 *
 * **The selector carries three attributes, and the third is load-bearing.**
 * `[data-section=…] [data-id=…][data-role]` is (0,3,0). With two it would be (0,2,0), and this
 * stylesheet has rules at **(0,2,1)** — `.rb-section p.rb-subtitle` and
 * `.rb-section a:not([role=button])`, where `:not()` takes its argument's specificity. A colour set
 * on the cover's tagline or on any plain link would have lost to them and **done nothing, in
 * silence**. `data-role` is already emitted on every element (`elementNode`), so the third
 * attribute costs nothing and lifts the rule above everything in the file without one `!important`.
 */
function elementStyleCss(doc: RetorikaDocument): string[] {
  const rules: string[] = [];

  const walk = (sectionId: string, elements: readonly ContentElement[]): void => {
    for (const el of elements) {
      // A hidden element is not rendered at all, so a rule for it would match nothing and only
      // weigh the page down — the same reason `listDeadDestinations` ignores one.
      if (!el.hidden && el.style) {
        const declarations: string[] = [];
        for (const property of STYLE_PROPERTIES) {
          const value = el.style[property];
          if (value === undefined) continue;
          const css =
            "ref" in value
              ? `var(${tokenToCssVariable(value.ref)})`
              : // The boundary check `theme-css-values.md` reserved for this day. Since day 2 the
                // schema admits only a hex triple or a plain length, so it can no longer fire for a
                // document that parsed — which is the right relationship between a gate and a
                // guard, not a reason to drop the guard.
                cssThemeValue(`${el.id}.${property}`, value.exact);
          declarations.push(`${CSS_PROPERTY[property]}: ${css}`);
        }
        if (declarations.length > 0) {
          rules.push(
            `  [data-section="${cssAttributeValue(sectionId)}"] ` +
              `[data-id="${cssAttributeValue(el.id)}"][data-role] { ${declarations.join("; ")}; }`,
          );
        }
      }
      for (const item of el.items ?? []) walk(sectionId, item.elements);
    }
  };

  for (const page of doc.pages) {
    for (const section of page.sections) walk(section.id, section.content);
  }

  return rules.length === 0 ? [] : ["/* rule 6: an element's own style */", ...rules, ""];
}

export function buildCss(doc: RetorikaDocument): string {
  const variables = SORTED_TOKEN_KEYS.map(
    (key) => `  ${tokenToCssVariable(key)}: ${cssThemeValue(key, doc.theme[key])};`,
  ).join("\n");

  return [
    ":root {",
    variables,
    "}",
    "",
    "* { box-sizing: border-box; }",
    "body { margin: 0; font-family: var(--font-body); color: var(--color-ink);",
    "  background: var(--color-surface); }",
    ".rb-section { display: grid; grid-template-columns: repeat(12, 1fr);",
    "  gap: var(--space-md); padding: var(--space-xl); align-items: center; }",
    ".rb-section img { width: 100%; height: auto; border-radius: var(--radius-md); }",
    // No text overflows its own box. A word longer than its column ("Electrodomésticos" in a
    // narrow title column) used to run past it into the next element. overflow-wrap:
    // break-word is the guarantee: it acts only when a word cannot fit, and needs no
    // dictionary. hyphens: auto on headings adds a hyphen where the browser has a Spanish
    // dictionary (the page declares lang="es"); -webkit- because Safari needs the prefix.
    ".rb-section :is(h1, h2, h3, h4, h5, h6, p, a) { overflow-wrap: break-word; }",
    ".rb-section :is(h1, h2, h3, h4, h5, h6, p.rb-subtitle) { -webkit-hyphens: auto;",
    "  hyphens: auto; }",
    ".rb-section h1 { font-family: var(--font-heading); font-size: var(--size-heading);",
    "  color: var(--color-primary); margin: 0; }",
    ".rb-section h2 { font-family: var(--font-heading); font-size: var(--size-subheading);",
    "  color: var(--color-secondary); margin: 0; }",
    // The cover's tagline, which stopped being an h2 (#19) and must not start looking like body
    // copy for it. Same four declarations the h2 rule gives, and qualified with the tag so it
    // outranks `.rb-section p` below — a bare `.rb-subtitle` would lose to it on specificity and
    // the tagline would quietly render at body size in muted grey.
    ".rb-section p.rb-subtitle { font-family: var(--font-heading);",
    "  font-size: var(--size-subheading); color: var(--color-secondary); margin: 0; }",
    // Lists (the cards of "Qué hago", and every later list section). The card title is an
    // h3 in ink and its description a p in muted: both pairs the tokens already guarantee
    // against color.surface. The cards flow by auto-fit, so a composition only decides where
    // the list sits; min(100%, 16rem) means a card never demands more than the list's width,
    // which is one card per row at 320 and no overflow below it. The top border is
    // decorative, so text contrast does not apply to it.
    ".rb-section h3 { font-family: var(--font-heading); font-size: var(--size-body);",
    "  color: var(--color-ink); margin: 0; }",
    ".rb-list { display: grid; gap: var(--space-md); margin: 0; padding: 0; list-style: none;",
    "  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }",
    ".rb-item { display: flex; flex-direction: column; gap: var(--space-xs);",
    "  padding-top: var(--space-sm); border-top: 1px solid var(--color-muted); }",
    // A price list is a list, and the card grid above is not one. Everything else that holds a
    // list holds cards — services, opinions — and reads correctly three abreast; a carta read
    // three abreast is a pricing table for a software plan, not a menu. Found by building a real
    // one: twelve dishes came out in four rows of three, which nobody would read top to bottom.
    // One rule rather than a second list drawing, because the only thing that differs is how many
    // across.
    ".rb-prices .rb-list { grid-template-columns: 1fr; gap: var(--space-sm); }",
    // A gallery is the one list whose items are pictures, and `.rb-section img` alone —
    // width 100%, height auto — gives every card the height of whatever photo it holds. Four
    // photographs an owner took on a phone, some upright and some sideways, then come out as four
    // cards of four different heights with the captions at four different levels, which reads as a
    // broken page rather than as a gallery. A declared ratio with `object-fit: cover` makes the row
    // even and crops rather than squashes; 4/3 because it is the ratio a phone camera shoots in, so
    // the common photo is cropped least. One rule, like `.rb-prices` above, because the generic card
    // grid is right about everything else.
    ".rb-gallery .rb-item img { aspect-ratio: 4 / 3; object-fit: cover; }",
    // Equipo's photographs are faces, not work — a phone photo of a person taken upright and one
    // taken across a counter should not sit in the same row at two different heights the way an
    // uncropped gallery would leave them. A square crop is the one ratio that treats a portrait
    // shot and a landscape shot the same, which is the point for a row of headshots in a way it
    // is not for `.rb-gallery` above, where 4/3 was chosen to match what a phone shoots in.
    ".rb-team .rb-item img { aspect-ratio: 1 / 1; object-fit: cover; }",
    ".rb-section p { font-size: var(--size-body); color: var(--color-muted); margin: 0; }",
    // Plain links (PR #6, finding 3): color.primary, which every palette guarantees against
    // color.surface, and underlined so they never rely on colour alone. The :not keeps this
    // rule and the button rule from ever matching the same element. No outline, :focus,
    // :hover or :visited: the browser's focus ring stays, and there is one link colour.
    ".rb-section a:not([role=button]) { color: var(--color-primary); text-decoration: underline; }",
    ".rb-section [role=button] { display: inline-block; padding: var(--space-sm) var(--space-md);",
    "  background: var(--color-primary); color: var(--color-surface);",
    "  border-radius: var(--radius-sm); text-decoration: none; }",
    // The panel under text that overlaps an image (panelArea): the image keeps z-index auto
    // and paints first, the panel over it, the text over the panel. Grid items honour
    // z-index without position. align-self: stretch because .rb-section centres its items,
    // which would leave an empty panel with no height. pointer-events: none so a click on
    // the photo reaches the image, not a box nobody can select.
    ".rb-panel { align-self: stretch; margin: calc(-1 * var(--space-md)); z-index: 1;",
    "  background: var(--color-surface); border-radius: var(--radius-lg); pointer-events: none; }",
    ".rb-panel ~ :not(img) { z-index: 2; }",
    "",
    // The menu that writes itself (ADR 0023). Two versions alternated by the media query at the
    // bottom of this stylesheet, so that at any width exactly one is in the accessibility tree.
    //
    // `color.primary` on `color.surface` is the one pair every palette is proved against
    // (`packages/tokens/test/contrast.test.ts`), which is why the strip uses the page's own
    // background rather than a tinted bar of its own. Underlined on hover only would leave the
    // entries relying on colour alone, so they are not styled as links at all: they are a strip of
    // navigation, and the current one is marked by weight and a rule under it rather than by hue.
    ".rb-nav { display: flex; flex-wrap: wrap; gap: var(--space-md);",
    "  padding: var(--space-md) var(--space-xl); background: var(--color-surface); }",
    // A hairline under the strip, so it reads as a bar rather than as the page's top padding —
    // the same `color.muted` rule `.rb-item` already separates cards with, which keeps one visual
    // idiom instead of two. Decorative, so the contrast minimum for text does not apply to it.
    ".rb-nav-wide, .rb-nav-narrow { border-bottom: 1px solid var(--color-muted); }",
    ".rb-nav a { color: var(--color-primary); font-family: var(--font-heading);",
    "  font-size: var(--size-body); text-decoration: none; }",
    // Not colour alone: the entry for the page you are on carries a rule under it as well.
    ".rb-nav a[aria-current=page] { text-decoration: underline; text-underline-offset: 6px;",
    "  text-decoration-thickness: 2px; }",
    ".rb-nav-narrow { padding: var(--space-md) var(--space-lg);",
    "  background: var(--color-surface); }",
    ".rb-nav-narrow > summary { color: var(--color-primary); font-family: var(--font-heading);",
    "  font-size: var(--size-body); cursor: pointer; }",
    // Inside the disclosure the strip stacks, and its own padding would double the summary's.
    ".rb-nav-narrow .rb-nav { flex-direction: column; gap: var(--space-sm);",
    "  padding: var(--space-md) 0 0; }",
    "",
    // Below 320px is where the dossier's pre-publish check looks for overflow, so the
    // grid collapses before it can happen rather than being patched afterwards.
    //
    // The automatic mobile derivation (document rule 7; PR #6, finding 1): one column, one
    // element per row. Resetting only the column left each element's inline grid-row in
    // place, so elements that sat side by side landed in the same cell — the photo over the
    // headline, the link over the button. grid-row: auto lets the grid place each child on
    // its own row. The photo goes first (order: -1; option A, approved). And the panel is
    // hidden: with the photo on its own row nothing overlaps it, and the text sits on the
    // page's background, which is color.surface like the panel.
    "@media (max-width: 720px) {",
    "  .rb-section { grid-template-columns: 1fr; padding: var(--space-lg); }",
    "  .rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important; }",
    "  .rb-section > img { order: -1; }",
    "  .rb-panel { display: none; }",
    "}",
    "",
    // The two menus, alternated. `display: none` and not `visibility` or a clip: only `display:
    // none` takes an element out of the accessibility tree, and the whole point of emitting two is
    // that a screen reader is never told about a navigation landmark it cannot reach. The a11y
    // matrix asserts exactly one `<nav>` at each width, which is what makes this a guarantee
    // rather than an intention.
    //
    // Wide first and narrow in the query, matching how every other rule in this stylesheet is
    // written: the desktop shape is the default and 720px patches it (document rule 7).
    ".rb-nav-narrow { display: none; }",
    "@media (max-width: 720px) {",
    "  .rb-nav-wide { display: none; }",
    "  .rb-nav-narrow { display: block; }",
    "}",
    "",
    // Rule 6's per-element style, and then rule 7's per-element patches — both only for the
    // documents that carry any, so a site that uses neither publishes exactly the bytes it always
    // did. Style before patches because it applies at every width and the patches are the mobile
    // override; source order settles nothing here, since the selectors already decide, but a
    // stylesheet should read in the order somebody would explain it.
    ...elementStyleCss(doc),
    ...breakpointCss(doc),
  ].join("\n");
}
