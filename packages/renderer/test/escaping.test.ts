import type { RetorikaDocument, Theme } from "@retorika/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cssThemeValue } from "../src/escape.ts";
import { NEUTRALISED_URL, render, safeUrl } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

const hostile = loadCorpus().find((entry) => entry.name === "xss-attempt");
if (!hostile) throw new Error("the xss-attempt fixture is missing from the corpus");

const { html } = render(hostile.document, "html");

describe("escaping the published page", () => {
  it("never emits a script tag from user content", () => {
    expect(html).not.toContain("<script");
  });

  it("emits the content, escaped, rather than dropping it", () => {
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot;");
  });

  it("keeps an injected event handler inside the attribute value", () => {
    // The fixture carries `" onerror=alert(2) x="`. If the quote were not escaped it
    // would close the attribute and the rest would become a real handler.
    //
    // Checked by parsing rather than by regex: the escaped text legitimately contains
    // the characters "onerror=", so a regex over the source cannot tell a real attribute
    // from an inert one. The parser can.
    const parsed = new DOMParser().parseFromString(html, "text/html");
    for (const el of parsed.querySelectorAll("*")) {
      for (const attribute of el.attributes) {
        expect(attribute.name.toLowerCase().startsWith("on")).toBe(false);
      }
    }
  });

  it("neutralises javascript: URLs, which escaping alone does not touch", () => {
    // This is a separate defence on purpose: `javascript:alert(1)` contains no character
    // that escaping changes, so an escaped href is still a live script.
    for (const match of html.matchAll(/(?:href|src)="([^"]*)"/gi)) {
      expect(match[1]?.toLowerCase().startsWith("javascript:")).toBe(false);
    }
    expect(html).toContain(`href="${NEUTRALISED_URL}"`);
  });
});

describe("safeUrl", () => {
  it.each([
    "javascript:alert(1)",
    "JaVaScript:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
  ])("neutralises %s", (input) => {
    expect(safeUrl(input)).toBe(NEUTRALISED_URL);
  });

  it.each([
    "#reservas",
    "/contacto",
    "https://example.com",
    "mailto:hola@example.com",
    "data:image/png;base64,AAA",
  ])("leaves %s alone", (input) => {
    expect(safeUrl(input)).toBe(input);
  });
});

describe("embeds", () => {
  const withEmbed = loadCorpus().find((entry) => entry.name === "hidden-and-embed");
  if (!withEmbed) throw new Error("the hidden-and-embed fixture is missing from the corpus");

  it("withholds the payload under the default options", () => {
    const output = render(withEmbed.document, "html");
    expect(output.html).not.toContain("EMBED-PAYLOAD-MARKER");
    expect(output.html).not.toContain("<iframe");
    expect(output.html).toContain("retorika:embed withheld");
  });
});

