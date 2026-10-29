import { gzipSync } from "node:zlib";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { HEADER_SCRIPT } from "../src/headerScript.ts";
import { render } from "../src/index.ts";

/**
 * The first script a published page carries (ADR 0058), and the four properties that make it
 * admissible: it is one constant, it holds nothing of the document, it weighs what the ADR says, and
 * it travels only where a header does — never to the editor's canvas.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function section(id: string, catalogId: string, title: string): Section {
  return {
    id,
    preset: { catalogId, variantId: catalogId === "cover" ? "image-right" : "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: `el-${id}`,
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: title },
      },
    ],
  };
}

function site(siteName: string, n: number): RetorikaDocument {
  const kinds = ["services", "location", "contact", "prices"];
  return {
    schemaVersion: "1.15.0",
    id: "doc-script",
    siteName,
    theme,
    collections: [],
    pages: [
      {
        id: "home",
        slug: "index",
        title: siteName,
        sections: [
          section("sec-cover", "cover", siteName),
          ...kinds.slice(0, n).map((kind) => section(`sec-${kind}`, kind, `Sobre ${kind}`)),
        ],
      },
    ],
  };
}

const scriptsIn = (html: string) =>
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe("the header's script", () => {
  it("is one constant: two different documents carry the same bytes", () => {
    const a = scriptsIn(render(site("Taberna Santo Domingo", 3), "html").html);
    const b = scriptsIn(render(site("Casa <script>alert(1)</script> Trufa", 4), "html").html);
    expect(a).toHaveLength(1);
    expect(b).toEqual(a);
    expect(a[0]).toBe(HEADER_SCRIPT);
  });

  it("holds nothing that could close or open a tag, so no document can reach it", () => {
    expect(HEADER_SCRIPT).not.toMatch(/<\/?script/i);
    expect(HEADER_SCRIPT).not.toContain("<");
    // The whole of the words it reads come from the DOM it is handed; it writes four things.
    expect(HEADER_SCRIPT).toContain("data-rb-js");
    expect(HEADER_SCRIPT).toContain("--rb-header-h");
    expect(HEADER_SCRIPT).toContain("data-scrolled");
    expect(HEADER_SCRIPT).toContain("aria-current");
    expect(HEADER_SCRIPT).not.toMatch(
      /fetch\(|XMLHttpRequest|eval\(|localStorage|document\.cookie|import\(/,
    );
  });

  it("weighs at or under 2 KB gzipped, a quarter of what the protocol allows an interactive section", () => {
    const bytes = gzipSync(Buffer.from(HEADER_SCRIPT, "utf8")).length;
    expect(bytes).toBeLessThanOrEqual(2 * 1024);
    expect(bytes).toBeGreaterThan(200);
  });

  it("travels only where a header is drawn, and once", () => {
    expect(scriptsIn(render(site("Taberna", 1), "html").html)).toEqual([]);
    expect(scriptsIn(render(site("Taberna", 3), "html").html)).toHaveLength(1);
    const html = render(site("Taberna", 3), "html").html;
    expect(html.indexOf("<script>")).toBeGreaterThan(html.indexOf("</main>"));
  });

  it("never reaches the dom target, which is the editor's canvas", () => {
    const fragment = render(site("Taberna", 3), "dom");
    expect(fragment.querySelector("script")).toBeNull();
  });
});
