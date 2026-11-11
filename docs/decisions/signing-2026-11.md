# Signing pack — November 2026

> **For David.** Twenty-eight ADRs are `proposed`: 0042, 0043 and 0045 to 0070. Each one records a
> decision of yours, and none of them is accepted until you say so in writing. This file is the
> one place to read them from: what each decides in a sentence, what was added to it after it was
> written and when, what development decided under your delegation rather than you, and what
> signing it changes. Prepared on sprint 34 día 7, 6 November 2026, and brought up to date closing
> sprint 35, 11 November 2026. **Development does not sign.**

The sprint 34 plan counted 24 (0042, 0043, 0045–0066). ADR 0067 and ADR 0068 were written during
sprint 34, and ADR 0069 and ADR 0070 during sprint 35 (its día 4), so the pack has 28 rows.

## What signing changes, and what it does not

**The status line of the ADR, and nothing else.** No code, no test, no golden and no migration
moves: everything these ADRs decide is already built and merged, the way ADR 0036 and ADR 0039
were built before they were signed. Signing turns «proposed» into «accepted» — the
record stops saying that the decision is waiting for its owner.

**A signature does not close what an ADR leaves open.** Each ADR's «What this does not decide» and
its named costs stay exactly as written; the open design questions of the sprint closes stay in
`docs/design/REVIEW.md` and `docs/tasks/backlog.md`.

