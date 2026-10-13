/**
 * The two things an intake needs to read off a PNG without decoding it: its dimensions, and the
 * generation record the tool that made it wrote into its XMP.
 *
 * **Read off the chunks by hand, like `scripts/brand-assets.ts` reads IDAT**, and for the same
 * reason: no image library knows what Draw Things puts in `exif:UserComment`, and `sips` cannot
 * see it at all (checked on 13 October 2026). Commit `e485ffa` is why this exists — three of nine
 * prompts in the bank were wrong because they were copied from a prompt sheet instead of read off
 * the file, and the exact text had been in the file all along.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const XMP_KEYWORD = "XML:com.adobe.xmp";

export interface PngInfo {
  width: number;
  height: number;
  /** 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA — the IHDR colour type. */
  colourType: number;
  /** The XMP packet, when the file carries one as an uncompressed `iTXt`. */
  xmp: string | undefined;
}

export function readPngInfo(bytes: Buffer): PngInfo {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG: bad signature");
  let width = 0;
  let height = 0;
  let colourType = -1;
  let xmp: string | undefined;
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString("latin1");
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colourType = body[9] ?? -1;
    } else if (type === "iTXt") {
      const keywordEnd = body.indexOf(0);
      const keyword = body.subarray(0, keywordEnd).toString("latin1");
      const compressed = body[keywordEnd + 1] === 1;
      let cursor = keywordEnd + 3; // keyword NUL, compression flag, compression method
      cursor = body.indexOf(0, cursor) + 1; // language tag
      cursor = body.indexOf(0, cursor) + 1; // translated keyword
      if (keyword === XMP_KEYWORD && !compressed) xmp = body.subarray(cursor).toString("utf8");
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  if (colourType < 0) throw new Error("not a PNG: no IHDR");
  return { width, height, colourType, xmp };
}

/** What the generating tool recorded about a picture, read from its XMP. */
export interface Generation {
  prompt: string;
  /** The model file, e.g. `z_image_turbo_1.0_q6p.ckpt`, when the tool wrote one. */
  model: string | undefined;
  seed: number | undefined;
  /** `xmp:CreatorTool`, e.g. «Draw Things». */
  creatorTool: string | undefined;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function altText(xmp: string, element: string): string | undefined {
  const match = new RegExp(`<${element}>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)<\\/rdf:li>`).exec(xmp);
  return match?.[1] === undefined ? undefined : unescapeXml(match[1]);
}

/**
 * Draw Things writes the whole generation as JSON into `exif:UserComment` — `c` is the prompt,
 * without the `Steps: …` parameter line that `dc:description` glues onto it — and the application
 * name into `xmp:CreatorTool`. `dc:description` is the fallback for a tool that writes only that,
 * cut at the parameter line.
 */
export function generationFromXmp(xmp: string): Generation | undefined {
  const creatorTool = /<xmp:CreatorTool>([^<]*)<\/xmp:CreatorTool>/.exec(xmp)?.[1]?.trim();
  const comment = altText(xmp, "exif:UserComment");
  if (comment !== undefined) {
    try {
      const parsed = JSON.parse(comment) as Record<string, unknown>;
      const prompt = typeof parsed["c"] === "string" ? parsed["c"].trim() : "";
      if (prompt !== "") {
        return {
          prompt,
          model: typeof parsed["model"] === "string" ? parsed["model"] : undefined,
          seed: typeof parsed["seed"] === "number" ? parsed["seed"] : undefined,
          creatorTool,
        };
      }
    } catch {
      // Not JSON: fall through to the description.
    }
  }
  const description = altText(xmp, "dc:description");
  if (description === undefined) return undefined;
  const prompt = description.split(/\nSteps: /)[0]?.trim() ?? "";
  if (prompt === "") return undefined;
  return { prompt, model: undefined, seed: undefined, creatorTool };
}
