# @retorika/photobank

The reviewed, per-sector bank of sample photographs generated sites show until the owner uploads
their own (ADR 0011). Same shape as `packages/copybank`'s text bank, for the same reason: nothing
publishable reaches a client's site without a person having read it first.

## Where things live

```
bank/<sector>.json     reviewed images — the only ones any code reads
bank/photos/<id>.webp  their bytes
drafts/<sector>.json   awaiting review: src/ never reaches this directory, and a test proves it
drafts/photos/<id>.webp
```

All eleven sector files exist from day one, every one of them `{ "sector": "…", "images": [] }`.
That is deliberate: it is what lets the first photograph of any sector be a data change rather
than a code one. Do not delete an empty sector file, and do not wait for a sector to have images
before creating its entry — there is nothing to wait for.

## Approving a draft

1. Add the record to `drafts/<sector>.json`, with `review: { status: "draft", drafted: "YYYY-MM-DD" }`
   and no `by` — nobody has approved it yet, so there is nobody to name.
2. Have someone check it against the list below.
3. `git mv` the record into `bank/<sector>.json`, change `review` to
   `{ status: "approved", by: "<name>", date: "YYYY-MM-DD" }`, and move the file from
   `drafts/photos/` to `bank/photos/`.

That move is the review, the same act ADR 0009 names for a bank text. `draftImageRecordSchema`
checks everything the approved schema does except the signature, so this step cannot fail on a
rule nobody had already checked.

### The first approved image changes what the editor says

**Three sentences in `apps/editor/src/locales/es.json` were made true on 29 September 2026 by
removing photographs from them**, because the bank was empty and they promised something the
product could not do. Approving the first image makes them false in the other direction, so they
come back with it — in the same pull request, not afterwards:

| Key | Says today | Because |
|---|---|---|
| `questionnaire.step2.subtitle` | «elegimos las secciones y **los textos** por ti» | Nothing chooses a photograph by sector yet |
| `variants.subtitle` | «Las fotos **las pones tú**: donde va cada una hay un hueco esperando» | There is no sample photograph, only an empty marker |
| `questionnaire.step2.other.warning` | «Todavía no tenemos **textos** preparados para {sector}» | It used to say «textos ni fotos», which implied the other ten sectors had photographs. None did |

`apps/editor/src/editor/photoInventory.ts` already tells the two states apart — `"sample"` is a
bank photograph and `"empty"` is the marker — and the whole «Foto de ejemplo» half of the editor
(the canvas badge, the chip in «Fotos», the ADR 0011 wording in the pre-download warning) is
written and waiting for a state the product cannot currently produce.

## What the reviewer checks

Copied from `docs/tasks/backlog.md`'s "What an image has to satisfy" (29 September 2026), which is
the record of this list for anyone who needs to act on it without reading code first.

**The licence.**

- Commercial use allowed, *and* our clients may publish it. A licence that covers only Retorika's
  own use fails the test.
- Never from a bank whose terms forbid compiling its photos into a similar service or using them
  in digital templates — Unsplash and Unsplash+ are both excluded by name.
- The terms re-read for **the exact tool and the exact plan**. Free tiers routinely differ from
  paid ones.
- The date the terms were read, recorded. Terms change.

**The picture.**

- No recognisable person: no face, no tattoo or other identifying feature.
- No brand, logo or lettering — including the garbled pseudo-text generative tools draw on signs
  and menus.
- No visible artefacts: extra fingers, warped tools, impossible objects.
- Plausible for a small business in Spain.

**The file.** WebP, longest side 1600px, quality around 75, EXIF and XMP removed. At most 200KB —
and its declared `width`, `height` and `bytes` must match the file exactly; the schema checks both
independently.

**How many.** At least eight per sector, so the three generated variants and "volver a generar" do
not repeat a photograph. A sector holds zero or at least eight, never something in between — a
half-filled one would show the same photograph on two of the three variant cards.

## Testing without a real bank

`test/fixtures/` holds a tiny, self-authored fake bank — two flat-colour WebPs with no licence
question — so every seam (schema → choice → bytes) is exercised while `bank/` itself is empty.
