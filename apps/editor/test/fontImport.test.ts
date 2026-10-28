import { describe, expect, it } from "vitest";
import {
  fileRefusalText,
  type InspectedFile,
  nameProblem,
  noteText,
  planImport,
  refusalText,
  requestInspection,
} from "../src/editor/fontImport.ts";
import type { FontInspection } from "../src/editor/fontInspect.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the import dialog makes of the files the owner chose (sprint 29 día 5): David's condition
 * 3 — a variable covers «Negrita» only if its axis reaches 700, and «Normal» only if it includes 400
 * — and the three shapes the schema admits, with every other combination refused in words.
 */

function file(name: string, inspection: Partial<FontInspection>): InspectedFile {
  return {
    name,
    inspection: {
      format: "woff2",
      name: "Casa Trufa",
      sanitised: "Casa Trufa",
      hasFvar: false,
      wght: null,
      weight: 400,
      italic: false,
      bytes: 40_000,
      ...inspection,
    },
  };
}

describe("planImport — the faces", () => {
  it("makes one static file a regular, and says the bold will be synthesised", () => {
    const result = planImport([file("casa.ttf", { format: "ttf" })], []);
    expect(result).toEqual({
      ok: true,
      plan: {
        faces: [{ face: { role: "regular", format: "ttf" }, from: 0 }],
        original: "Casa Trufa",
        family: "Casa Trufa",
        notes: [{ kind: "noBold" }],
      },
    });
  });

  it("orders two files by weight, whichever was chosen first", () => {
    const result = planImport(
      [file("bold.woff", { format: "woff", weight: 700 }), file("regular.woff2", { weight: 400 })],
      [],
    );
    expect(result.ok && result.plan.faces).toEqual([
      { face: { role: "regular", format: "woff2" }, from: 1 },
      { face: { role: "bold", format: "woff" }, from: 0 },
    ]);
    expect(result.ok && result.plan.notes).toEqual([]);
  });

  it("covers both weights with a 300–800 variable, and says so", () => {
    const result = planImport([file("v.woff2", { hasFvar: true, wght: [300, 800] })], []);
    expect(result.ok && result.plan.faces).toEqual([
      { face: { role: "variable", format: "woff2", wght: [300, 800] }, from: 0 },
    ]);
    expect(result.ok && result.plan.notes).toEqual([{ kind: "variable" }]);
  });

  it("says a 500–900 variable has no «Normal», naming where it starts", () => {
    const result = planImport([file("v.woff2", { hasFvar: true, wght: [500, 900] })], []);
    expect(result.ok && result.plan.notes).toEqual([{ kind: "variableNoRegular", min: 500 }]);
    expect(noteText({ kind: "variableNoRegular", min: 500 })).toContain("empieza en 500");
  });

  it("says a 100–600 variable never reaches the bold", () => {
    const result = planImport([file("v.woff2", { hasFvar: true, wght: [100, 600] })], []);
    expect(result.ok && result.plan.notes).toEqual([{ kind: "variableNoBold", max: 600 }]);
  });

  it("treats a variable file with no weight axis as the static face it draws", () => {
    const result = planImport([file("w.ttf", { format: "ttf", hasFvar: true, wght: null })], []);
    expect(result.ok && result.plan.faces[0]?.face.role).toBe("regular");
  });
});

describe("planImport — the refusals", () => {
  it.each([
    ["no file", [], "tooMany"],
    [
      "three files",
      [file("a", {}), file("b", { weight: 700 }), file("c", { weight: 900 })],
      "tooMany",
    ],
    [
      "a variable beside a static",
      [file("v", { wght: [100, 900] }), file("b", { weight: 700 })],
      "variablePair",
    ],
    ["two of one weight", [file("a", {}), file("b", {})], "sameWeight"],
    ["two families", [file("a", {}), file("b", { name: "Otra", weight: 700 })], "twoFamilies"],
  ] as const)("refuses %s", (_, files, reason) => {
    const result = planImport(files, []);
    expect(result.ok ? undefined : result.refusal.reason).toBe(reason);
    if (!result.ok) expect(refusalText(result.refusal)).not.toBe("");
  });
});

