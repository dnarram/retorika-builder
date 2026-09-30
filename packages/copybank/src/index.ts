import genericoJson from "../bank/generico.json" with { type: "json" };
import peluqueriaJson from "../bank/peluqueria-barberia.json" with { type: "json" };
import reformasJson from "../bank/reformas.json" with { type: "json" };
import restauranteJson from "../bank/restaurante-bar.json" with { type: "json" };
import tiendaJson from "../bank/tienda.json" with { type: "json" };
import { type SectorFile, type Suggestion, sectorFileSchema } from "./schema.ts";

/**
 * Reading the bank (ADR 0009).
 *
 * The files are imported, not read from disk: the generator runs inside a bundled application,
 * and a filesystem path would work on a laptop and fail once deployed. Parsing happens once, at
 * module load, so a file that has not been reviewed brings the application down at start rather
 * than publishing an unreviewed text at three in the morning.
 *
 * Only `bank/` is read. A `drafts/` directory exists as of 28 September 2026 and nothing in this
 * file may ever import from it — `test/drafts.test.ts` asserts that by reading this source.
 */

export const GENERIC_SECTOR = "generico";

const FILES: readonly unknown[] = [
  genericoJson,
  peluqueriaJson,
  reformasJson,
  restauranteJson,
  tiendaJson,
];

const BANK: ReadonlyMap<string, SectorFile> = new Map(
  FILES.map((file) => {
    const parsed = sectorFileSchema.parse(file);
    return [parsed.sector, parsed];
  }),
);

/** The facts a text can be filled with. `ciudad` is absent for a business with no premises. */
export interface Facts {
  negocio: string;
  ciudad?: string | undefined;
}

function fill(text: string, facts: Facts): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (name === "negocio") return facts.negocio;
    if (name === "ciudad" && facts.ciudad !== undefined) return facts.ciudad;
    return whole;
  });
}

/**
 * The text for one slot, filled.
 *
 * The lookup falls back from the sector to the generic file, so a sector's file only carries
 * what differs. Entries whose placeholders cannot all be filled are skipped, which is how "every
 * text using {ciudad} has an alternative without it" (ADR 0009) turns into working behaviour
 * rather than a rule someone has to remember.
 *
 * Returns `undefined` when nothing fits, which the caller must handle: publishing a slot with an
 * unfilled `{ciudad}` in it is the one outcome this must never produce.
 */
export function textFor(
  sector: string,
  section: string,
  slot: string,
  facts: Facts,
): string | undefined {
  for (const name of [sector, GENERIC_SECTOR]) {
    const file = BANK.get(name);
    if (!file) continue;
    const entry = file.entries.find(
      (candidate) =>
        candidate.section === section &&
        candidate.slot === slot &&
        candidate.placeholders.every((placeholder) =>
          placeholder === "ciudad" ? facts.ciudad !== undefined : true,
        ),
    );
    if (entry) return fill(entry.text, facts);
  }
  return undefined;
}

/**
 * What question 3 offers for a sector, and the card descriptions those answers become.
 *
 * Empty for a sector with no bank of its own: an honest blank is better than another sector's
 * services with this one's name on them.
 */
export function suggestionsFor(sector: string): readonly Suggestion[] {
  return BANK.get(sector)?.suggestions ?? [];
}

/** The words on the main button, for the action question 5 collected. */
export function actionLabel(sector: string, action: string): string | undefined {
  return BANK.get(sector)?.actions[action] ?? BANK.get(GENERIC_SECTOR)?.actions[action];
}

/** Every sector the bank has a file for, for tests and for the questionnaire. */
export function sectorsInBank(): readonly string[] {
  return [...BANK.keys()];
}

/**
 * Whether the product has this sector's own words, rather than the generic ones it falls back to.
 *
 * **The question the questionnaire asks before it tells somebody their sector has no texts
 * prepared**, and it is asked of the bank that is *loaded* rather than of the repository. That
 * distinction is the whole point of it existing: `drafts/` holds sectors that are written and
 * unread, and a written sector is not a served one. Until a person signs one and moves it, the
 * honest answer here is still no — which is the answer the screen has to give, because what the
 * owner would get is the generic file and an empty question 3.
 *
 * It follows from `BANK` being built from `bank/` imports alone, so this cannot drift from what is
 * served without the loader drifting too. `test/drafts.test.ts` pins it: every file sitting in
 * `drafts/` is a sector this answers `false` for.
 *
 * `generico` answers `false` as well. It is the fallback, not a trade, so asking whether it has a
 * sector's own words has the same answer as asking about a sector with no file — and «Otro sector»,
 * which is what lands on it, is the case the warning was written for in the first place.
 */
export function servesSector(sector: string): boolean {
  return sector !== GENERIC_SECTOR && BANK.has(sector);
}

export type { Entry, SectorFile, Suggestion } from "./schema.ts";
export { PLACEHOLDERS, SECTIONS } from "./schema.ts";
