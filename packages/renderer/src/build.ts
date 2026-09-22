import { COVER_ID, presetFor } from "@retorika/catalog";
import {
  type ContentElement,
  type Placement,
  type RetorikaDocument,
  type Section,
  SORTED_TOKEN_KEYS,
  tokenToCssVariable,
} from "@retorika/schema";
import { cssThemeValue, safeUrl } from "./escape.ts";
import { commentNode, element, type RenderNode } from "./nodes.ts";
import type { RenderOptions } from "./options.ts";

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
  options: RenderOptions,
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
  options: RenderOptions,
  level: number,
): RenderNode | undefined {
  if (el.hidden) return undefined;

  const base = { "data-role": el.role, "data-slot": el.slot };

  // A list holds items rather than a value, so it is handled before the value check.
  if (el.role === "list") return listNode(el, options, level, base);

  const value = el.value;
  if (!value) return undefined;

  switch (value.kind) {
    case "text":
      switch (el.role) {
        case "heading":
          return element(headingTag(level), base, [value.text]);
        case "subheading":
          return element(headingTag(level + 1), base, [value.text]);
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

function sectionNode(section: Section, options: RenderOptions): RenderNode {
  const preset = presetFor(section.preset.catalogId);
  const elements = section.content;

  // A free section brings its own layout; a catalog section borrows the preset's.
  // Rule 1 in practice: either way the layout only names element ids.
  const layout = section.layout ?? preset.layoutFor(section.preset.variantId, elements);
  const placementById = new Map(layout.placements.map((p) => [p.elementId, p]));

  // The cover carries the page's <h1>; every other section starts at <h2>. A free section
  // built on the cover preset is still the cover.
  const level = section.preset.catalogId === COVER_ID ? 1 : 2;

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

  return element(
    "section",
    {
      "data-section": section.id,
      "data-preset": section.preset.catalogId,
      "data-variant": section.preset.variantId,
      class: `rb-section rb-${section.preset.catalogId} rb-${section.preset.variantId}`,
    },
    children,
  );
}

export function buildTree(doc: RetorikaDocument, options: RenderOptions): RenderNode {
  const page = doc.pages[0];
  if (!page) throw new Error("Document has no pages");

  return element("main", { class: "rb-page", "data-page": page.id }, [
    ...page.sections.map((section) => sectionNode(section, options)),
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
    ".rb-section :is(h1, h2, h3, h4, h5, h6) { -webkit-hyphens: auto; hyphens: auto; }",
    ".rb-section h1 { font-family: var(--font-heading); font-size: var(--size-heading);",
    "  color: var(--color-primary); margin: 0; }",
    ".rb-section h2 { font-family: var(--font-heading); font-size: var(--size-subheading);",
    "  color: var(--color-secondary); margin: 0; }",
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
