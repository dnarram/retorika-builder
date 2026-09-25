import { inflateRawSync } from "node:zlib";
import type { Answers } from "@retorika/generator";
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

/**
 * The exact shape a real walk through the questionnaire produces (mirrors the Playwright walk
 * used to verify day 4). This is the path that used to throw: the cover's placeholder image is
 * a data: URI, which buildSite rejected as an unsafe asset name until this day's fix.
 */
const ANSWERS: Omit<Answers, "logo"> = {
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar",
  otherSectorDescription: "",
  services: ["Comidas", "Cenas", "Tapas", "Terraza"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  hours: "De martes a domingo, de 13:00 a 16:00 y de 20:00 a 23:30",
  noPremises: false,
  mainAction: "book",
  bookingLink: "https://reservas.example.com/taberna",
  alsoPhone: false,
  phone: "",
  whatsapp: "",
  email: "",
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/download", () => {
  it("builds a real ZIP in memory, for each of the three variants", async () => {
    for (const variantIndex of [0, 1, 2]) {
      const response = await POST(request({ answers: ANSWERS, variantIndex }));
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

  it("is deterministic: the same answers and variant produce byte-identical ZIPs", async () => {
    const first = await POST(request({ answers: ANSWERS, variantIndex: 0 }));
    const second = await POST(request({ answers: ANSWERS, variantIndex: 0 }));
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

  it("rejects an out-of-range variantIndex", async () => {
    const response = await POST(request({ answers: ANSWERS, variantIndex: 3 }));
    expect(response.status).toBe(400);
  });

  it("rejects an unknown sector rather than passing it through silently", async () => {
    const response = await POST(
      request({ answers: { ...ANSWERS, sector: "not-a-real-sector" }, variantIndex: 0 }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an unknown mainAction rather than passing it through silently", async () => {
    const response = await POST(
      request({ answers: { ...ANSWERS, mainAction: "not-a-real-action" }, variantIndex: 0 }),
    );
    expect(response.status).toBe(400);
  });

  describe("edits (day 6)", () => {
    it("bakes a click-to-edit change into the downloaded index.html", async () => {
      const response = await POST(
        request({
          answers: ANSWERS,
          variantIndex: 0,
          edits: { "el-headline": "Taberna Santo Domingo — Edición Especial" },
        }),
      );
      expect(response.status).toBe(200);
      const html = extractFile(new Uint8Array(await response.arrayBuffer()), "index.html");
      expect(html).toContain("Taberna Santo Domingo — Edición Especial");
      expect(html).not.toContain(">\n      Taberna Santo Domingo\n    <");
    });

    it("ignores an edit whose id matches nothing in the generated document", async () => {
      const response = await POST(
        request({ answers: ANSWERS, variantIndex: 0, edits: { "no-such-id": "x" } }),
      );
      expect(response.status).toBe(200);
    });

    it("with no edits field at all, behaves exactly like day 5", async () => {
      const response = await POST(request({ answers: ANSWERS, variantIndex: 0 }));
      expect(response.status).toBe(200);
    });

    it("rejects edits that are not an object", async () => {
      const response = await POST(
        request({ answers: ANSWERS, variantIndex: 0, edits: ["not", "an", "object"] }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects a non-string edit value", async () => {
      const response = await POST(
        request({ answers: ANSWERS, variantIndex: 0, edits: { "el-headline": 12345 } }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects an edit value over the length cap", async () => {
      const response = await POST(
        request({
          answers: ANSWERS,
          variantIndex: 0,
          edits: { "el-headline": "x".repeat(2001) },
        }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects more edits than any real document has fields", async () => {
      const edits = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`el-${i}`, "text"]));
      const response = await POST(request({ answers: ANSWERS, variantIndex: 0, edits }));
      expect(response.status).toBe(400);
    });
  });
});
