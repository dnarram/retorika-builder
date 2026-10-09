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
come back with it — in the same pull request, not afterwards.

**It happened on 8 October 2026, and two of the three came back. The third did not, and that is
on purpose.** The instruction above was written for a bank that fills, not for a bank with one
sector in it. With restaurante-bar approved and the other ten still empty, restoring all three
would have swapped one untrue sentence for another:

| Key | What happened | Why |
|---|---|---|
| `questionnaire.step2.other.warning` | **Restored** to «textos ni fotos» | It is shown for «Otro sector» alone, which has neither. True again, exactly as written |
| `variants.subtitle` | **Split in two**, on `hasSamplePhotos` | Shown after the sector is known, so it can tell the truth per sector — and had to, because «hay un hueco esperando» became false for restaurante-bar the moment its photographs landed |
| `questionnaire.step2.subtitle` | **Still waits** | It is shown *before* a sector is chosen, so it speaks for all eleven. «y las fotos por ti» would promise photographs to ten sectors that have none. It comes back when the launch sectors do |

`hasSamplePhotos` is the predicate the split rests on, and it is the counterpart of
`packages/copybank`'s `servesSector`: asked of `bank/`, never `drafts/`, so photographs that are
generated but unsigned change nothing on screen.

One thing measured while wording it, worth knowing before adding a gallery section: **a generated
site carries exactly one photograph**, on the cover. The other four sections carry none. So a
sector either has every slot filled or every slot empty, and there is no mixed case for a sentence
to straddle — which is why the two sentences are flat rather than conditional inside themselves.

`apps/editor/src/editor/photoInventory.ts` tells the two states apart — `"sample"` is a bank
photograph and `"empty"` is the marker — and the whole «Foto de ejemplo» half of the editor (the
canvas badge, the chip in «Fotos», the ADR 0011 wording in the pre-download warning) was written on
29 September and could not be reached by anything until 8 October. It is reachable now.

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

**How many.** At least eight per sector. A sector holds zero or at least eight, never something in
between, and `bank.test.ts` enforces it.

**What eight does not buy, measured on 8 October 2026 with nine approved:** it does not stop the
three variant cards repeating a photograph. That was this rule's stated reason, and it was wrong.
The three cards were three independent hashes of three seeds, not one draw without replacement, so
two of them landed on the same photograph for **39.4% of business names** (787 of 2000 measured;
about 31% is the floor a perfect hash would give with nine). A bigger bank makes repetition rarer
and never impossible, so raising the minimum could not fix it either.

**Picking the three together does, and that is `avoid`** — ADR 0036, built in sprint 17 day 2.
`sampleImageFor(sector, seed, { avoid })` hashes the seed exactly as before and then walks forward
to the first record nobody has taken, wrapping once; `generateVariants` owns the exclusion and
passes each card the ids the earlier ones chose. Re-measured the same way: **0 of 2000**. A lone
`sampleImageFor(sector, seed)` is unchanged, which is why no call site had to move.

The minimum is still worth keeping: it is what stops a sector shipping with two photographs and
showing one of them on every card. It just never promised what it used to say it promised.

## Testing without a real bank

`test/fixtures/` holds a tiny, self-authored fake bank — two flat-colour WebPs with no licence
question — so every seam (schema → choice → bytes) was exercised while `bank/` itself was empty.

It stays after restaurante-bar filled on 8 October 2026, and not out of sentiment: the fixtures
pin ids and shapes no real sector happens to produce — a photograph nested in a gallery's list
item, two elements sharing one file — and a fixture that moved whenever the bank grew would be a
fixture nobody could assert against. The real bank now has its own guards beside them in
`bank.test.ts`: every approved file is opened, and its bytes, width and height are read back out of
the WebP header and checked against what its record declares.
