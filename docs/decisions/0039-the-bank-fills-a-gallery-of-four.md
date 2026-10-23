# 0039 — The bank fills a gallery of four, and every one of them says it is not yours

**Status:** **accepted** · **Date:** 2026-10-12 · **Accepted:** 2026-10-12 ·
**Proposed by:** development, sprint 18 day 3, at David's instruction when approving the sprint —
with one condition he set, which is §2 below ·
**Accepted by:** **David, 12 October 2026** — «Firma el ADR0039 por mí», opening sprint 18 day 4,
after reading the pull request that built it (#222) and the two bank sentences in its body.
**Recorded by development at his instruction, which is said out loud because the standing rule is
that development does not sign.** The decision is his; the keystrokes are not, and anybody reading
this later should be able to tell the difference without asking. ·
**Amends:** [ADR 0036](0036-the-three-cards-pick-their-photographs-together.md), the consequence
that says «a generated site carries exactly one photograph»; and
[ADR 0011](0011-sample-photos-per-sector.md), which gave every sector a cover photograph and
nothing else ·
**Built:** sprint 18 day 3, before the signature — the precedent is ADR 0036, and the pull request
and `docs/tasks/backlog.md` both say so rather than tidying it away.

## Context

Three usability sessions saw a generated restaurant site and said the same thing in three ways:
«vacía y fría», «le falta una sección para mostrar los platos estrella», and the request for «una
sección de fotos». The site carried one photograph, on the cover, and the catalog has had a
gallery section since sprint 5 that nothing generated into.

Since 8 October 2026 the bank holds nine approved photographs for `restaurante-bar` (ADR 0035),
and since 10 October the three cards draw their covers from it together (ADR 0036). That ADR's
own consequences list ends with the sentence this one acts on: «A gallery of eight photographs in
one section would want the same treatment… when a section does, `avoid` is already the shape it
needs.»

**The risk David named when he accepted the gallery, and the condition he set.** A sample
photograph on a cover is a scene — a terrace, a bar counter, a kitchen. A sample photograph in a
*gallery* under a restaurant's name reads as that restaurant's food and that restaurant's room.
Two of the nine approved photographs are dishes (`restaurante-bar.04`, a paella;
`restaurante-bar.05`, jamón being carved). **A restaurateur who downloads without replacing them
publishes somebody else's dishes as their own**, and the bank's licence does not make that
honest — it makes it legal. Every sample photograph that reaches a published page is one more
occasion for that to happen. His condition: the ADR treats that risk, the cap is three or four,
the «Foto de ejemplo» label is visible on each one inside the editor, and the download warning
counts them one by one.

## Decision

### 1. A generated site of a sector whose bank is filled carries a gallery of four

- `buildGallery` in `packages/generator/src/sections.ts` builds a `gallery` section, composition
  `stacked`, placed **after services and before the address**: the page says what it does, shows
  it, then says where. A sector with no photographs gets no gallery at all — a gallery born on the
  catalog's grey marker would publish four markers and four «Escribe aquí de qué es esta foto»,
  which is a page that looks broken rather than one with a photograph missing. The ten empty
  sectors and every golden fixture are untouched.
- **Four, not eight.** The catalog allows eight. Four is the cap David asked for and it is chosen
  against the risk above rather than against the layout: four is enough warmth that the page stops
  being «vacía y fría», and few enough that it is a sample and not a shop window of another
  kitchen's food. With the cover that is **five sample photographs per site**, and five rows in the
  download warning. (Against eight there is also what ADR 0036 found in the bank's own contents:
  with eight of nine, the three cards' galleries would be «the bank minus one cover» in three
  orders — distinct records, an indistinguishable screen.)
- **Four draws without replacement, folded through `avoid`.** The gallery avoids this card's own
  cover and **every** sibling's cover, so no photograph that is a cover anywhere on the screen of
  three appears in any gallery. That needs the three covers before any gallery, so
  `generateVariants` runs in two passes: the ADR 0036 fold over covers alone, then each card built
  with every sibling's cover in `avoid`. The covers do not move between the passes — a cover's walk
  only ever steps over records avoided *before* it, and a cover chosen *after* it avoided it — and
  `generate.test.ts` pins that over two hundred business names rather than trusting the argument.
  Sibling galleries may overlap each other: three cards want fifteen photographs from a bank of
  nine, and the ADR says so rather than pretending otherwise.
- **Deterministic, as everything in the generator.** Seeds follow the cover's shape — business,
  sector, card, `sec-gallery`, `item-n` — and the walk is a pure function of the seed, the sorted
  bank and the ids already taken. Same answers, same four, same order; `INV_5` and the golden
  corpus are untouched.

### 2. Every sample photograph says it is not yours, four times over

The risk is treated by making the state visible at every point an owner could miss it, not by
making the gallery smaller than it is useful:

- **In the document.** Each gallery photograph carries `sample` with the bank's id, exactly as the
  cover does (ADR 0011). Nothing downstream has to guess which photographs are ours.
- **On the canvas.** The editor's «Foto de ejemplo» badge is drawn on every image whose element
  carries `sample`, inside list items as well as on the cover. Day 4 of this sprint verifies it on
  the four and makes the `e2e` say so; if the badge does not reach list items today, that is a
  defect against this ADR and not a gap in it.
  > **Verified 12 October 2026 (day 4):** the badge reaches the four, each one visible; «Fotos»
  > says «5 de 5 fotos todavía no son tuyas»; the warning says «Tu web tiene 5 fotos de ejemplo»
  > with five «Cambiar» rows and offers «Descargar igualmente»; the ZIP carries the five files and
  > the page opened from disk shows five photographs and not one badge. The walk is «sprint 18
  > día 4» in `apps/editor/e2e/critical-flows.e2e.test.ts`.
- **In «Fotos» and in the warning before a download.** The panel lists every photograph with its
  state; the pre-download warning says «Tu web tiene *N* fotos de ejemplo» and lists each with its
  own «Cambiar». Both already walk list items (`photoInventory.ts`, sprint 5's lesson). The warning
  **warns, and does not block**: a dead link blocks a download because the page would be broken; a
  sample photograph warns because the page works and the choice is the owner's — the line
  `docs/tasks/backlog.md` has kept since sprint 7. Five warnings in a row, each naming a photograph,
  is the treatment.
- **In the caption.** The words under each photograph are the bank record's own `alt` — a
  description a reviewer wrote under ADR 0011 («Terraza con mesas redondas, sillas de mimbre…») —
  and never the catalog's marker. Two reasons. Four markers would publish four «Escribe aquí de qué
  es esta foto» and add four rows to the owner's list for a section they did not ask for. And an
  `alt` describes a scene; it is the one text that can sit under a sample photograph without
  claiming the photograph is of this business — «Paellera con arroz amarillo humeante» is a
  caption, «Nuestra paella» would be a lie the generator wrote. Nothing stops the owner typing the
  second after replacing the photograph, which is the order of events the badge exists to produce.

### 3. The heading and the introduction come from the text bank

`restaurante-bar.gallery.headline.01` «Un vistazo a {negocio}» and
`restaurante-bar.gallery.intro.01` «La mesa, la barra y la cocina: lo que te espera cuando vengas.»,
with a generic pair for the cascade. They enter `bank/` by the sprint 8 circuit: written in the
pull request body for David to read, and the merge is the review (ADR 0009). `gallery` joins the
copybank's section list for the purpose; captions do not come from there, for the reason in §2.

## Alternatives, and why not

**Eight, the catalog's maximum.** Rejected above: more occasions for the risk, and an
indistinguishable screen of three with nine in the bank.

**Six.** Not refused on any measurement; four was asked for and nothing measured argues for two
more. If a session says the page still feels thin, six is a one-line change and a new signature.

**Captions from the text bank, four per sector.** A reviewed caption cannot describe a photograph
it has not seen, so bank captions would be generic («Nuestra cocina») — which is exactly the claim
§2 refuses to let the generator make.

**No captions.** The item's caption slot is `1..1` in the catalog, for the reason `gallery.ts`
gives: a new photograph must be born with somewhere to type. An empty text renders nothing, so the
slot could be left blank — but then the owner's gallery has four photographs and no way to reach
their captions from the canvas, and the fields panel's reach into list items is the one thing
sprint 12 built for exactly this.

**A photograph-count the owner chooses in the questionnaire.** A sixth question for a number nobody
would know how to answer before seeing the page. The editor can delete three cards or the section.

## Consequences

- A generated `restaurante-bar` site goes from one photograph to five, and from 79–128 KB to
  274–335 KB gzipped in total (`pnpm size`, 12 October 2026). The bytes we author stay at 49 KB,
  under the 80 KB budget that number protects; photographs are reported and bounded by the bank's
  own 200 KB cap per record.
  > **And the four cost Lighthouse one to two points of performance** on simulated slow 4G (100 →
  > 96–97, LCP 1.35–1.65 s → 2.55–2.86 s), because they competed with the cover for the wire. Day 4
  > gave every photograph outside the first section of its page `loading="lazy"` — the cover's
  > never — and measured 100 / 99 / 99 after. Three images on two golden pages moved, reviewed.
- `Variants.tsx` fetches a card's photographs **together and writes them once**, where it wrote
  once per photograph. Five replacements of the preview's document in a row was the mechanism the
  backlog has suspected since sprint 7, and the day the gallery landed twenty `e2e` walks lost the
  keyboard or the document between the cover's arrival and the fourth gallery photograph's. The
  `e2e`'s `waitForBankPhoto` waits for the four as well as the cover.
- The pill's «Añadir sección» minted a new section's id as `sec-<catalogId>` and `insertSection`
  refuses a taken id, so adding «Fotos de trabajos» to a generated restaurante site would have
  thrown. It now mints through `mintSectionId`, the helper the schema already had for duplicates.
  Found by the generator's own tests on day 3, before any owner could.
- The «Listas» panel now offers to make a list of the gallery's cards as well as the services'.
  That is ADR 0033 working as written — a gallery is a list — and the walks that meant the services
  say so.
- ADR 0036's sentence «a generated site carries exactly one photograph» stops being true, and the
  note under it says since when. `packages/photobank/README.md` kept the same sentence and gets the
  same note.
- The reviewer's checklist in `packages/photobank/README.md` is not amended here. If direction
  wants the bank to hold **no recognisable dish** — so that nothing in a gallery can be a plate
  claimed as one's own — that is a content rule for David to add to the checklist, and two of the
  nine approved photographs would have to leave the bank under it. This ADR names the choice and
  does not make it.

## What this does not decide

- **Which composition a gallery takes per card.** `stacked` on all three; the cards already differ
  where it shows, and a title beside the grid (`side`) narrows a heading to four columns for no
  gain anybody has asked for.
- **Galleries for the ten sectors with no photographs.** Content production, ADR 0011's circuit,
  and the exemption that fails from 1 December 2026 (ADR 0035, as amended on 23 October 2026). The
  day a sector's file fills, its
  generated sites gain a gallery with no change here.
- **Whether a dish may be in the bank at all.** Named above; David's.
