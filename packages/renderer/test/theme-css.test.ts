import {
  type ContentElement,
  parseDocument,
  type RetorikaDocument,
  SORTED_TOKEN_KEYS,
  type Theme,
  TOKEN_KEYS,
  tokenToCssVariable,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * Which of the theme's colours the stylesheet actually paints with.
 *
 * The distinction this pins is between **declaring** a custom property and **using** one. A theme
 * is total, so the `:root` block emits all nineteen — that is what makes one click restyle a whole
 * site, hand-designed sections included. But a declared property that no rule reads paints
 * nothing, and `color.accent` is exactly that: every palette carries one, the stylesheet has never
 * referenced it, and its contrast is asserted nowhere. In `classic-blue` it is 3.19:1 on surface,
 * under AA.
 *
 * The Estilo panel relies on that being true — it shows five swatches per palette and leaves the
 * accent out, because advertising a colour that appears nowhere on the page and carries no
 * guarantee would be promising something the site does not deliver
 * (`packages/tokens/src/restyle.ts`, `RENDERED_COLOR_KEYS`).
 *
 * So if a rule here ever starts reading `var(--color-accent)`, this fails — and the fix is not to
 * relax it. Accent would need a contrast pair asserted in `packages/tokens/test/contrast.test.ts`
 * first, and then the swatch row and this test move together.
 */

const corpus = loadCorpus();

/** Every `var(--x)` a rule reads, as opposed to the `--x: value` lines that declare them. */
function variablesUsed(css: string): Set<string> {
  return new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1] ?? ""));
}

function cssOf(html: string): string {
  const match = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!match?.[1]) throw new Error("the rendered page has no <style> block");
  return match[1];
}

const THEME = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

const first = corpus[0];
if (!first) throw new Error("the corpus is empty");

describe("the theme's custom properties", () => {
  const css = cssOf(render(first.document, "html").html);

  it("declares every key of the namespace, because a theme is total", () => {
    for (const key of SORTED_TOKEN_KEYS) {
      expect(css, key).toContain(`${tokenToCssVariable(key)}:`);
    }
  });

  it("reads no --color-accent in any rule, which is what lets the panel leave it out", () => {
    expect(variablesUsed(css)).not.toContain("--color-accent");
  });

  it("reads the five colours the panel does show", () => {
    const used = variablesUsed(css);
    for (const name of [
      "--color-primary",
      "--color-secondary",
      "--color-muted",
      "--color-surface",
      "--color-ink",
    ]) {
      expect(used, name).toContain(name);
    }
  });

  it("reads no accent in any document of the corpus, not just the first", () => {
    for (const entry of corpus) {
      const used = variablesUsed(cssOf(render(entry.document, "html").html));
      expect(used, entry.name).not.toContain("--color-accent");
    }
  });
});

/**
 * **The two shapes of the stylesheet** (ADR 0074, sprint 38 día 1). A theme without a fill of its own
 * — every document of the corpus but one, every site before 1.20.0 — publishes the stylesheet it
 * always did: the goldens are the byte-for-byte proof, and this says why in one line each. A theme
 * with one fills with `--color-fill`, writes on it in `--color-on-fill`, and re-points the primary bar
 * alone, so the secondary and ink bars keep their surface words.
 */
