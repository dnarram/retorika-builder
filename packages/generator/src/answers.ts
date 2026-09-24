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
