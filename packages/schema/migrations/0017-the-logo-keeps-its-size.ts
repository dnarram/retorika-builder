/**
 * The logo keeps its size (ADR 0059, note of sprint 30 día 7): `header.brand.logo` may carry the
 * `width` and `height` the editor kept it at, so the published `<img>` has both and the name beside
 * it does not move when the logo's bytes arrive.
 *
 * **`up` seals and moves nothing.** Both keys are optional and absent on every document written
 * before today, so a 1.15.0 document is already a valid 1.16.0 one — the shape of `0015` and `0016`.
 * Nothing here could fill them in either: the size lives in the logo's bytes, which a migration
 * never sees. A logo saved between día 5 and today keeps publishing as it did — 40px tall, its width
 * found on arrival — until its owner uploads it again. The affected set is counted rather than
 * assumed: one corpus fixture below this version carries a logo, `cabecera-con-marca`, and it was
 * moved to 1.16.0 with its size the same day. Counted 29 October 2026.
 *
 * **`down` is lossy and says so.** 1.15.0 has nowhere to keep the size, so both keys go and the logo
 * keeps its file: what is left is the logo as día 5 stored it.
 */

const migration = {
  version: "1.16.0",
  description: "A logo may carry the width and height it was kept at (ADR 0059, sprint 30 día 7).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.16.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const header = input["header"] as Record<string, unknown> | undefined;
    const brand = header?.["brand"] as Record<string, unknown> | undefined;
    const logo = brand?.["logo"] as Record<string, unknown> | undefined;
    if (header === undefined || brand === undefined || logo === undefined) {
      return { ...input, schemaVersion: "1.15.0" };
    }
    const { width: _width, height: _height, ...file } = logo;
    return {
      ...input,
      header: { ...header, brand: { ...brand, logo: file } },
      schemaVersion: "1.15.0",
    };
  },
} as const;

export default migration;
