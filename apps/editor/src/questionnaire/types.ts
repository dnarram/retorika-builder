/**
 * The shape day 3's generator will consume. This is the contract, decided here rather than
 * there: the questionnaire is what decides what a "complete answer" looks like, because it is
 * the only thing that has to ask a real person for it.
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