**An ADR is signed as it reads today**, with every amendment and note below in it. Several amend
each other (0043 by 0057 and 0058; 0047–0049 by 0050 and 0051; 0046 by 0055 and 0056; 0060 §3 by
0067; 0062 by 0068; 0063's note by 0065; 0060 and 0066 by 0070), so signing an older one without the newer that amends it
would sign a rule the product no longer follows. The batches below keep those chains together.

## How a signature is recorded

1. **You write the instruction**, per ADR or per batch, in your own words — «Firma la ADR 0054 por
   mí», «Firma el lote B», «Firma las veintiocho». A merge, an approval of a plan, or a delegation
   to decide («decide lo mejor») is not a signature: the 0052 and 0053 delegations say so in their
   own text — «Recorded as that, and not as his signature» (0052).
2. **Development records it in each ADR's status line**, in the form ADR 0037 and ADR 0040 carry:
   `**Status:** **accepted** · **Date:** <unchanged> · **Accepted:** <the day of your instruction>`,
   and `**Accepted by:** **David, <date>** — «<your words>», <where you wrote them>. **Recorded by
   development at his instruction, which is said out loud because the standing rule is that
   development does not sign.**` The «Decided by» clause above it is left as it is: it is the
   decision, and this is the signature.
3. **One commit per batch**, `docs(adr): ADRs NNNN–NNNN accepted by David, recorded at his
   instruction`, its body quoting your words and the date — as `0dd5722` did for ADR 0040. The same
   commit strikes them from the lists that name them as pending: the latest «Lo que el sprint N deja
   abierto» in `docs/design/REVIEW.md` and the backlog's head, the backlog's two mentions of 0042 and
   0043 as unsigned, the signatures row of `docs/tasks/lo-que-falta-para-el-primer-euro.md`, and this
   file's row.
4. **If you want one changed rather than signed**, that is a new decision: development writes it as
   a dated amendment with your words, and you sign the amended text, or not.

## The batches

A suggestion, so that each chain of amendments is signed together. Any other grouping works.

| Batch | ADRs | What it is about |
|---|---|---|
| **A** | 0042, 0047, 0048, 0049, 0050, 0051, 0052, 0053, 0061, 0066 | The editor: the phone, choosing and writing, the drag and the keys, the canvas that patches, the chrome, the canvas at 1280, a menu dragged to its zone |
| **B** | 0045, 0046, 0055, 0056 | The letter: no reserved names, the gallery, forty families, an owner's own font |
| **C** | 0043, 0057, 0058, 0059, 0060, 0063, 0065, 0067, 0069, 0070 | The header: two menus, the owner's header, its script, the logo, the places, the bar of 2026, the sheet, the fold, the brand's size and its place |
| **D** | 0054, 0062, 0064, 0068 | The published page: its icon, its motion and the progress line that amends it, its measure and rhythm |

## The rows

Dates are those the ADRs' own headings carry; where a note's heading carries none, the date is that
of the commit that added it, read from `git log`.

### Batch A — the editor

| ADR | What it decides | Added after it was written | Decided by delegation |
|---|---|---|---|
| [0042](0042-the-application-fits-a-phone.md) · 15 Oct, sprint 21 | Every screen of the application — the landing, the questions, the three proposals (a carousel on a phone), the editor with its panels, floating bar and a three-row header — fits a phone with nothing overflowing or cut, fields at 16 px at least, and a checklist for a real iPhone | Nothing | Nothing |
| [0047](0047-a-text-is-chosen-before-it-is-written-in.md) · 19 Oct, sprint 24 | A text has two explicit states, chosen and being written, each entered by a named gesture; `contentEditable` stops being permanent; Escape ends the writing without blurring; two mitigations for an owner with no tutorial | §1 amended in one clause by ADR 0049 (19 Oct) and by ADR 0050's día 3 (20 Oct: a held click drags) | Nothing |
| [0048](0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md) · 19 Oct, sprint 24 | An element dragged inside a section snaps to the grid's nearest cell, with no browser drag-and-drop; one drag is one step of history; the escalation is offered, never done on its own | Amendment of 22 Oct (sprint 26 día 7: §6's technical half belongs to the `swap` route, since retired); §4, §5 and §8 amended by ADR 0050 (20 Oct: the element is its own preview, overlaps allowed, a held click drags) | Nothing |
| [0049](0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) · 19 Oct, sprint 24 | The arrows move the chosen element and `Shift` resizes it, with one refusal shared with the hand, an announcement in the editor's own document, the focus returning to the element, and one finger still scrolling on a phone | Amendment of 22 Oct (sprint 26 día 7: §3 and §4 under the patch route); §1 amended by ADR 0050's día 6 (20 Oct: the keyboard counts in units, `Shift` stops resizing) | Nothing |
| [0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md) · 20 Oct, sprint 25 | A hand-designed section is a fine grid of ninety-six units in eight-pixel rows, and the element stays where the hand lets it go: edges that stretch, guides, one overlap that warns (text over text), units on the keyboard, 44 px handles for a finger, and a phone that inherits no overlap (schema 1.12.0) | Six amendments of 20 Oct (días 2–7); 22 Oct (sprint 26 día 7: one painter per document); 26 Oct (sprint 28 día 7: a row is a minimum and the content pushes) | Nothing |
| [0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md) · 21 Oct, sprint 26 | The canvas keeps one document for the whole session and an edit is a patch keyed on the renderer's own identities, with delegated listeners; the renderer learns nothing about the editor | Nine amendments: sprint 26 días 2–7 (22 Oct) and día 8 (23 Oct); sprint 27 día 1 (23 Oct: the old route is gone) and día 5 (24 Oct: escalating was never two changes) | Nothing (its «delegation» is the listeners', your adjustment 5) |
| [0052](0052-the-keyboard-enters-a-section-and-the-bar-acts-on-the-words-the-hand-chose.md) · 23 Oct, sprint 27 | The canvas is one Tab stop and a section's insides are stops only while it holds the keyboard; the floating bar is a complete keyboard landmark; marking commits first; escalating is one change; the shell has landmarks | What was measured on días 2–6 (23–25 Oct); what día 8 found (25 Oct) | **Yes, 25 Oct**, under «Actua como experto y decide lo mejor para el proyecto para conseguir los objetivos marcados en el proyecto», written merging día 7's pull request: día 4's six open questions about the text bar (↑ ↓ on its grip and ← → and Inicio the toolbar's; the bar not moved beside the text; ← → in the pixel fields belonging to the bar; where a keyboard press returns and when the bar closes) and día 6's two region names, «Paneles del editor» and «Área de edición» — all kept as built |
| [0053](0053-chrome-is-drawn-in-screen-pixels-and-an-element-too-small-on-screen-keeps-its-corners.md) · 25 Oct, sprint 27 | Every length of the canvas's chrome is a length of the screen whatever the zoom, measured into `--rb-zoom`; the handles are 44 px on screen, and an element too small on screen keeps its corners | Amendment of 26 Oct (sprint 28 día 2: the chrome in the page's flow at a lower zoom, measured) | **Yes, 25 Oct**, under the same words: the handles' rule stays three along and two across; the outlines are accepted as Chromium draws them; what keeps the frame's pixels stays as built |
| [0061](0061-the-canvas-lays-out-at-1280-and-scales.md) · 30 Oct, sprint 31 | The desktop canvas lays out at 1280 px and scales to the window; under the legibility floor it gives up width rather than legibility, and says so | Nothing | Nothing |
| [0066](0066-a-menu-is-dragged-to-its-zone.md) · 4 Nov, sprint 33 | A menu is dragged from its own ground to a zone drawn when the gesture starts; a drop outside or Escape writes nothing; a side the other menu holds stacks the two; the live region names the zone, the cards stay the keyboard's way; the cursor announces the gesture | Notes of 5 Nov (sprint 33 día 5: the gesture case by case; día 6: it also starts on an entry, your condition 1 amended), 6 Nov (sprint 34 día 5: «Menú» is a grip) and 10 Nov (sprint 35 día 4: the brand becomes a grip, by ADR 0070 in batch C — sign C with or after this batch) | Nothing |

