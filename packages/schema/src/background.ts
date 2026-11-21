import { z } from "zod";
import { relativeLuminance } from "./colour.ts";

/**
 * **A background with motifs** (ADR 0081, sprint 40 día 5): a picture the owner brought — a pattern
 * made in Canva, a texture — painted under one section or under the whole site, with a veil of
 * `color.surface` over it whose opacity `veil.ts` derives from the picture's extremes when the page
 * is drawn.
 *
 * A record, not bytes, the way a photograph and the logo are (ADR 0018, ADR 0059): `src` names the
 * file the bytes are kept under, and the file travels the photographs' pipe — this browser's store,
 * the account's bucket, the ZIP's `assets/`. The two numbers are the pixels the editor saved it at;
 * `extremes` the darkest and lightest visible pixels, read at that resolution and never from a
 * sample (David's adjustment 2), so «nunca nace un fondo ilegible» is a measured claim.
 *
 * **Two ways to paint, and no third** (David's answer): `tile` repeats the picture at its own size
 * (half of it on a phone, rule 7's derivation); `cover` fills the box with it, centred. `fixed` — the
 * picture staying while the page scrolls — is not here: iOS Safari ignores it, and it is a movement
 * tied to scrolling that `prefers-reduced-motion` would have to switch off.
 */

/** Raster only, by the shape of the name, as the logo's (ADR 0059 §2): PNG keeps a motif's
 * transparency, JPEG is for one without. A bundle path or a bare file name. */
export const BACKGROUND_SRC_PATTERN = /^(?:assets\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g)$/;

/** The longest edge a background is kept at, in pixels — a photograph's bound (`photos.ts`). */
export const BACKGROUND_MAX_EDGE = 1600;

export const BACKGROUND_PAINTS = ["tile", "cover"] as const;
export type BackgroundPaint = (typeof BACKGROUND_PAINTS)[number];

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const edgeSchema = z.number().int().min(1).max(BACKGROUND_MAX_EDGE);

export const backgroundSchema = z
  .strictObject({
    src: z.string().regex(BACKGROUND_SRC_PATTERN),
    width: edgeSchema,
    height: edgeSchema,
    paint: z.enum(BACKGROUND_PAINTS),
    extremes: z.strictObject({
      darkest: z.string().regex(HEX_COLOUR),
      lightest: z.string().regex(HEX_COLOUR),
    }),
  })
  .refine(
    (value) =>
      relativeLuminance(value.extremes.darkest) <= relativeLuminance(value.extremes.lightest),
    {
      message: "A background's darkest extreme is no lighter than its lightest.",
      path: ["extremes"],
    },
  );

export type Background = z.infer<typeof backgroundSchema>;
