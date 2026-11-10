/**
 * The brand has a size and a place (ADR 0069 and 0070, sprint 35 día 4): `header.brand.logoSize`
 * (`sm` | `md` | `lg`), `header.brand.nameSize` (`body` | `subheading` | `heading`) and
 * `header.brand.place` (`start` | `center` | `end`), each an owner's word and each optional.
 *
 * **`up` seals and moves nothing.** The three keys are optional and absent on every document written
 * before today, and absent they draw exactly what every bar drew before — the logo 40 px tall, the
 * name at the reading size, the brand where its layout put it — so a 1.18.0 document is already a
 * valid 1.19.0 one: the shape of `0017` and `0019`. The affected set is counted rather than assumed:
 * no corpus fixture stamped below 1.19.0 carries any of the three. Counted 10 November 2026.
 *
 * **`down` is lossy and says so.** 1.18.0 has nowhere to keep a size or a place, so the three keys go
 * and the brand keeps its name and its logo: what is left is the bar as it published the day before.
 */

const migration = {
  version: "1.19.0",
  description:
    "The brand has a size and a place: logoSize, nameSize and place on header.brand (ADR 0069 and 0070, sprint 35 día 4).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.19.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const header = input["header"] as Record<string, unknown> | undefined;
    const brand = header?.["brand"] as Record<string, unknown> | undefined;
    if (
      header === undefined ||
      brand === undefined ||
      !("logoSize" in brand || "nameSize" in brand || "place" in brand)
    ) {
      return { ...input, schemaVersion: "1.18.0" };
    }
    const { logoSize: _size, nameSize: _name, place: _place, ...rest } = brand;
    return { ...input, header: { ...header, brand: rest }, schemaVersion: "1.18.0" };
  },
} as const;

export default migration;