describe("cssThemeValue — theme values inside <style>", () => {
  // <style> is a raw-text element: the browser never decodes entities inside it, so the
  // theme can only be validated there, never escaped. PR #6, finding 4.
  const corpus = loadCorpus();
  const quoted = corpus.find((entry) => entry.name === "tokens-quoted-fonts");
  if (!quoted) throw new Error("the tokens-quoted-fonts fixture is missing from the corpus");
  const base = quoted.document;
  const keys = Object.keys(base.theme) as (keyof Theme)[];

  /** Everything between the page's <style> and its last </style>, so an injected early
   * </style> stays inside what is inspected instead of cutting it short. */
  function styleOf(html: string): string {
    const start = html.indexOf("<style>");
    const end = html.lastIndexOf("</style>");
    if (start === -1 || end === -1) throw new Error("rendered page has no <style> block");
    return html.slice(start + "<style>".length, end);
  }

  const count = (text: string, char: string) => text.split(char).length - 1;
  const declarations = (css: string) =>
    css.split("\n").filter((line) => /^ {2}--[a-z-]+: /.test(line)).length;

  function withValue(key: keyof Theme, value: string): RetorikaDocument {
    return { ...base, theme: { ...base.theme, [key]: value } };
  }

  it("emits a quoted font stack verbatim, not HTML-escaped", () => {
    const { html } = render(base, "html");
    const css = styleOf(html);
    expect(css).toContain("--font-heading: Georgia, Cambria, 'Times New Roman', Times, serif;");
    expect(css).toContain("'Segoe UI'");
    expect(html).not.toContain("&#39;");
  });

  it.each([
    ["a closing style tag", "</style><script>alert(1)</script>"],
    ["an uppercase closing style tag inside quotes", "'</STYLE>'"],
    ["a closing style tag inside quotes", "'</style>'"],
    ["a declaration and rule break-out", "red; } body { display: none"],
    ["a url() fetch", "url(https://example.test/x.png)"],
    ["a CSS escape spelling </style>", "\\3c /style\\3e"],
    ["a comment", "Georgia /* */"],
    ["an unclosed quote", "'Times"],
    ["mismatched quotes", "\"Segoe UI'"],
    ["!important", "red !important"],
    ["an at-rule", "@import x"],
    ["a var() reference", "var(--color-primary)"],
    ["a calc() function", "calc(1rem * 2)"],
    ["an empty value", ""],
    ["a spaces-only value", "   "],
    ["a semicolon inside quotes", "'Times;New'"],
    ["braces inside quotes", "'a{b}'"],
    ["a tab in a bare run", "Georgia,\tserif"],
    ["a tab inside quotes", "'Times\tNew Roman'"],
    ["a newline in a bare run", "Georgia,\nserif"],
    ["a newline inside quotes", "'Times\nNew Roman'"],
    ["a no-break space in a bare run", "Georgia,\u00A0serif"],
    ["a no-break space inside quotes", "'Times\u00A0New Roman'"],
    ["a NUL byte", "Georgia\u0000"],
    ["a non-ASCII letter", "Caf\u00E9 Sans"],
  ])("refuses %s, naming the key", (_label, value) => {
    expect(() => cssThemeValue("font.heading", value)).toThrow(/"font\.heading"/);
  });

  it("refuses at render time rather than publishing the value", () => {
    const hostile = withValue("font.body", "x</style><script>alert(1)</script>");
    expect(() => render(hostile, "html")).toThrow(/"font\.body"/);
  });

  it("accepts every theme value of the golden corpus, unchanged", () => {
    for (const { name, document } of corpus) {
      for (const key of keys) {
        expect(cssThemeValue(key, document.theme[key]), `${name}: ${key}`).toBe(
          document.theme[key],
        );
      }
    }
  });

  it("accepts every value packages/tokens declares today, unchanged", () => {
    // Copied as literals: the renderer does not depend on tokens. If tokens gain a value
    // this guard refuses, that is a decision to bring back, not a grammar to widen.
    const tokenValues = [
      // palettes: classic-blue, warm-terracotta, forest-emerald, dark-slate
      "#1D4ED8",
      "#0F766E",
      "#D97706",
      "#FFFFFF",
      "#0F172A",
      "#475569",
      "#9A3412",
      "#78350F",
      "#C2410C",
      "#FAFAF9",
      "#1C1917",
      "#57534E",
      "#047857",
      "#065F46",
      "#B45309",
      "#F0FDF4",
      "#064E3B",
      "#374151",
      "#38BDF8",
      "#A7F3D0",
      "#F472B6",
      "#0F172A",
      "#F8FAFC",
      "#94A3B8",
      // type pairs: editorial-serif, modern-sans, classic-display
      "Georgia, Cambria, 'Times New Roman', Times, serif",
      "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      "'Playfair Display', Georgia, 'Times New Roman', serif",
      // scale: default
      "2.5rem",
      "1.5rem",
      "1rem",
      "4px",
      "8px",
      "16px",
      "24px",
      "48px",
    ];
    for (const value of tokenValues) expect(cssThemeValue("any.key", value)).toBe(value);
  });

  it.each([["color.primary-abc"], ["font.heading-x1"], ["space.md-0"]])(
    "accepts the identifier-shaped value %s, unchanged",
    (value) => {
      expect(cssThemeValue("color.primary", value)).toBe(value);
    },
  );

  it("never lets an accepted value close <style> or add a rule", () => {
    const baseCss = styleOf(render(base, "html").html);

    const valid = fc.constantFrom(
      "#1D4ED8",
      "2.5rem",
      "48px",
      "100%",
      "Georgia",
      "sans-serif",
      "'Times New Roman'",
      '"Segoe UI"',
      "color.primary-abc",
      ", ",
      " ",
    );
    const dangerous = fc.constantFrom(
      "<",
      ">",
      "</style>",
      "</STYLE>",
      ";",
      "{",
      "}",
      "\\",
      "/*",
      "*/",
      "(",
      ")",
      "url(",
      "@import",
      "!important",
      "'",
      '"',
      "\t",
      "\n",
      "\u00A0",
      "\u00F1",
    );
    // Roughly one fragment in five is dangerous, so both outcomes happen often: a property
    // that only ever sees values being refused would pass without checking anything.
    const fragment = fc.oneof({ arbitrary: valid, weight: 4 }, { arbitrary: dangerous, weight: 1 });
    const value = fc.array(fragment, { minLength: 1, maxLength: 4 }).map((parts) => parts.join(""));

    let accepted = 0;
    let refused = 0;
    fc.assert(
      fc.property(fc.constantFrom(...keys), value, (key, candidate) => {
        let returned: string;
        try {
          returned = cssThemeValue(key, candidate);
        } catch {
          refused += 1;
          return;
        }
        accepted += 1;
        expect(returned).toBe(candidate);

        const { html } = render(withValue(key, candidate), "html");
        const css = styleOf(html);
        expect(html.toLowerCase().split("</style").length - 1).toBe(1);
        expect(css.toLowerCase()).not.toContain("</style");
        for (const char of ["{", "}", ";"]) {
          expect(count(css, char), char).toBe(count(baseCss, char));
        }
        expect(declarations(css)).toBe(keys.length);
      }),
      { numRuns: 2000 },
    );

    // The threshold is part of the test, not a tuning knob: if it fails, fix the generator.
    const total = accepted + refused;
    expect(accepted / total, `accepted ${accepted} of ${total}`).toBeGreaterThanOrEqual(0.25);
    expect(refused / total, `refused ${refused} of ${total}`).toBeGreaterThanOrEqual(0.25);
  });
});
