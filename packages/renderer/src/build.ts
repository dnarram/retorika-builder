import { presetFor } from "@retorika/catalog";
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

function placementStyle(placement: Placement): string {
  return [
    `grid-column:${placement.column}/span ${placement.columnSpan}`,
    `grid-row:${placement.row}/span ${placement.rowSpan}`,
  ].join(";");
}

function elementNode(el: ContentElement, options: RenderOptions): RenderNode | undefined {
  if (el.hidden) return undefined;

  const value = el.value;
  if (!value) return undefined;

  const base = { "data-role": el.role, "data-slot": el.slot };

  switch (value.kind) {
    case "text":
      switch (el.role) {
        case "heading":
          return element("h1", base, [value.text]);
        case "subheading":
          return element("h2", base, [value.text]);
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

function sectionNode(section: Section, options: RenderOptions): RenderNode {
  const preset = presetFor(section.preset.catalogId);
  const elements = section.content;

  // A free section brings its own layout; a catalog section borrows the preset's.
  // Rule 1 in practice: either way the layout only names element ids.
  const layout = section.layout ?? preset.layoutFor(section.preset.variantId, elements);
  const placementById = new Map(layout.placements.map((p) => [p.elementId, p]));

  const children: RenderNode[] = [];
  for (const el of elements) {
    const node = elementNode(el, options);
    if (!node) continue;

    const placement = placementById.get(el.id);
    if (placement) node.attributes["style"] = placementStyle(placement);
    children.push(node);
  }

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
    ".rb-section h1 { font-family: var(--font-heading); font-size: var(--size-heading);",
    "  color: var(--color-primary); margin: 0; }",
    ".rb-section h2 { font-family: var(--font-heading); font-size: var(--size-subheading);",
    "  color: var(--color-secondary); margin: 0; }",
    ".rb-section p { font-size: var(--size-body); color: var(--color-muted); margin: 0; }",
    ".rb-section [role=button] { display: inline-block; padding: var(--space-sm) var(--space-md);",
    "  background: var(--color-primary); color: var(--color-surface);",
    "  border-radius: var(--radius-sm); text-decoration: none; }",
    "",
    // Below 320px is where the dossier's pre-publish check looks for overflow, so the
    // grid collapses before it can happen rather than being patched afterwards.
    "@media (max-width: 720px) {",
    "  .rb-section { grid-template-columns: 1fr; padding: var(--space-lg); }",
    "  .rb-section > * { grid-column: 1 / -1 !important; }",
    "}",
    "",
  ].join("\n");
}
