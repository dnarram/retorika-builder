import {
  type ContentElement,
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