describe("the fill and its ink", () => {
  const yellowEntry = corpus.find((entry) => entry.name === "logo-amarillo");
  if (!yellowEntry) throw new Error("logo-amarillo is not in the corpus");
  const yellow = yellowEntry.document;
  const withHeader = (doc: RetorikaDocument, header: object) =>
    parseDocument({ ...doc, header: { ...doc.header, ...header } });
  /** The same yellow with a rail on the left and the sections in «Ir a…», so every bar part shows. */
  const everyPart = withHeader(yellow, {
    pages: { shown: true, position: "left" },
    sections: { shown: true, position: "fold" },
    sticky: true,
    progress: true,
  });

  it("is absent from every document without a fill, which is the corpus's every other one", () => {
    for (const entry of corpus) {
      if (entry.name === "logo-amarillo") continue;
      const css = cssOf(render(entry.document, "html").html);
      expect(css, entry.name).not.toContain("--color-fill");
      expect(css, entry.name).not.toContain("--color-on-fill");
    }
  });

  it("declares the pair after the nineteen, and fills nothing with the primary any more", () => {
    for (const doc of [yellow, everyPart]) {
      const css = cssOf(render(doc, "html").html);
      const root = css.slice(0, css.indexOf("}"));
      expect(
        root.trimEnd().endsWith(`--color-on-fill: ${yellow.theme["color.onFill"]};`),
        root,
      ).toBe(true);
      expect(root).toContain(`--color-fill: ${yellow.theme["color.fill"]};`);
      // No shape is filled with the text's colour: every `background` that read the primary reads
      // the fill now. The text roles — the heading, the links, the skip link — keep the primary, and
      // so do the two thin marks drawn on a surface bar (the indicator under the current entry and
      // the progress line), which are read against the surface like an underline is: in the fill a
      // yellow would draw them at 1.5:1 on white. On a coloured bar both are re-pointed anyway.
      const stillPrimary = css
        .split("\n")
        .filter((line) => line.includes("background: var(--color-primary)"));
      for (const line of stillPrimary) {
        expect(line, line).toMatch(/left: anchor\(left\)|height: 2px/);
      }
      expect(css).toMatch(/color: var\(--color-primary\)/);
    }
  });

  it("re-points the primary bar alone, and never the secondary or ink bars", () => {
    const css = cssOf(render(everyPart, "html").html);
    const lines = css.split("\n");
    // Every rule that names the fill's ink names the primary bar or the button — never another scheme.
    for (const line of lines.filter((l) => l.includes("--color-on-fill)"))) {
      expect(line, line).not.toMatch(/data-bg=(secondary|ink)\]/);
    }
    // Each shared rule that writes the surface on the three coloured bars is followed by its
    // primary-bar twin in the fill's ink: the brand and entries, the current entry, the indicator, the
    // hover, the button, the progress line, the rail's divider and «Ir a…».
    for (const twin of [
      ".rb-header[data-bg=primary] :is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) {",
      ".rb-header[data-bg=primary] .rb-nav a[aria-current] { text-decoration-color: var(--color-on-fill); }",
      ".rb-header[data-bg=primary] .rb-nav::after { background: var(--color-on-fill); }",
      ".rb-header[data-bg=primary] .rb-nav-action { background: var(--color-on-fill); color: var(--color-fill); }",
      ".rb-header[data-bg=primary] .rb-rail > .rb-nav + .rb-nav {",
      ".rb-header[data-bg=primary] .rb-nav-fold > summary { color: var(--color-on-fill); }",
      ".rb-header[data-bg=primary] .rb-rail { background: var(--color-fill); }",
      ".rb-header[data-bg=primary] .rb-nav-fold > :is(summary, .rb-nav) { background: var(--color-fill); }",
      ".rb-header[data-progress][data-bg=primary]::after { background: var(--color-on-fill); }",
    ]) {
      expect(css, twin).toContain(twin);
    }
    // And the secondary and ink bars still write in the surface, by the shared rules unchanged.
    expect(css).toContain(
      ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav-action {\n  background: var(--color-surface); color: var(--color-primary); }",
    );
  });

  it("puts the twin after the shared rule it overrides, at the same weight", () => {
    const css = cssOf(render(yellow, "html").html);
    const shared = css.indexOf(
      ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])\n  :is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) { color: var(--color-surface); }",
    );
    const twin = css.indexOf(
      ".rb-header[data-bg=primary] :is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) {",
    );
    expect(shared).toBeGreaterThan(-1);
    expect(twin).toBeGreaterThan(shared);
  });
});

/**
 * Nothing to say is drawn as nothing.
 *
 * A text element whose value is blank used to publish `<h2></h2>` or `<p></p>` into the client's
 * ZIP — invisible, but a real node still taking the flex gap between its siblings, and exactly
 * the thing `blank.ts` refuses to create when it says a required slot "cannot be filled with an
 * empty string". The editor is where they came from: click-to-edit commits whatever is in the
 * field on blur, so deleting a sentence commits "".
 *
 * It is also what makes an optional slot genuinely optional once it exists. A price on a carta
 * line is created with a marker because nothing in the editor could otherwise reach it; a line
 * with no price is one whose price the owner emptied, and it has to leave no trace.
 */
describe("an empty text", () => {
  const page = (content: ContentElement[]) =>
    render(
      {
        schemaVersion: "1.0.0",
        id: "doc-empty",
        siteName: "Barbería El Corte",
        theme: THEME,
        collections: [],
        pages: [
          {
            id: "home",
            slug: "inicio",
            title: "Inicio",
            sections: [
              {
                id: "sec-cover",
                preset: { catalogId: "cover", variantId: "image-right" },
                source: "catalog",
                layout: null,
                content,
              },
            ],
          },
        ],
      },
      "html",
    ).html;

  const heading = (text: string): ContentElement => ({
    id: "el-headline",
    role: "heading",
    hidden: false,
    slot: "headline",
    value: { kind: "text", text },
  });

  it("is drawn as nothing rather than as an empty tag", () => {
    expect(page([heading("")])).not.toContain("el-headline");
  });

  it("counts whitespace as nothing too", () => {
    expect(page([heading("   ")])).not.toContain("el-headline");
  });

  it("still draws a text that says something", () => {
    expect(page([heading("Cortes y barbas")])).toContain("Cortes y barbas");
  });

  it("drops a list item whose every text was emptied, rather than leaving a blank row", () => {
    const html = page([
      {
        id: "el-list",
        role: "list",
        hidden: false,
        slot: "services",
        items: [
          {
            id: "item-1",
            elements: [
              {
                id: "el-1-title",
                role: "heading",
                hidden: false,
                slot: "title",
                value: { kind: "text", text: "" },
              },
            ],
          },
          {
            id: "item-2",
            elements: [
              {
                id: "el-2-title",
                role: "heading",
                hidden: false,
                slot: "title",
                value: { kind: "text", text: "Corte de caballero" },
              },
            ],
          },
        ],
      },
    ]);
    expect(html).not.toContain('data-item="item-1"');
    expect(html).toContain('data-item="item-2"');
  });
});
