import { inflateRawSync } from "node:zlib";
import { EMPTY_ANSWERS, generate, VARIANTS } from "@retorika/generator";
import type { RetorikaDocument, Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/download/route.ts";

/**
 * Just enough of a ZIP reader to pull one file back out by name — not an independent
 * validator of the format itself, which is `packages/publisher/test/zip.test.ts`'s job.
 * Walks the central directory from the end, same as unzip does.
 */
function extractFile(bytes: Uint8Array, path: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  const count = view.getUint16(eocd + 10, true);
  const decoder = new TextDecoder();
  let at = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i += 1) {
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (name === path) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const raw = bytes.subarray(dataStart, dataStart + compressedSize);
      return decoder.decode(method === 8 ? inflateRawSync(raw) : raw);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`"${path}" not found in the ZIP`);
}

/** The exact shape a real walk through the questionnaire produces. */
const REAL_DOCUMENT: RetorikaDocument = generate({
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar",
  services: ["Comidas", "Cenas", "Tapas", "Terraza"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  hours: "De martes a domingo, de 13:00 a 16:00 y de 20:00 a 23:30",
  mainAction: "book",
  bookingLink: "https://reservas.example.com/taberna",
}).document;

function request(body: unknown): Request {
  return new Request("http://localhost/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function findSection(doc: RetorikaDocument, catalogId: string): Section {
  const section = doc.pages[0]?.sections.find((s) => s.preset.catalogId === catalogId);
  if (!section) throw new Error(`no "${catalogId}" section in the fixture`);
  return section;
}

describe("POST /api/download", () => {
  it("builds a real ZIP in memory from a real document, for every variant composition", async () => {
    for (const variant of VARIANTS) {
      const { document } = generate(
        {
          ...EMPTY_ANSWERS,
          businessName: "Taberna Santo Domingo",
          sector: "restaurante-bar",
          services: ["Comidas"],
          mainAction: "book",
          bookingLink: "https://reservas.example.com",
        },
        variant,
      );
      const response = await POST(request({ document }));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toMatch(
        /filename="doc-taberna-santo-domingo\.zip"/,
      );
      const bytes = new Uint8Array(await response.arrayBuffer());
      // ZIP local file header magic: "PK\x03\x04".
      expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(bytes.length).toBeGreaterThan(200);
    }
  });

  it("carries the document's real content, including an edit made client-side", async () => {
    const cover = findSection(REAL_DOCUMENT, "cover");
    const edited: RetorikaDocument = {
      ...REAL_DOCUMENT,
      pages: [
        {
          ...(REAL_DOCUMENT.pages[0] as RetorikaDocument["pages"][number]),
          sections:
            REAL_DOCUMENT.pages[0]?.sections.map((section) =>
              section.id === cover.id
                ? {
                    ...section,
                    content: section.content.map((el) =>
                      el.id === "el-headline" && el.value?.kind === "text"
                        ? { ...el, value: { ...el.value, text: "Edición Especial" } }
                        : el,
                    ),
                  }
                : section,
            ) ?? [],
        },
      ],
    };
    const response = await POST(request({ document: edited }));
    expect(response.status).toBe(200);
    const html = extractFile(new Uint8Array(await response.arrayBuffer()), "index.html");
    expect(html).toContain("Edición Especial");
  });

  it("is deterministic: the same document produces byte-identical ZIPs", async () => {
    const first = await POST(request({ document: REAL_DOCUMENT }));
    const second = await POST(request({ document: REAL_DOCUMENT }));
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(
      new Uint8Array(await second.arrayBuffer()),
    );
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/download", { method: "POST", body: "not json" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a missing document", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });

  it("rejects a document that fails schema validation", async () => {
    const response = await POST(request({ document: { nonsense: true } }));
    expect(response.status).toBe(400);
  });

  it("rejects a request whose declared Content-Length is over the cap", async () => {
    const response = await POST(
      new Request("http://localhost/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": String(1024 * 1024) },
        body: JSON.stringify({ document: REAL_DOCUMENT }),
      }),
    );
    expect(response.status).toBe(413);
  });

  describe("a document a real client would never produce", () => {
    it("rejects an unknown catalog section id", async () => {
      const withBadSection: RetorikaDocument = {
        ...REAL_DOCUMENT,
        pages: [
          {
            ...(REAL_DOCUMENT.pages[0] as RetorikaDocument["pages"][number]),
            sections: [
              {
                ...findSection(REAL_DOCUMENT, "cover"),
                preset: { catalogId: "not-a-real-section", variantId: "x" },
              },
            ],
          },
        ],
      };
      const response = await POST(request({ document: withBadSection }));
      expect(response.status).toBe(400);
    });

    it("rejects a cover missing its required headline, which fails its own preset", async () => {
      // checkAgainstPreset judges top-level slots, not a list's item count (that guard lives in
      // the generator instead, per ADR 0013) — so this has to be a slot a preset actually
      // declares cardinality for. The cover's headline is required, 1..1.
      const cover = findSection(REAL_DOCUMENT, "cover");
      const stripped: Section = {
        ...cover,
        content: cover.content.filter((el) => el.slot !== "headline"),
      };
      const withoutHeadline: RetorikaDocument = {
        ...REAL_DOCUMENT,
        pages: [
          {
            ...(REAL_DOCUMENT.pages[0] as RetorikaDocument["pages"][number]),
            sections:
              REAL_DOCUMENT.pages[0]?.sections.map((s) => (s.id === cover.id ? stripped : s)) ?? [],
          },
        ],
      };
      const response = await POST(request({ document: withoutHeadline }));
      expect(response.status).toBe(400);
    });

    it("rejects a field exceeding the length cap", async () => {
      const cover = findSection(REAL_DOCUMENT, "cover");
      const overlong: RetorikaDocument = {
        ...REAL_DOCUMENT,
        pages: [
          {
            ...(REAL_DOCUMENT.pages[0] as RetorikaDocument["pages"][number]),
            sections:
              REAL_DOCUMENT.pages[0]?.sections.map((s) =>
                s.id === cover.id
                  ? {
                      ...s,
                      content: s.content.map((el) =>
                        el.id === "el-headline" && el.value?.kind === "text"
                          ? { ...el, value: { ...el.value, text: "x".repeat(5000) } }
                          : el,
                      ),
                    }
                  : s,
              ) ?? [],
          },
        ],
      };
      const response = await POST(request({ document: overlong }));
      expect(response.status).toBe(413);
    });

    it("rejects a document with far more sections than any real one has", async () => {
      const cover = findSection(REAL_DOCUMENT, "cover");
      const manySections = Array.from({ length: 41 }, (_, i) => ({
        ...cover,
        id: `${cover.id}-${i}`,
      }));
      const withTooMany: RetorikaDocument = {
        ...REAL_DOCUMENT,
        pages: [
          {
            ...(REAL_DOCUMENT.pages[0] as RetorikaDocument["pages"][number]),
            sections: manySections,
          },
        ],
      };
      const response = await POST(request({ document: withTooMany }));
      expect(response.status).toBe(413);
    });
  });
  describe("a button that points nowhere", () => {
    /** The contact section's main action, with whatever href the test wants to try. */
    function withContactHref(href: string): RetorikaDocument {
      const page = REAL_DOCUMENT.pages[0];
      if (!page) throw new Error("no page in the fixture");
      return {
        ...REAL_DOCUMENT,
        pages: [
          {
            ...page,
            sections: page.sections.map((section) =>
              section.preset.catalogId !== "contact"
                ? section
                : {
                    ...section,
                    content: section.content.map((element) =>
                      element.value?.kind === "link" && element.slot === "primaryAction"
                        ? { ...element, value: { ...element.value, href } }
                        : element,
                    ),
                  },
            ),
          },
        ],
      };
    }

    it("lets a contact section with a real destination through", async () => {
      // The one the questionnaire actually produced, and the one inserting "Contacto y
      // reservas" from the editor re-uses: it carries question 5's own answer.
      const response = await POST(request({ document: REAL_DOCUMENT }));
      expect(response.status).toBe(200);
    });

    it("refuses a document whose main action has an empty destination", async () => {
      const response = await POST(request({ document: withContactHref("") }));
      expect(response.status).toBe(400);
    });

    it("refuses a bare # too, which navigates nowhere just the same", async () => {
      const response = await POST(request({ document: withContactHref("#") }));
      expect(response.status).toBe(400);
    });

    it("names the section and the label, so the refusal can be acted on", async () => {
      const response = await POST(request({ document: withContactHref("") }));
      const message = await response.text();
      expect(message).toContain("sec-contact");
      expect(message).toContain("primaryAction");
    });

    it("says how many more there are when several point nowhere", async () => {
      const dead = withContactHref("");
      const page = dead.pages[0];
      if (!page) throw new Error("no page in the fixture");
      const contact = page.sections.find((section) => section.preset.catalogId === "contact");
      if (!contact) throw new Error("no contact section in the fixture");
      const twice: RetorikaDocument = {
        ...dead,
        pages: [{ ...page, sections: [...page.sections, { ...contact, id: "sec-contact-2" }] }],
      };
      const message = await (await POST(request({ document: twice }))).text();
      expect(message).toContain("1 more");
    });

    it("says nothing about a dead link nobody can see", async () => {
      // Rule 3 parks a hidden element rather than deleting it; the renderer drops it, so it
      // never reaches the published page and cannot break anything there.
      const dead = withContactHref("");
      const page = dead.pages[0];
      if (!page) throw new Error("no page in the fixture");
      const hidden: RetorikaDocument = {
        ...dead,
        pages: [
          {
            ...page,
            sections: page.sections.map((section) =>
              section.preset.catalogId !== "contact"
                ? section
                : {
                    ...section,
                    content: section.content.map((element) =>
                      element.slot === "primaryAction" ? { ...element, hidden: true } : element,
                    ),
                  },
            ),
          },
        ],
      };
      // Hiding a 1..1 slot is legal (checkAgainstPreset counts hidden towards the minimum),
      // so what is left to judge is only the dead link, and it is not on the page.
      expect((await POST(request({ document: hidden }))).status).toBe(200);
    });
  });
  describe("a button pointing at a section that was deleted", () => {
    /** Exactly what the editor produces for "que vengan al local": a cover whose main button
     * anchors down the page to the address. Sprint 2 lets the owner delete that section. */
    const VISITING: RetorikaDocument = generate({
      ...EMPTY_ANSWERS,
      businessName: "Taberna Santo Domingo",
      sector: "restaurante-bar",
      services: ["Comidas"],
      address: "Cta. de Santo Domingo, 2, Ronda",
      mainAction: "visit",
    }).document;

    function without(doc: RetorikaDocument, catalogId: string): RetorikaDocument {
      const page = doc.pages[0];
      if (!page) throw new Error("no page in the fixture");
      return {
        ...doc,
        pages: [
          { ...page, sections: page.sections.filter((s) => s.preset.catalogId !== catalogId) },
        ],
      };
    }

    it("downloads fine while the section is still there", async () => {
      const response = await POST(request({ document: VISITING }));
      expect(response.status).toBe(200);
    });

    it("refuses once that section is deleted, though the href is neither empty nor #", async () => {
      // The whole point of widening the rule: `#sec-location` looks like a real destination to
      // every check that existed before anchors did.
      const response = await POST(request({ document: without(VISITING, "location") }));
      expect(response.status).toBe(400);
    });

    it("names the button, so the refusal can be acted on", async () => {
      const message = await (
        await POST(request({ document: without(VISITING, "location") }))
      ).text();
      expect(message).toContain("sec-cover");
      expect(message).toContain("Visítanos");
    });

    it("still refuses when the section is deleted and re-added under a different id", async () => {
      // Duplicating or re-inserting mints a fresh id (sprint 2, day 5 and day 6), so a section
      // that looks the same to a person does not resurrect the anchor.
      const gone = without(VISITING, "location");
      const page = VISITING.pages[0];
      const location = page?.sections.find((s) => s.preset.catalogId === "location");
      const gonePage = gone.pages[0];
      if (!page || !location || !gonePage) throw new Error("no fixture");
      const readded: RetorikaDocument = {
        ...gone,
        pages: [
          { ...gonePage, sections: [...gonePage.sections, { ...location, id: "sec-location-2" }] },
        ],
      };
      expect((await POST(request({ document: readded }))).status).toBe(400);
    });
  });
});
