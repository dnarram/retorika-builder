import sharp from "sharp";
import {
  type DraftImageRecord,
  draftImageRecordSchema,
  MAX_IMAGE_BYTES,
  MIN_COVER_HEIGHT,
  MIN_COVER_WIDTH,
} from "../src/schema.ts";
import { generationFromXmp, readPngInfo } from "./png.ts";

/**
 * One generated PNG turned into one draft record and one WebP, the way ADR 0011's circuit asks and
 * ADR 0035's floor requires — **and nothing invented along the way.**
 *
 * What this reads off the file: the dimensions, and the prompt, model and seed the generating tool
 * wrote into the XMP. What it is told: the sector, the `alt` (a reviewed text that reaches the page
 * and, since ADR 0039, the gallery's caption — never derived from the prompt), the date the
 * licence terms were read, and the date the picture was generated. What it refuses, by name: a
 * file with no generation record (the prompt is not guessed), a picture under the floor (never
 * enlarged — a regeneration is the owner's, ADR 0035), a model whose licence is not on record,
 * and a WebP over the cap at quality 75 (the quality is not quietly lowered).
 *
 * **Alpha is flattened over white before encoding** (David's adjustment to the sprint 19 plan): a
 * WebP with alpha is a VP8X container, which `bank.test.ts`'s own header reader refuses, and a
 * sample photograph has no honest use for transparency. Said in the notes rather than done in
 * silence.
 */

/** The ceiling ADR 0011 set for weight in the client's ZIP: the longest side, in pixels. */
export const LONGEST_SIDE = 1600;
export const WEBP_QUALITY = 75;

/** A refusal the person at the keyboard has to act on; never a bug. */
export class IntakeRefusal extends Error {
  override readonly name = "IntakeRefusal";
}

/**
 * The models whose terms have been read, with the attribution the record carries. A model not
 * here is refused rather than given a licence somebody did not check — the licence is the part
 * ADR 0011 says cannot be fixed later.
 */
export const KNOWN_MODELS: readonly {
  /** Matched against the model file name the tool recorded, case-insensitively. */
  matches: RegExp;
  attribution: string;
  licence: { name: string; url: string };
}[] = [
  {
    matches: /z_image_turbo/i,
    attribution: "Z-Image-Turbo, Tongyi-MAI",
    licence: { name: "Apache License 2.0", url: "https://huggingface.co/Tongyi-MAI/Z-Image-Turbo" },
  },
];

export interface IntakeInput {
  png: Buffer;
  sector: string;
  alt: string;
  /** The date the licence terms were read, for the exact tool and plan — never today by default. */
  checked: string;
  /** The date the picture was generated. */
  generated: string;
  /** The date of the draft, which is the day this runs. */
  today: string;
  /** Every id already used in `bank/` and `drafts/`, so the minted one is new. */
  taken: Iterable<string>;
}

export interface IntakeResult {
  record: DraftImageRecord;
  webp: Buffer;
  /** What was done that the reviewer should know: a flatten, a downsize. */
  notes: string[];
  /** What only a person can check, repeated so it is in front of them. */
  forTheReviewer: string[];
}

/** `<sector>.NN`, one above the highest in use for that sector, two digits. */
export function nextId(sector: string, taken: Iterable<string>): string {
  let highest = 0;
  for (const id of taken) {
    const match = new RegExp(`^${sector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(\\d+)$`).exec(
      id,
    );
    if (match?.[1]) highest = Math.max(highest, Number.parseInt(match[1], 10));
  }
  return `${sector}.${String(highest + 1).padStart(2, "0")}`;
}

function isSimpleVp8(webp: Buffer): boolean {
  return (
    webp.subarray(0, 4).toString("ascii") === "RIFF" &&
    webp.subarray(8, 12).toString("ascii") === "WEBP" &&
    webp.subarray(12, 16).toString("ascii") === "VP8 "
  );
}

export async function intake(input: IntakeInput): Promise<IntakeResult> {
  const info = readPngInfo(input.png);
  if (info.xmp === undefined) {
    throw new IntakeRefusal(
      "the PNG carries no XMP, so the prompt is not in the file and will not be invented (commit e485ffa is why)",
    );
  }
  const generation = generationFromXmp(info.xmp);
  if (!generation) {
    throw new IntakeRefusal("the XMP carries no prompt in exif:UserComment or dc:description");
  }
  if (info.width < MIN_COVER_WIDTH || info.height < MIN_COVER_HEIGHT) {
    throw new IntakeRefusal(
      `${info.width}x${info.height} is under the ${MIN_COVER_WIDTH}x${MIN_COVER_HEIGHT} floor (ADR 0035); ` +
        "regenerate it at 1600x1072 — it is never enlarged here",
    );
  }
  const known = KNOWN_MODELS.find((candidate) => candidate.matches.test(generation.model ?? ""));
  if (!known) {
    throw new IntakeRefusal(
      `model "${generation.model ?? "(none recorded)"}" has no licence on record; read its terms ` +
        "and add it to KNOWN_MODELS, because the licence is the part that cannot be fixed later",
    );
  }
  if (input.alt.trim() === "") throw new IntakeRefusal("an alt is required: it reaches the page");

  const notes: string[] = [];
  const hasAlpha = info.colourType === 4 || info.colourType === 6;
  if (hasAlpha) notes.push("alpha channel flattened over white");
  if (Math.max(info.width, info.height) > LONGEST_SIDE) {
    notes.push(
      `downsized from ${info.width}x${info.height} to ${LONGEST_SIDE} px on the longest side`,
    );
  }

  let pipeline = sharp(input.png);
  if (hasAlpha) pipeline = pipeline.flatten({ background: "#ffffff" });
  const { data, info: out } = await pipeline
    .resize({
      width: LONGEST_SIDE,
      height: LONGEST_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true });
  const webp = Buffer.from(data);
  if (!isSimpleVp8(webp)) {
    throw new IntakeRefusal(
      "the encoder produced a VP8X or VP8L container, which the bank does not read",
    );
  }
  if (webp.byteLength > MAX_IMAGE_BYTES) {
    throw new IntakeRefusal(
      `${(webp.byteLength / 1024).toFixed(1)} KB at quality ${WEBP_QUALITY} is over the ` +
        `${MAX_IMAGE_BYTES / 1024} KB cap; the quality is not lowered in silence — crop or regenerate`,
    );
  }
  if (out.width < MIN_COVER_WIDTH || out.height < MIN_COVER_HEIGHT) {
    throw new IntakeRefusal(
      `${out.width}x${out.height} after fitting ${LONGEST_SIDE} px is under the floor; the picture is too tall for the cover box`,
    );
  }

  const id = nextId(input.sector, input.taken);
  const tool = `${generation.creatorTool ?? "unknown tool"} · ${generation.model} (${known.attribution})`;
  const record = draftImageRecordSchema.parse({
    id,
    sector: input.sector,
    alt: input.alt.trim(),
    file: `${id}.webp`,
    width: out.width,
    height: out.height,
    bytes: webp.byteLength,
    origin: { tool, generated: input.generated, prompt: generation.prompt },
    licence: {
      name: known.licence.name,
      url: known.licence.url,
      checked: input.checked,
      commercialUse: true,
      clientsMayPublish: true,
    },
    review: { status: "draft", drafted: input.today },
  });
  return {
    record,
    webp,
    notes,
    forTheReviewer: [
      "no recognisable person: no face, no tattoo, no identifying feature",
      "no brand, logo or lettering, including the garbled pseudo-text on signs",
      "no artefact: extra fingers, warped tools, impossible objects",
      "plausible for a small business in Spain",
    ],
  };
}
