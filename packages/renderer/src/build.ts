import { COVER_ID, FOOTER_ID, presetFor } from "@retorika/catalog";
import {
  type ContentElement,
  type Page,
  type Placement,
  type RetorikaDocument,
  type Section,
  SORTED_TOKEN_KEYS,
  tokenToCssVariable,
} from "@retorika/schema";
import { cssThemeValue, safeUrl } from "./escape.ts";
import { commentNode, element, type RenderNode } from "./nodes.ts";
import type { ResolvedRenderOptions } from "./options.ts";

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
          return element(headingTag(level), base, [value.text]);
        case "subheading":
          // A paragraph, not a heading (#19). A subheadline is a tagline — "Reserva en treinta
          // segundos" — and it heads nothing: marked up as h{level+1} it appears in a screen
          // reader's heading list and rotor as if a section of the page started there, so the
          // outline claims more sections than the page has (WCAG 1.3.1). The role in the document
          // is unchanged and so is the look; only the tag the renderer picks for it changes.
          return element("p", { ...base, class: "rb-subtitle" }, [value.text]);
        default:
          return element("p", base, [value.text]);
      }

    case "image":
      return element("img", { ...base, src: safeUrl(value.src), alt: value.alt });

    case "link":
      return element(
        el.role === "button" ? "a" : "a",
        { ...base, href: safeUrl(value.href), ...(el.role === "button" ? { role: "button" } : {}) },
        [value.text],
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

function sectionNode(section: Section, options: ResolvedRenderOptions, isH1: boolean): RenderNode {
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

    const placement = placementById.get(el.id);
    if (placement) node.attributes["style"] = placementStyle(placement);
    emitted.push({ el, node, placement });
  }

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

export function buildTree(doc: RetorikaDocument, options: ResolvedRenderOptions): RenderNode {
  const page = resolvePage(doc, options.pageId);

  // Which section(s) get the h1. Unchanged for a page that has a cover: every section built on
  // the cover preset is h1, exactly as before — including a free section on that preset, which
  // `hidden-and-embed` in the golden corpus tests deliberately (see the comment in `sectionNode`).
  // New for sprint 5: a page with *no* cover section at all — a converted page, since ADR 0022
  // forbids converting the cover — used to publish with no h1, which axe marks. Its first section
  // is promoted instead.
  const hasCover = page.sections.some((section) => section.preset.catalogId === COVER_ID);
  const fallbackH1Id = hasCover ? undefined : page.sections[0]?.id;

  return element("main", { class: "rb-page", "data-page": page.id }, [
    ...page.sections.map((section) =>
      sectionNode(
        section,
        options,
        section.preset.catalogId === COVER_ID || section.id === fallbackH1Id,
      ),
    ),
  ]);
}

/**
 * The theme as CSS custom properties, in a fixed alphabetical order.
 *
 * The order is what makes the output byte-identical across runs, which is what INV_5
 * and the golden tests check. It also means a golden diff shows real changes rather
 * than reshuffled lines.
 */
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
  ].join("\n");
}