### Batch B — the letter

| ADR | What it decides | Added after it was written | Decided by delegation |
|---|---|---|---|
| [0045](0045-the-serif-this-product-ships-reserves-no-name.md) · 18 Oct, sprint 24 | The classic pair's heading face becomes EB Garamond, a family whose licence reserves no name, the sites that chose the old one are migrated rather than left behind, and the filter becomes a refusal over every row | Amendment of 27 Oct (sprint 29 día 2, your decision): Libre Baskerville leaves for Gelasio (migration `0014`, 1.13.0), and a licence is read from its holders, both readings agreeing | Nothing |
| [0046](0046-the-gallery-ships-the-faces-so-the-letter-can-be-named.md) · 18 Oct, sprint 24 | An owner chooses a family by its real name from a closed gallery of faces we ship — headings and text apart, both weights required, only the faces a site uses travel, the weight budget measured | Amendments of 27 Oct: the table moves to `@retorika/schema` (ADR 0055); filter 2 is read from the holders (ADR 0045 amended); §2 also amended by ADR 0056 (a document still never names a file) | Nothing |
| [0055](0055-the-gallery-is-navigated-one-table-and-each-familys-substitute.md) · 27 Oct, sprint 29 | Forty families in one table, navigated rather than scrolled, in four species with their generic fallback, each entering with its nearest substitute so that a retirement is a mechanical migration; a quota on the sans; the faces' ceiling checks itself | The survey's appendix (27 Oct) | Nothing |
| [0056](0056-an-own-font-travels-like-a-photograph.md) · 27 Oct, sprint 29 | An owner's own font — one or two files, as uploaded, in four formats — is a row they added: its file minted from id and role, a variable face declaring its real range, its bytes weighed on their own line, and it travels with the account (schema 1.14.0) | §10 amended on día 5 (27 Oct: the inspection route is public and bounded); §11 (día 5) and §12 (día 6, 28 Oct: the account carries the fonts) | Nothing |

### Batch C — the header

