import { placeholderImageSrc } from "@retorika/catalog";
import type { RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * What a published page says about itself when the link is shared (ADR 0029).
 *
 * Driven through `render` rather than through `headMetaOf` directly: the thing worth asserting is
 * the bytes a client's file carries, and a unit test of the shape in between would pass while the
 * tags were emitted wrong.
 */

const corpus = loadCorpus();
const base = (): RetorikaDocument => {
  const found = corpus.find((entry) => entry.name === "enlace-compartido");
  if (!found) throw new Error("fixture enlace-compartido is missing");
  return structuredClone(found.document);
};
const head = (doc: RetorikaDocument, pagePath?: string) =>
  render(doc, "html", pagePath === undefined ? {} : { pagePath }).html.split("<style>")[0] ?? "";

function coverImage(doc: RetorikaDocument): { src: string; alt: string } {
  const section = doc.pages[0]?.sections[0];
  const element = section?.content.find((el) => el.value?.kind === "image");
  if (element?.value?.kind !== "image") throw new Error("fixture lost its cover photo");
  return element.value;
}

describe("the description", () => {
  it("is the owner's sentence when there is one", () => {
    expect(head(base())).toContain(
      '<meta name="description" content="Cocina de puerto, con la lonja a cien metros">',
    );
  });

  it("falls back to the cover's subheadline, which is what nearly every document publishes", () => {
    // Derived, never copied (ADR 0022's principle): a field born pre-filled is stale the first time
    // somebody edits the cover.
    const doc = base();
    doc.siteDescription = undefined;
    expect(head(doc)).toContain(
      '<meta name="description" content="Comer, beber y quedarse un rato">',
    );
  });

  it("emits no tag at all when there is neither", () => {
    // An empty description is worse than none: a scraper shows an empty card instead of falling
    // back to the page itself.
    const doc = base();
    doc.siteDescription = undefined;
    const section = doc.pages[0]?.sections[0];
    const subheadline = section?.content.find((el) => el.slot === "subheadline");
    if (!subheadline) throw new Error("fixture lost its subheadline");
    subheadline.hidden = true;
    const emitted = head(doc);
    expect(emitted).not.toContain('name="description"');
    expect(emitted).not.toContain('property="og:description"');
  });
});

describe("og:title", () => {
  it("is on every page, because the page always has a title", () => {
    for (const entry of corpus) {
      expect(head(entry.document), entry.name).toContain('property="og:title"');
    }
  });
});

describe("og:image — an origin, and a picture that travels in the ZIP", () => {
  it("is the origin and the picture's own path in the bundle", () => {
    expect(head(base())).toContain(
      '<meta property="og:image" content="https://tabernadelpuerto.es/assets/portada.png">',
    );
  });

  it("is absent without an origin, because a relative one is refused by every scraper", () => {
    const doc = base();
    doc.siteUrl = undefined;
    expect(head(doc)).not.toContain("og:image");
  });

  it("refuses a data: URI, which has no path to make absolute", () => {
    const doc = base();
    coverImage(doc).src = "data:image/png;base64,iVBORw0KGgo=";
    expect(head(doc)).not.toContain("og:image");
  });

  it("refuses an SVG, because a card that renders nothing is worse than no card", () => {
    const doc = base();
    coverImage(doc).src = "assets/barbershop.svg";
    expect(head(doc)).not.toContain("og:image");
  });

  it("refuses the catalog's grey marker, named rather than left to the two rules above", () => {
    // The marker is a `data:` URI whose payload is an SVG, so it is already excluded twice. This
    // test exists because that protection is incidental: if the marker ever becomes a real file at
    // a path — which the photo bank filling up makes tempting — only a test named after it would
    // notice that an empty placeholder had become a business's shop window.
    const doc = base();
    coverImage(doc).src = placeholderImageSrc();
    expect(head(doc)).not.toContain("og:image");
  });

  it("takes the first visible picture, so a hidden cover photo is not published as the card", () => {
    const doc = base();
    const section = doc.pages[0]?.sections[0];
    const image = section?.content.find((el) => el.value?.kind === "image");
    if (!image) throw new Error("fixture lost its cover photo");
    image.hidden = true;
    expect(head(doc)).not.toContain("og:image");
  });
});

describe("og:url — the publisher's path, never the renderer's guess", () => {
  it("is absent with no path, which is the editor's live preview", () => {
    // There is no bundle there and nothing to link to. Emitting a guess would be a URL that
    // disagrees with the file the ZIP eventually carries.
    expect(head(base())).not.toContain("og:url");
  });

  it("is the origin itself for the entry page", () => {
    expect(head(base(), "index.html")).toContain(
      '<meta property="og:url" content="https://tabernadelpuerto.es">',
    );
  });

  it("is the origin and the file for any other page", () => {
    expect(head(base(), "servicios.html")).toContain(
      '<meta property="og:url" content="https://tabernadelpuerto.es/servicios.html">',
    );
  });

  it("is absent without an origin, however the path arrives", () => {
    const doc = base();
    doc.siteUrl = undefined;
    expect(head(doc, "index.html")).not.toContain("og:url");
  });
});

describe("the owner's words reach an attribute, so they are escaped there too", () => {
  it("escapes the corpus's own attack where it now also lands", () => {
    // `xss-attempt` carries «" onerror=alert(2) x="» — a payload written to break out of an
    // attribute — and it now reaches `<meta content>` as well as the body.
    const attack = corpus.find((entry) => entry.name === "xss-attempt");
    if (!attack) throw new Error("xss-attempt is missing");
    const emitted = head(attack.document);
    expect(emitted).toContain("&quot; onerror=alert(2) x=&quot;");
    expect(emitted).not.toContain('content="" onerror=');
    expect(emitted).not.toContain("<script>");
  });

  it("escapes a quote the owner puts in the address's own tags", () => {
    // Proved by breaking it: a description built to close the attribute and open an event handler.
    const doc = base();
    doc.siteDescription = '" onmouseover="alert(1)';
    const emitted = head(doc);
    expect(emitted).toContain('content="&quot; onmouseover=&quot;alert(1)">');
    expect(emitted).not.toContain('onmouseover="alert(1)"');
  });
});
