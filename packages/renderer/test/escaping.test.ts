import { describe, expect, it } from "vitest";
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
