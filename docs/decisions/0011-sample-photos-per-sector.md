# 0011 — Sample photos per sector until the client uploads their own

**Status:** accepted (the decision); the proposal below is to be confirmed in the task that builds
it · **Date:** 2026-09-22 · **Decided by:** the CEO

## Context

The concept dossier leaves open "¿Banco de fotos con licencia?", and says why it matters: "Pasa de
conveniente a necesaria: el relleno automático de las plantillas depende de ella." The cover's
`image` slot is 1..1, so a generated site cannot exist without a photo.

## Decision — decided by the CEO

- **Until the client uploads their own photos, the site shows generic photos of the sector they
  chose.**
- **Where the photos come from:**
  - **Never from a bank whose licence forbids** compiling its photos into a similar service or
    using them in digital templates. Unsplash and Unsplash+ have those restrictions, so neither
    is used.
  - **Preferably images generated with free generative AI** whose licence allows commercial use.
    They go through the same circuit as ADR 0009: a draft, a review by a person before entering
    the bank, and nothing enters without that review.
  - **No recognisable people, no brands and no text** in the image.
  - **Origin and licence recorded for every image.**
  - **Compressed,** so they do not inflate the ZIP.

**What "commercial use" has to cover.** A sample photo travels in the client's ZIP, and the client
publishes it on their own domain. So the licence has to allow our clients to publish it, not only
our own use. A licence that stops at us fails the criterion.

## Proposal — to be confirmed in the task that builds it

### Where the bank lives

**A package, `packages/photobank`, with the same shape as ADR 0009's text bank:**

    packages/photobank/
      drafts/<sector>/<id>.webp + <id>.json   awaiting review: no code reads them, ever
      bank/<sector>/<id>.webp + <id>.json     reviewed: the only images any code reads
      src/schema.ts                            the Zod schema of an image's record
      src/index.ts                             loading, and a deterministic, seeded choice
      test/bank.test.ts

- **At least eight photos per sector,** so the three variants and "volver a generar" do not
  repeat themselves.
- **"Otro" gets a neutral set:** a workspace, a counter, a shop front with no signage.

### One image's record

    {
      "id": "peluqueria-barberia.03",
      "sector": "peluqueria-barberia",
      "alt": "Sillón de barbería junto a un espejo, con tijeras y peine sobre la encimera",
      "file": "peluqueria-barberia.03.webp",
      "width": 1600,
      "height": 1067,
      "bytes": 148213,
      "origin": { "tool": "<tool and model>", "generated": "2026-10-05", "prompt": "<the prompt>" },
      "licence": {
        "name": "<the tool's terms>",
        "url": "<where the terms are>",
        "checked": "2026-10-05",
        "commercialUse": true,
        "clientsMayPublish": true
      },
      "review": { "status": "approved", "date": "2026-10-06" }
    }

- **`alt` is a text,** so it is reviewed like the bank's texts: in Spanish, and describing what is
  really in the photo.
- **`licence.checked`** is the date the terms were read. Terms change, and the record keeps the
  version we relied on.
- **The schema refuses** a bank image without an approved review, or with `commercialUse` or
  `clientsMayPublish` not true.

### What the reviewer checks

- **No face,** and no tattoo or other feature that identifies someone.
- **No brand, logo or lettering,** including the garbled pseudo-text AI tools draw on signs and
  labels.
- **No visible artefacts:** extra fingers, warped tools, impossible objects.
- **Plausible for a small business in Spain.**
- **The licence re-read for the exact tool and plan used.** Free plans often have different terms
  from paid ones.

### Compression

- **WebP, longest side 1600 px, quality around 75,** with EXIF and XMP removed. The origin is in
  the record, not in the file.
- **A test:** every bank image weighs at most 200 KB, and its file matches its declared width,
  height and bytes.
- **The ZIP carries only the images the document references.**

### How a sample photo is known

- **The document says so.** An image element gets an optional `sample` field holding the bank id.
  - This is a schema change: its own migration and round-trip test, in the exclusive zone.
  - Replacing the photo removes the field.
- **The renderer never emits it,** so the published HTML is the same with or without it.

### How the client is warned before downloading

1. **In the editor,** every sample photo carries a "Foto de ejemplo" label. The editor draws it
   over the canvas, not the renderer, so it can never reach the published site. Clicking it opens
   "Cambiar foto".
2. **Before downloading,** the review before publishing (protocol 8.5, screen 6) lists the sample
   photos with their thumbnails:

   > Tu web tiene 3 fotos de ejemplo. No son de tu negocio, y quien visite tu web puede pensar que
   > sí.

   Each photo has a "Cambiar" button, and there is one "Descargar igualmente" button.
3. **It warns, it does not block.** The photos are licensed to be published. The risk is that the
   client's customers take a sample salon for the real one, and once the client has been told,
   that is the client's decision.
4. **Nothing marks a sample photo inside the downloaded site.**

The wording above is a draft. It goes to `locales/es.json` when the screens are built.

## Consequences

- **ADR 0009's open item "the photo bank" is settled here.**
- **Phase 1's generator needs this bank,** because the cover requires a photo. Uploading the
  client's own photos is phase 2 (dossier: "fotos (subida y banco de imágenes)"). So in phase 1
  every generated site has only sample photos, and the warning before downloading arrives with
  downloading, in phase 2.
- **The images are binary files in the repository:** about 11 × 8 × at most 200 KB, so at most
  around 18 MB. Replacing an image keeps the old one in the history, so replacements should be
  rare.
- The package goes into the repository tree of protocol 3.4 when it is created.

## Evidence from session 1 (26 September 2026)

> One business, run against the deployed editor. ADR 0017 calls the two sessions «two
> experiments of one subject each»; one of them is not a tendency, and nothing below is
> written as one.
> Source: `docs/sessions/2026-09-25-taberna-santo-domingo.md`.

**Unprompted** — the facilitator's script keeps the sample photo as the one disclosure still made
at screen 07, but he raised it himself:

> «La foto de muestra es pobre pero entiendo que debo añadir mi propia foto para que luzca
> profesional»

Both halves matter, and they say different things:

- **«Es pobre»** is a verdict on the placeholder this ADR chose to ship (`placeholder-image.ts`, a
  grey inline SVG reading "Tu foto aquí"). It is doing its job — it reads as a placeholder — and he
  disliked it, which is what a placeholder that reads as a placeholder earns.
- **«Entiendo que debo añadir mi propia foto»** is the more useful half: the affordance was
  understood without being explained. He knew the photo was his to replace. That is the assumption
  this ADR rests on, and it had never been checked with anyone.

Asked separately what the site lacked, he led with «potencia visual, muchos mas elementos gráficos
e imágenes», and when asked about the texts he said they «dependerían del contenido visual e
imágenes» and that the page felt «vacía y fría». **He did not separate the photo problem from the
text problem.**

**This does not close the photo bank.** He said he would add his own photo; a sector bank is for
the owner who will not, and for the site that has to look finished before anyone uploads anything.
Both remain needed, and they are different features.
