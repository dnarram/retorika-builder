/**
 * The five questions' answers — the generator's input contract.
 *
 * Lives here rather than in `apps/editor`, because a package must never depend on an app, and
 * this is what actually processes the shape. The questionnaire imports it from here instead.
 */

/** ADR 0010's ten launch sectors, in the order the screen shows them, plus "other". */
export const SECTOR_IDS = [
  "peluqueria-barberia",
  "estetica",
  "fisioterapia",
  "restaurante-bar",
  "tienda",
  "taller",
  "reformas",
  "academia",
  "fotografia",
  "asesoria",
] as const;

export type SectorId = (typeof SECTOR_IDS)[number] | "otro";

export type MainAction = "call" | "book" | "message" | "email" | "visit";

export interface Answers {
  businessName: string;
  logo: File | null;
  /**
   * The palette the logo's own colours chose, or `null` for "nothing close enough — let the sector
   * decide" (ADR 0010's «sin logo, la paleta por defecto del sector», reached by a second road).
   *
   * **A palette id, never a colour and never the logo itself.** The analysis happens in the
   * browser while the questionnaire is being filled in (`apps/editor/src/editor/logoPalette.ts`)
   * and only its conclusion travels, which is what keeps this generator a pure function of its
   * arguments — no image decoding, no canvas, no clock. `INV_5`, the golden corpus and «mismas
   * respuestas, misma web» all depend on that and none of them move.
   *
   * It also means this survives a reload while the logo does not: `autosave.ts` drops `logo`,
   * because a `File` is not serialisable, and keeps everything else.
   */
  logoPaletteId: string | null;
  /**
   * The file the logo's bytes are kept under, minted in the browser the moment the file is chosen
   * (`logo-<8 hex>.png`, ADR 0059), or `null` for no logo — or for a logo that could not be kept.
   *
   * **A name, never the bytes**, for the same reason `logoPaletteId` is an id and not a colour: the
   * generator stays a pure function of its answers, and what it writes into the document is the
   * reference the header carries (`header.brand.logo.src`). The bytes travel the path a photograph
   * travels — IndexedDB, the preview's object URL, the multipart form, the account's bucket — and
   * this is the one string that ties them to the document. Serialisable, so unlike `logo` it
   * survives a reload of the questionnaire.
   */
  logoSrc: string | null;
  sector: SectorId | null;
  otherSectorDescription: string;
  services: string[];
  address: string;
  hours: string;
  noPremises: boolean;
  mainAction: MainAction | null;
  bookingLink: string;
  /** Shared with "call": one phone number, whichever screen asks for it. */
  alsoPhone: boolean;
  phone: string;
  whatsapp: string;
  email: string;
}

export const EMPTY_ANSWERS: Answers = {
  businessName: "",
  logo: null,
  logoPaletteId: null,
  logoSrc: null,
  sector: null,
  otherSectorDescription: "",
  services: [],
  address: "",
  hours: "",
  noPremises: false,
  mainAction: null,
  bookingLink: "",
  alsoPhone: false,
  phone: "",
  whatsapp: "",
  email: "",
};
