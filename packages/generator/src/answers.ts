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

/** A logo's colours as the questionnaire reads them: the brand's tint, and a second when there is one. */
export interface LogoColours {
  brand: string;
  second: string | null;
}

export interface Answers {
  businessName: string;
  logo: File | null;
  /**
   * The logo's own colours — its dominant tint and, when it really has one, a second — or `null` for
   * no logo, or a logo with no colour in it (sprint 38 día 3, ADR 0076).
   *
   * **Colours, never the logo itself**, and read in the browser while the questionnaire is filled in
   * (`apps/editor/src/editor/logoImage.ts`, `logoColoursOf`): what travels is two hex strings, which
   * keeps this generator a pure function of its arguments — no image decoding, no canvas, no clock.
   * `INV_5`, the golden corpus and «mismas respuestas, misma web» all depend on that. It replaced
   * `logoPaletteId`, the id of the predefined palette nearest the logo, which was the defect sprint 38
   * exists to fix: the logo's colours are the brand's, and the site carries them.
   *
   * It also survives a reload while the logo does not: `autosave.ts` drops `logo`, because a `File`
   * is not serialisable, and keeps everything else. A session saved before 1.20.0 carries the old
   * field and not this one, and is restored over `EMPTY_ANSWERS`, so this reads `null` there.
   */
  logoColours: LogoColours | null;
  /**
   * The file the logo's bytes are kept under, minted in the browser the moment the file is chosen
   * (`logo-<8 hex>.png`, ADR 0059), and the size it was kept at — or `null` for no logo, or for a
   * logo that could not be kept.
   *
   * **A name and two numbers, never the bytes**, for the same reason `logoColours` is two hex strings
   * and not a file: the generator stays a pure function of its answers, and what it writes into the
   * document is the reference the header carries (`header.brand.logo`). The bytes travel the path a
   * photograph travels — IndexedDB, the preview's object URL, the multipart form, the account's
   * bucket — and this is what ties them to the document. The size is read where the bytes are
   * drawn (`prepareLogo`) and travels with the name, one value, so there is no size without a file
   * (sprint 30 día 7: the published `<img>` carries both and the name beside it does not jump).
   * Serialisable, so unlike `logo` it survives a reload of the questionnaire.
   */
  keptLogo: { src: string; width: number; height: number } | null;
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
  logoColours: null,
  keptLogo: null,
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
