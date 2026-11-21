# Logo samples

Each `.rgba` file is a logo of this repository sampled the way the editor samples it before reading
its colours (`logoImage.ts`): decoded by Chromium, drawn stretched into a 64×64 canvas, read back with
`getImageData` — 16 384 bytes of raw RGBA. `test/logoPalette.test.ts` reads them and pins what
`dominantColours` makes of each.

They are written by one command, with Chromium:

```sh
pnpm logo:samples
```

The list of logos is in `scripts/logo-samples.ts`. Run it again only when one of those logos changes or
the editor's sampling does; a changed sample turns a test red, and that is a decision, not a drift.

**Only files that are already in this repository.** David's own logos — the DNR files measured for
sprint 40's encargo 1 — never enter it (his adjustment 5 approving the sprint). They are measured
locally, by the brand test, which exists only when the folder holding them is named:

```sh
RETORIKA_BRAND_LOGOS=. pnpm test:brand
```

`dos-tintas` is their stand-in: `apps/editor/e2e/fixtures/logo-dos-tintas.png`, drawn for the purpose
(navy letters, a thin orange line with dots, a fixed-seed grain) with the structure measured on his files.