describe("planImport — the name and the notes", () => {
  it("gives a gallery family's own file a numeral and keeps the original for the sentence", () => {
    const result = planImport(
      [file("Karla-Regular.woff2", { name: "Karla", sanitised: "Karla" })],
      [],
    );
    expect(result.ok && result.plan).toMatchObject({ original: "Karla", family: "Karla 2" });
    const taken = planImport(
      [file("x", { name: "Karla", sanitised: "Karla" })],
      [{ family: "Karla 2" }],
    );
    expect(taken.ok && taken.plan.family).toBe("Karla 3");
  });

  it("starts from the default name when nothing in the file survives sanitising", () => {
    const result = planImport([file("x.otf", { name: "你好", sanitised: "" })], []);
    expect(result.ok && result.plan.family).toBe(es["editor.font.import.nameDefault"]);
  });

  it("warns above 300 KB per file, and not at it, and says an italic leans", () => {
    const result = planImport(
      [
        file("pesada.ttf", { format: "ttf", bytes: 300 * 1024 + 1, weight: 400 }),
        file("justa.ttf", { format: "ttf", bytes: 300 * 1024, weight: 700, italic: true }),
      ],
      [],
    );
    expect(result.ok && result.plan.notes).toEqual([
      { kind: "italic", file: "justa.ttf" },
      { kind: "heavy", file: "pesada.ttf", kb: 300, woff2: false },
    ]);
  });

  it("advises a .woff2 only to a file that is not one already", () => {
    expect(noteText({ kind: "heavy", file: "a.ttf", kb: 400, woff2: false })).toMatch(/\.woff2/);
    expect(noteText({ kind: "heavy", file: "a.woff2", kb: 400, woff2: true })).not.toMatch(
      /\.woff2 suele/,
    );
  });

  it("says why a typed name cannot travel, in two different sentences", () => {
    expect(nameProblem("Casa Trufa", [])).toBeUndefined();
    expect(nameProblem("Casa_Trufa", [])).toBe(es["editor.font.import.nameInvalid"]);
    expect(nameProblem("Señorío", [])).toBe(es["editor.font.import.nameInvalid"]);
    expect(nameProblem("inter", [])).toBe(es["editor.font.import.nameTaken"]);
    expect(nameProblem("Casa", [{ family: "casa" }])).toBe(es["editor.font.import.nameTaken"]);
  });
});

describe("requestInspection", () => {
  const WOFF2 = Uint8Array.from("wOF2\0\x01\0\0", (char) => char.charCodeAt(0));
  const answering = (status: number, body: unknown) =>
    (async () => Response.json(body, { status })) as unknown as typeof fetch;
  const never = (async () => {
    throw new Error("the route must not be asked");
  }) as unknown as typeof fetch;

  it("refuses a collection, a page and an oversized file without asking the route", async () => {
    const ttc = Uint8Array.from("ttcf\0\x02", (char) => char.charCodeAt(0));
    expect(await requestInspection(ttc, never)).toEqual({ ok: false, refusal: "collection" });
    expect(await requestInspection(new TextEncoder().encode("<svg/>"), never)).toEqual({
      ok: false,
      refusal: "notAFont",
    });
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(WOFF2);
    expect(await requestInspection(big, never)).toEqual({ ok: false, refusal: "tooLarge" });
  });

  it("reads the route's answer: the inspection, its refusal, the shared limit, anything else", async () => {
    const inspection = { format: "woff2", name: "Casa", sanitised: "Casa" };
    expect(await requestInspection(WOFF2, answering(200, inspection))).toEqual({
      ok: true,
      inspection,
    });
    expect(await requestInspection(WOFF2, answering(422, { reason: "collection" }))).toEqual({
      ok: false,
      refusal: "collection",
    });
    expect(await requestInspection(WOFF2, answering(429, {}))).toEqual({
      ok: false,
      refusal: "busy",
    });
    expect(await requestInspection(WOFF2, answering(403, {}))).toEqual({
      ok: false,
      refusal: "failed",
    });
    expect(fileRefusalText("busy", "x")).toBe(es["editor.font.import.refuse.busy"]);
    expect(fileRefusalText("tooLarge", "casa.ttf")).toContain("«casa.ttf»");
  });
});