| ADR | What it decides | Added after it was written | Decided by delegation |
|---|---|---|---|
| [0043](0043-the-menu-splits-in-two-and-the-owner-chooses.md) · 16 Oct, sprint 23 | The menu splits in two — between pages and within the page — and the owner decides whether each destination appears (visibility only), with a threshold of three counting both and stepping aside once the owner has curated | Amendments of 28 Oct (by ADR 0057: the header is the owner's) and 29 Oct (by ADR 0058: the page carries the header's script) | Nothing |
| [0057](0057-the-header-is-the-owners.md) · 28 Oct, sprint 30 | The header is the owner's: two menus that are chosen, named and dressed, as references and preferences on the document — one button, the brand, a shape at every width, and a stylesheet that travels only where a header does | Notes of 29 Oct (sprint 30 día 7: a line of the bar is a number), 31 Oct (sprint 31 día 2: each menu has its place, ADR 0060) and 3 Nov (sprint 32 día 1: the bar's look is of 2026, ADR 0063) | Nothing |
| [0058](0058-a-published-page-carries-one-script-and-it-is-constant.md) · 29 Oct, sprint 30 | A published page carries one inline script, constant and dispensable, at the end of the body and only where a header is drawn, within 2 KB gzipped; the canvas does not carry it | Notes of 29 Oct (sprint 30 día 6), 31 Oct (sprint 31 día 2: 815 bytes), 3 Nov (sprint 32 día 1: still four writes) and 4 Nov (sprint 33 día 1: the canvas no longer runs it at its first paint) | Nothing |
| [0059](0059-the-logo-travels-like-a-photograph.md) · 29 Oct, sprint 30 | The logo travels like a photograph: raster only, PNG out, a name minted on every upload; the header shows it with a derived `alt`, the review warns when it is hard to see, and the button's label is the sector's | Note of 29 Oct (sprint 30 día 7: the logo keeps its size) | Nothing |
| [0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md) · 31 Oct, sprint 31 | Each menu has a place from a closed vocabulary, and the places are the zones of a future drag; the rail is one mechanism for both menus; the bar keeps every copy; a bar with nothing left collapses and is still the header (schema 1.17.0) | Notes of 1 Nov (sprint 31 días 3 and 4), 2 Nov (días 5 and 6) and 4 Nov (sprint 33 día 4: the gesture arrived); §3 amended by ADR 0067 (5 Nov: rails stand from the fold, never under 1024); its refusal of a place for the brand amended by ADR 0070 (10 Nov) | Nothing |
| [0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md) · 3 Nov, sprint 32 | The bar and its two menus take one look of 2026, the same for every site saved or new, every value a token or a mix of two; a fixed bar condenses once scrolled without changing its box; the glass is allowed and proved by arithmetic | Notes of 3 Nov (sprint 32 días 2, 4 and 5), 4 Nov (sprint 33 días 1 and 3) and 5 Nov (sprint 33 día 6: the bar's estimate is a sum per form); its día 4 note amended by ADR 0065 | Nothing |
| [0065](0065-the-phones-sheet-holds-the-page-still-without-a-byte-of-script.md) · 4 Nov, sprint 33 | While a phone's sheet is open the page does not scroll under it — by the stylesheet, without a byte of script — and keeps its width as the lock comes and goes; the iPhone goes first on its list | Nothing | Nothing |
| [0069](0069-the-brand-has-a-size-in-the-systems-words.md) · 10 Nov, sprint 35 | The logo has three named sizes (28, 40, 56 px, «normal» today's) and the name three of the scale's tokens; a size needs the thing it sizes; the phone derives the large logo and the heading-sized name by the token; the estimates count them with the stylesheet's own expressions; the rules travel in every sheet so the editor can preview by attribute (schema 1.19.0) | Nothing | Nothing |
| [0070](0070-the-brand-has-its-place-in-its-line.md) · 10 Nov, sprint 35 | The brand has a place in its own line — start, middle or end —, «en medio» on a one-line bar being the pages' menu drawn before it in the document; the phone keeps «al final» and derives «en medio» to the start; the brand is a grip and the button is not (amends 0060 and 0066) | Notes of 10 Nov (sprint 35 día 5: the panel writes the word pressed even when it is the layout's own; the alignment still moves the sections' row; «en medio» is not previewed on hover) and 11 Nov (día 6: the gesture, and the double click opening «Menú» at the brand only with the panel already open) | Nothing |
| [0067](0067-the-bar-folds-where-its-words-do-not-fit.md) · 5 Nov, sprint 34 | A bar whose words would not fit one line folds into the phone's header below a width estimated from the advance of every glyph it draws, conservatively, with no upper bound — «always» where it never fits | Notes of 6 Nov: día 3 (your decisions of that day — the table holds the maximum measured on macOS and on CI's Linux; the gate is that the bar never wraps, bound 60 px; kerning margins 3 % lower case and 1.5 % capitals, derived by a test); día 4 (who is told, and from which width); día 5 (the canvas under the fold has its grip) | Nothing |

### Batch D — the published page

| ADR | What it decides | Added after it was written | Decided by delegation |
|---|---|---|---|
| [0054](0054-a-published-site-carries-its-own-icon.md) · 26 Oct, sprint 28 | A published site carries its own icon, one file at the bundle's root: the first letter or digit of the business's name, by Unicode property, in the surface colour on a disc of the primary — and the disc alone when the name has neither | Nothing | Nothing |
| [0062](0062-the-published-site-moves-just-enough-without-a-byte-of-script.md) · 4 Nov, sprint 32 | The published site moves just enough, in CSS alone: sections come in as the visitor scrolls, the cover's words come in once, pages fade into each other; the canvas is still; there is no switch, and only the visitor's `prefers-reduced-motion` governs it | Notes of 3 Nov (sprint 32 día 4, below), 4 Nov (sprint 32 día 6: the three engines) and 6 Nov (sprint 34 día 6: the list gains the fixed bar's line, ADR 0068) | **Yes, 4 Nov**, under «Se el mejor experto de UX y diseño gráfico y decide las respuestas sobre las decisiones pendientes para continuar con el dia siguiente del sprint», written with #337 merged: **the reveal rises and never fades** — ADR 0064 §5's open question; ADR 0064 records the same decision |
| [0064](0064-the-page-has-a-measure-and-a-rhythm.md) · 4 Nov, sprint 32 | The page has a measure of 1200 px, by padding, from 1296 up, and a rhythm — the sections' room, the reading text's line, the headings — with what it moves named | Nothing after it was written; its §5 states the decision taken under delegation and recorded in ADR 0062 | See ADR 0062 |
| [0068](0068-the-fixed-bar-can-say-how-much-has-been-read.md) · 6 Nov, sprint 34 | A fixed bar can carry a two-pixel line that grows as the page is read — an owner's option, off for every site, reading `scroll(root)`, decorative, on the published page only (schema 1.18.0) | Nothing | Nothing |

## What else waits for you, and is not a signature

Named so that nobody reads this file as the whole list: the nine photographs of `restaurante-bar`
(their sheet is [`docs/tasks/las-nueve-fotos.md`](../tasks/las-nueve-fotos.md); the exemption fails
from 1 December 2026), and the open decisions of each sprint close in `docs/design/REVIEW.md`.
