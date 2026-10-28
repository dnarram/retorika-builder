import {
  FONT_FAMILY_PATTERN,
  type FontKind,
  type OwnFont,
  type OwnFontFace,
  ownFamilyIssue,
  ownFontCovers,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import {
  freeFamilyName,
  HEAVY_FONT_BYTES,
  isOwnFontFormat,
  MAX_FONT_BYTES,
  MAX_FONT_FILES,
  sniffFont,
} from "./fontBytes.ts";
import type { FontInspection } from "./fontInspect.ts";

/**
 * What the import dialog makes of the one or two files the owner chose (sprint 29 día 5): which
 * face each one is, the name the font will travel under, and every sentence the dialog owes them
 * before «Añadir». **A module and not JSX**, for the reason `fontChooser.ts` is one — every answer
 * is arithmetic over what the server read from the files, and the dialog renders it.
 *
 * `FontInspection` is a type-only import: `fontInspect.ts` needs `node:zlib` and is never bundled
 * into the browser, but the shape the route answers with is the shape this reads.
 */

/** One chosen file and what the inspection route said about it. */
export interface InspectedFile {
  /** The owner's file name, shown back to them in a sentence and never used for anything else. */
  name: string;
  inspection: FontInspection;
}

export type ImportRefusal =
  | { reason: "tooMany" }
  | { reason: "variablePair" }
  | { reason: "twoFamilies"; first: string; second: string }
  | { reason: "sameWeight" };

export type ImportNote =
  | { kind: "variable" }
  | { kind: "variableNoRegular"; min: number }
  | { kind: "variableNoBold"; max: number }
  | { kind: "noBold" }
  | { kind: "italic"; file: string }
  /** `woff2` says whether the advice to convert applies: a WOFF2 is already the lightest format. */
  | { kind: "heavy"; file: string; kb: number; woff2: boolean };

export interface ImportPlan {
  /** The faces the record will hold, in the schema's order, each with the index of the file it
   * comes from in the list the owner chose. */
  faces: { face: OwnFontFace; from: number }[];
  /** The name read from the files, before any numeral: what «{original}» says in a rename note. */
  original: string;
  /** The name it will travel under unless the owner types another: free beside the gallery and the
   * document's own fonts. */
  family: string;
  notes: ImportNote[];
}

export type ImportResult = { ok: true; plan: ImportPlan } | { ok: false; refusal: ImportRefusal };

/** The weight a file declares, with a file that says nothing read as a regular. */
function weightOf(file: InspectedFile): number {
  return file.inspection.weight ?? 400;
}

function isVariable(file: InspectedFile): boolean {
  return file.inspection.wght !== null;
}

/**
 * The faces, from the files: one variable file is `[variable]` with the range `fvar` gave; one
 * static file is `[regular]`; two static files of one family are `[regular, bold]`, the lighter
 * first by their weight class. Everything else is refused with the sentence that says why — the
 * three shapes are the schema's, and the dialog must not hand it a fourth.
 *
 * A file with `fvar` and no `wght` axis is its default instance, a static face: what it varies is
 * not the weight the page reads.
 */
function facesOf(
  files: readonly InspectedFile[],
): { faces: ImportPlan["faces"] } | { refusal: ImportRefusal } {
  if (files.length === 0 || files.length > MAX_FONT_FILES)
    return { refusal: { reason: "tooMany" } };
  const [first, second] = files as [InspectedFile, InspectedFile | undefined];
  if (second === undefined) {
    const wght = first.inspection.wght;
    return {
      faces: [
        wght === null
          ? { face: { role: "regular", format: first.inspection.format }, from: 0 }
          : { face: { role: "variable", format: first.inspection.format, wght }, from: 0 },
      ],
    };
  }
  if (isVariable(first) || isVariable(second)) return { refusal: { reason: "variablePair" } };
  if (first.inspection.name.toLowerCase() !== second.inspection.name.toLowerCase()) {
    return {
      refusal: {
        reason: "twoFamilies",
        first: first.inspection.name,
        second: second.inspection.name,
      },
    };
  }
  if (weightOf(first) === weightOf(second)) return { refusal: { reason: "sameWeight" } };
  const [regular, bold] = weightOf(first) < weightOf(second) ? [0, 1] : [1, 0];
  return {
    faces: [
      {
        face: { role: "regular", format: (files[regular] as InspectedFile).inspection.format },
        from: regular,
      },
      {
        face: { role: "bold", format: (files[bold] as InspectedFile).inspection.format },
        from: bold,
      },
    ],
  };
}

export function planImport(
  files: readonly InspectedFile[],
  existing: readonly Pick<OwnFont, "family">[],
): ImportResult {
  const shape = facesOf(files);
  if ("refusal" in shape) return { ok: false, refusal: shape.refusal };

  const notes: ImportNote[] = [];
  // What the font covers is the schema's own derivation, so the note and the page cannot disagree.
  const covers = ownFontCovers({ faces: shape.faces.map(({ face }) => face) });
  const variable = shape.faces[0]?.face.role === "variable" ? shape.faces[0].face : undefined;
  if (variable !== undefined && variable.role === "variable") {
    if (covers.regular && covers.bold) notes.push({ kind: "variable" });
    if (!covers.regular) notes.push({ kind: "variableNoRegular", min: variable.wght[0] });
    if (!covers.bold) notes.push({ kind: "variableNoBold", max: variable.wght[1] });
  } else if (!covers.bold) {
    notes.push({ kind: "noBold" });
  }
  for (const file of files) {
    if (file.inspection.italic) notes.push({ kind: "italic", file: file.name });
  }
  for (const file of files) {
    if (file.inspection.bytes > HEAVY_FONT_BYTES) {
      notes.push({
        kind: "heavy",
        file: file.name,
        kb: Math.round(file.inspection.bytes / 1024),
        woff2: file.inspection.format === "woff2",
      });
    }
  }

  const original = files[0]?.inspection.sanitised || es["editor.font.import.nameDefault"];
  return {
    ok: true,
    plan: { faces: shape.faces, original, family: freeFamilyName(original, existing), notes },
  };
}

/** The sentence for a note, in the dialog's words. */
export function noteText(note: ImportNote): string {
  switch (note.kind) {
    case "variable":
      return es["editor.font.import.note.variable"];
    case "variableNoRegular":
      return es["editor.font.import.note.variableNoRegular"].replace("{min}", String(note.min));
    case "variableNoBold":
      return es["editor.font.import.note.variableNoBold"].replace("{max}", String(note.max));
    case "noBold":
      return es["editor.font.import.note.noBold"];
    case "italic":
      return es["editor.font.import.note.italic"].replace("{file}", note.file);
    case "heavy":
      return es[note.woff2 ? "editor.font.import.note.heavyWoff2" : "editor.font.import.note.heavy"]
        .replace("{file}", note.file)
        .replace("{kb}", String(note.kb));
  }
}

export function refusalText(refusal: ImportRefusal): string {
  switch (refusal.reason) {
    case "tooMany":
      return es["editor.font.import.refuse.tooMany"];
    case "variablePair":
      return es["editor.font.import.refuse.variablePair"];
    case "sameWeight":
      return es["editor.font.import.refuse.sameWeight"];
    case "twoFamilies":
      return es["editor.font.import.refuse.twoFamilies"]
        .replace("{first}", refusal.first)
        .replace("{second}", refusal.second);
  }
}

/**
 * What is wrong with a name the owner typed, in their words, or `undefined` when it can travel.
 * The schema's own reasons, said two ways: a shape this product cannot write into CSS, or a name
 * another letter already has — the gallery's, a keyword, or the document's other font.
 */
export function nameProblem(
  family: string,
  existing: readonly Pick<OwnFont, "family">[],
): string | undefined {
  if (!FONT_FAMILY_PATTERN.test(family)) return es["editor.font.import.nameInvalid"];
  return ownFamilyIssue(family, existing) === undefined
    ? undefined
    : es["editor.font.import.nameTaken"];
}

/** The species a new font starts on until the owner presses another chip. Nothing in a file says
 * reliably whether it has serifs, so the dialog asks, and starts where most brand letters are. */
export const DEFAULT_KIND: FontKind = "sans";

/** Why a file did not become an inspection, before or at the server. */
export type FileRefusal = "tooLarge" | "notAFont" | "collection" | "busy" | "failed";

export type InspectAnswer =
  | { ok: true; inspection: FontInspection }
  | { ok: false; refusal: FileRefusal };

/**
 * One file's bytes to the inspection route, and the answer as the dialog needs it.
 *
 * **Sniffed here first**, with the same signatures the route uses: a collection or a page renamed
 * `.ttf` is refused without a request, and the 2 MB cap is the route's own number. The route checks
 * all of it again — the button is the convenience and the route the guarantee — and its 422 says
 * which refusal; a 429 is the shared limit, which says «wait a minute», not «your file is wrong».
 */
export async function requestInspection(
  bytes: Uint8Array,
  fetcher: typeof fetch = fetch,
): Promise<InspectAnswer> {
  if (bytes.byteLength > MAX_FONT_BYTES) return { ok: false, refusal: "tooLarge" };
  const kind = sniffFont(bytes);
  if (kind === "collection") return { ok: false, refusal: "collection" };
  if (!isOwnFontFormat(kind)) return { ok: false, refusal: "notAFont" };
  let response: Response;
  try {
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    response = await fetcher("/api/fuentes/inspeccionar", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body,
    });
  } catch {
    return { ok: false, refusal: "failed" };
  }
  if (response.ok) return { ok: true, inspection: (await response.json()) as FontInspection };
  if (response.status === 413) return { ok: false, refusal: "tooLarge" };
  if (response.status === 429) return { ok: false, refusal: "busy" };
  if (response.status === 422) {
    const { reason } = (await response.json()) as { reason?: string };
    return { ok: false, refusal: reason === "collection" ? "collection" : "notAFont" };
  }
  return { ok: false, refusal: "failed" };
}

export function fileRefusalText(refusal: FileRefusal, file: string): string {
  return es[`editor.font.import.refuse.${refusal}`].replace("{file}", file);
}
