import type { Answers } from "@retorika/generator";
import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/download/route.ts";

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
});
