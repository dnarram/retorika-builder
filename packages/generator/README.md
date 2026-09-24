# @retorika/generator

The five questionnaire answers → a real, validated `RetorikaDocument`. `generate()` calls
`parseDocument` before returning, so a generator bug fails here, loudly, rather than publishing.

## What it assembles

| Section | Generated when | Reads |
|---|---|---|
| `cover` | always — headline and image are always resolvable | `@retorika/copybank`, the placeholder image |
| `services` | question 3 has at least one service ticked or typed (ADR 0013: zero means no section) | the bank's suggestions, for a ticked service's description |
| `location` | question 4 was answered and "no tengo local" was not ticked | the address and hours as given |
| `contact` | the main action resolves to a real destination — `primaryAction` is required (1..1), so it is never generated pointing nowhere | `resolveDestination` |

The three real compositions in `variants.ts` are the ones
[`docs/design/prototype/`](../../docs/design/prototype/) already used and the CEO approved: same
content, three real layouts.

## What this generator does not do yet, and why

Each is a real gap, decided with the product owner, not silently worked around:

- **No image the owner uploaded is ever used.** The cover's `image` slot always gets the same
  inline placeholder (`placeholder-image.ts`), the same one
  `docs/design/prototype/*/assets/foto-muestra.svg` used, because `packages/photobank` does not
  exist — ADR 0011 needs real photos, generated and reviewed like the text bank.
- **The logo is captured, never analysed.** ADR 0010 says "sin logo, la paleta por defecto del
  sector"; every generation uses that default (`theme.ts`), whether or not a logo was uploaded,
  because colour extraction from an image is not built.
- **`{ciudad}` is never filled.** Question 4 collects one free-text address, never a separate
  city, so `factsFor()` always leaves it undefined and every text falls back to its city-less
  sibling — safe by construction, since ADR 0009 requires that sibling to exist.
- **The `map` slot is never filled.** It needs latitude/longitude; question 4 collects an address
  only. Left absent — it is optional in the catalog (0..1) — rather than geocoded, the same shape
  as ADR 0004's other half, still pending a tile provider.
- **"Que vengan al local" builds no link.** The published HTML carries no real section `id`
  (only `data-section`, not something an in-page anchor can jump to), and adding one rewrites
  every golden's `<body>` — deferred with issue #19, past the usability sessions.

None of these need a schema or catalog change to fix later: they are gaps in what this package
knows how to read, not in what a document can express.
