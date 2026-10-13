# 0041 — The three proposals start neutral, and the palette is chosen afterwards

**Status:** **accepted** · **Date:** 2026-10-13 · **Accepted:** 2026-10-13 ·
**Decided by:** David, 13 October 2026, after sprint 19 closed — the request in his own words:
«Quiero que las sugerencias para escoger al cliente se muestren con una paleta de colores neutra,
es decir, que esas sugerencias aparezcan con las letras en el color azul retorika o color negro. El
cliente escogerá la paleta de colores de su web después, una vez seleccione el tipo de web que
prefiere.» Then three questions, answered the same day: the logo still decides; the blue is
Retorika's (`#156FE7`); the neutral palette is a fifth option in «Estilo» ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** ·
**Amends:** [ADR 0010](0010-initial-questionnaire.md) («sin logo, la paleta por defecto del
sector»), [ADR 0015](0015-interface-tokens-are-not-the-sites.md) (its warning about a client's site
taking Retorika's blue), and `docs/design/REVIEW.md`'s «the palette comes from the logo» ·
**Touches:** `packages/tokens` (the fifth palette), `packages/generator` (`theme.ts`), the Estilo
panel, `logoPalette.ts`.

## Context

After the five answers the product shows three proposals and the owner picks one. Until today each
proposal arrived in the sector's default palette — terracotta for a restaurant, slate for a shop —
unless the logo had chosen one. David saw a restaurant's three proposals in brown and asked for
them neutral: the owner should judge the structure of the three, not a colour nobody chose, and
choose the colour afterwards, in «Estilo», once the kind of site is settled.

## The decision

1. **Without a logo's choice, every proposal starts in the neutral palette.** `themeFor` falls
   back to `STARTING_PALETTE_ID` instead of the sector's palette; the sector decides the typography
   and nothing else. ADR 0010's clause «sin logo, la paleta por defecto del sector» is amended to
   «sin logo, la paleta neutra».
2. **The logo still decides.** Dossier §4's «saca la paleta de su logo» and mockup 06 stand: a
   palette read off the owner's own mark is theirs, not ours, and a logo whose colour chose one
   keeps choosing it. What changes is only what happens when there is no logo, or no colour in it.
3. **The neutral palette is black ink and Retorika's blue** — `#0F172A` for text, `#156FE7` for
   headings, buttons and links, `#105CB1` secondary, white surfaces — and it is the one place the
   brand's blue reaches a client's site. ADR 0015 warned that «a client's site picking up Retorika's
   blue would make every generated site look like ours», and that warning is amended by this
   decision and not forgotten: **a site the owner never restyles ships in this blue**, which is the
   consequence to say out loud. The contrast pairs every palette must meet are met: 4.71:1 for the
   blue on white, both ways.
4. **«Neutra» is the fifth option in «Estilo»**, listed first and ticked when the editor opens on
   a proposal, so the owner sees what they have and can come back to it. The panel deduces the
   ticked palette from the theme, as before; nothing is stored.
5. **The neutral start is not a colour a logo chooses.** `nearestPalette` skips it, so a logo in
   exactly Retorika's blue lands on `classic-blue`. A logo choosing the brand's palette would be the
   drift ADR 0015 named, arriving through a lookup.

## What this does not decide

- The sector-to-typography map, untouched.
- Whether the proposals should differ from one another in palette as they do in composition. They
  share the one neutral palette, which is the point.
- Any change to the four palettes of colour, their names or their order after «Neutra».

## Consequences

- `packages/tokens`: `Palette.starting`, `STARTING_PALETTE_ID`, the `neutral` palette first in
  `PALETTES`, «Neutra» in the locale file; the test that kept the brand out of every palette now
  says one palette, named, carries its blue and no other does.
- `packages/generator/src/theme.ts`: `SECTOR_TYPE_PAIR` only; its README stops saying the logo is
  «never analysed», which had been false since sprint 6 day 6.
- `apps/editor`: `nearestPalette` skips the starting palette; the critical flow 3 walk and the
  sprint 9 walk read the neutral values where they read the sector's.
- Every generated site's colours change; no golden moves (the corpus is hand-written) and Lighthouse
  is re-measured on the change.
