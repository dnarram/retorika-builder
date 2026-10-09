import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bankFileSchema } from "../src/schema.ts";
import { readSampleBytes } from "../src/server.ts";

/**
 * `readSampleBytes`, against the fixture bank.
 *
 * **The one genuinely dangerous seam this package has**: it turns an id — which, once day 4 wires
 * a route to this, comes from an unauthenticated request — into a filesystem read. The mitigation
 * is structural rather than a sanitiser: the id is looked up in the parsed, validated bank first,
 * and the filename comes from the *record* that lookup finds, never from the caller's string. Both
 * cases below have to hold for that to be true, and both are exercised through the real function.
 */

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

const fixtureBank = bankFileSchema.parse(
  JSON.parse(readFileSync(join(FIXTURES_DIR, "bank.json"), "utf8")),
);

/** A stand-in for `recordById`, scoped to the fixture bank — the only way to exercise the "id
 * resolves to real bytes" case while the real bank was empty, and still the way that does not move
 * whenever the real bank grows. */
function fixtureLookup(id: string) {
  return fixtureBank.images.find((image) => image.id === id);
}

describe("readSampleBytes", () => {
  it("throws for an id the bank does not know, and reads nothing", () => {
    // Against the real bank, where this id is unknown whatever the bank holds. This is what a
    // route built on top of this function gets back for a request that invented an id.
    expect(() => readSampleBytes("no-existe")).toThrow(/no bank image "no-existe"/);
  });

  it("throws for a path-shaped id, exactly like any other unknown one", () => {
    // The traversal attempt this function is designed to refuse before it ever builds a path.
    // `recordById` fails the same way for "../../../../etc/passwd" as for anything else it does
    // not recognise — there is no separate "looks like a path" branch to get wrong.
    expect(() => readSampleBytes("../../../../etc/passwd")).toThrow(/no bank image/);
  });

  it("reads the real bytes for a known id, with the filename taken from the record it finds", () => {
    const [first] = fixtureBank.images;
    if (!first) throw new Error("fixture bank has no images");

    const bytes = readSampleBytes(first.id, FIXTURES_DIR, fixtureLookup);
    expect(bytes.byteLength).toBe(first.bytes);
    expect(Buffer.from(bytes.subarray(0, 4)).toString("ascii")).toBe("RIFF");
  });

  it("never reads a file the record did not name, even if the id looks like one", () => {
    // A lookup that resolves "id" to a record naming a completely different file. If this function
    // ever started building a path from `id` instead of from the record, this would read the wrong
    // bytes rather than throw — the strongest form of the guarantee, proved directly.
    const bytes = readSampleBytes(
      "prueba.02.webp", // an id that happens to equal the *other* record's filename
      FIXTURES_DIR,
      () => ({
        id: "prueba.02.webp",
        sector: "prueba",
        alt: "",
        file: "prueba.01.webp",
        width: 1,
        height: 1,
        bytes: 1,
        origin: { tool: "", generated: "2026-09-29", prompt: "" },
        licence: {
          name: "",
          url: "",
          checked: "2026-09-29",
          commercialUse: true,
          clientsMayPublish: true,
        },
        review: { status: "approved", by: "", date: "2026-09-29" },
      }),
    );
    const expected = readFileSync(join(FIXTURES_DIR, "prueba.01.webp"));
    expect(Buffer.from(bytes)).toEqual(expected);
  });
});
