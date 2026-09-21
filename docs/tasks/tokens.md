# packages/tokens — the values for the style system

> **Delegable to OpenCode.** This task touches no exclusive zone of Part 2. It supplies *values*
> for a namespace that `packages/schema` already declares and already validates, so the worst a
> mistake can do is produce a wrong colour, which the golden diff catches.
>
> **One hard boundary:** this task may not add, rename or remove a token key. The namespace is
> closed for schema version 1.0.0. Needing a new key is a schema change, which is exclusive —
> stop and ask.

## Objective

A document can be given a complete, valid `Theme` by naming a palette and a type pair, and no
palette that fails AA contrast can even be declared.

## Where it comes from

- Protocol Part 3.4: `packages/tokens` — "Sistema de tokens + tema propio de Retorika".
- Concept dossier §5, screen 4: *"Paletas con nombre y tipografías con vista previa real"*, and
  *"Cuatro paletas visibles bastan"*.
- Concept dossier §11: the Retorika corporate palette, and the recorded correction that the
  brand document's seven-digit `#ff3aa72` is wrong — the fuchsia is **`#FF3A72`**.
- `docs/document-rules.md`: the closed token namespace and the rule that a document's `theme` is
  a *complete* map — an unknown key is an error and a missing key is an error too.
- ADR 0004: adding a token key is additive and bumps the minor schema version.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/tokens/package.json
packages/tokens/tsconfig.json
packages/tokens/src/index.ts
packages/tokens/src/palettes.ts
packages/tokens/src/typography.ts
packages/tokens/src/scales.ts
packages/tokens/src/brand.ts
packages/tokens/src/theme.ts
packages/tokens/src/contrast.ts
packages/tokens/test/theme.test.ts
packages/tokens/test/contrast.test.ts
tsconfig.json                          (add the project reference only)
vitest.config.ts                       (add the "tokens" project only)
coverage-thresholds.json               (only if the floor rises; never lowered)
README.md                              (move packages/tokens to "here" in the phase table)
```

Copy `packages/catalog/package.json` and `packages/catalog/tsconfig.json` as the shape to
follow. The package name is `@retorika/tokens`, `"private": true`, `"type": "module"`, exports
`"." -> "./src/index.ts"`, and its only dependency is `"@retorika/schema": "workspace:*"`.

## Invariants it touches

**None of the five.** This task adds no document behaviour; it produces values that documents
carry. It does have one guarantee of its own, which the contrast test below makes real.

Rule 6 of the document rules is the relevant one in the background: style is references to the
system. This package is what those references point at.

## Steps

### 1. `src/palettes.ts`

```ts
import type { TokenKey } from "@retorika/schema";

/** The six colour keys of the namespace. Not re-derived by hand: imported and narrowed. */
export type ColorKey = Extract<TokenKey, `color.${string}`>;

export interface Palette {
  id: string;
  /** Shown in the style panel. Spanish lives in the locale file, not here. */
  nameKey: string;
  colors: Record<ColorKey, string>;
}

export const PALETTES: readonly Palette[];
```

Declare **at least four** palettes, per the dossier. Every palette fills all six colour keys.

**A palette does not have a dark counterpart.** Each palette is a complete theme on its own, and
a dark palette is simply another palette in this list with dark values. The document model has
exactly one theme and no dark concept; do not invent one.

Colour values are CSS colours as strings. Keep them literal (`#0F172A`), not computed.

### 2. `src/contrast.ts`

WCAG contrast is arithmetic on relative luminance. It needs no browser, so it is checked here,
at the source, rather than discovered later on a rendered page.

```ts
/** Relative luminance per WCAG 2.1, from an #rrggbb or #rgb string. Throws on anything else. */
export function relativeLuminance(color: string): number;

/** Contrast ratio per WCAG 2.1, always >= 1. Order of arguments does not matter. */
export function contrastRatio(foreground: string, background: string): number;
```

Implement exactly the WCAG formula: channel `c` in 0..1, linearised as
`c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4`, luminance
`0.2126 R + 0.7152 G + 0.0722 B`, ratio `(lighter + 0.05) / (darker + 0.05)`.

Parse `#rgb` and `#rrggbb`. **Throw** on any other form rather than guessing — a silently
mis-parsed colour would make the contrast test pass without having checked anything.

### 3. `src/typography.ts` and `src/scales.ts`

```ts
export type FontKey = Extract<TokenKey, `font.${string}`>;
export type SizeKey = Extract<TokenKey, `size.${string}`>;
export type SpaceKey = Extract<TokenKey, `space.${string}`>;
export type RadiusKey = Extract<TokenKey, `radius.${string}`>;

export interface TypePair {
  id: string;
  nameKey: string;
  fonts: Record<FontKey, string>;
}
export const TYPE_PAIRS: readonly TypePair[];

export interface Scale {
  id: string;
  sizes: Record<SizeKey, string>;
  spaces: Record<SpaceKey, string>;
  radii: Record<RadiusKey, string>;
}
export const SCALES: readonly Scale[];
export const DEFAULT_SCALE_ID: string;
```

Font stacks must end in a real generic family (`system-ui, sans-serif`), because a published
site must render on a machine that has none of our fonts. Declare at least three type pairs.
One scale is enough for phase 0.

### 4. `src/brand.ts`

Retorika's own tokens, for the **editor interface**, kept deliberately separate from the client
palettes above so nobody can hand a client Retorika's brand by accident.

```ts
export const RETORIKA_BRAND: Readonly<Record<string, string>>;
```

From dossier §11: blue `#156FE7`, dark blue `#105CB1`, fuchsia `#FF3A72`, green `#03D26E`, ink
`#0F172A`, white `#FFFFFF`. The fuchsia is `#FF3A72` — six digits. The brand document's
`#ff3aa72` is a typo the dossier itself records.

This constant is **not** exported into `PALETTES` and is not a default for any document.

### 5. `src/theme.ts`

```ts
import type { Theme } from "@retorika/schema";

export interface BuildThemeInput {
  paletteId: string;
  typePairId: string;
  /** Defaults to DEFAULT_SCALE_ID. */
  scaleId?: string;
}

/**
 * A complete Theme: every key of the namespace, no more and no fewer.
 * Throws on an unknown id, and throws if the assembled map is missing any key.
 */
export function buildTheme(input: BuildThemeInput): Theme;
```

The completeness check is not decoration: `parseDocument` rejects a partial theme, so a
`buildTheme` that returned one would push the failure to the far end of the system. Assemble the
map, then assert every key of the namespace is present before returning.

### 6. `src/index.ts`

Re-export the public surface: `Palette`, `PALETTES`, `TypePair`, `TYPE_PAIRS`, `Scale`,
`SCALES`, `DEFAULT_SCALE_ID`, `RETORIKA_BRAND`, `buildTheme`, `BuildThemeInput`,
`contrastRatio`, `relativeLuminance`, and the key types.

### 7. `test/contrast.test.ts` — the test that matters

**For every palette in `PALETTES`, assert AA on the pairs the renderer actually uses.** These
five are the complete list, read from `buildCss` in `packages/renderer/src/build.ts`. Do not
add pairs to it and do not drop any:

| # | Foreground | Background | Where it comes from |
|---|---|---|---|
| 1 | `color.ink` | `color.surface` | `body { color: var(--color-ink); background: var(--color-surface) }` |
| 2 | `color.primary` | `color.surface` | `.rb-section h1 { color: var(--color-primary) }` |
| 3 | `color.secondary` | `color.surface` | `.rb-section h2 { color: var(--color-secondary) }` |
| 4 | `color.muted` | `color.surface` | `.rb-section p { color: var(--color-muted) }` |
| 5 | `color.surface` | `color.primary` | `.rb-section [role=button] { background: var(--color-primary); color: var(--color-surface) }` |

**Require 4.5:1 on all five.** WCAG would allow 3:1 for the heading pairs as large text, but the
size that makes them "large" comes from the scale, so a stricter uniform floor cannot drift when
a scale changes. It is also the number that matters: a palette that cannot reach 4.5:1 on its
heading colour is not a palette worth shipping.

`color.accent` has **no pair** here, because the renderer does not use it for text today — the
dossier says accents are punctual and never on broad backgrounds. If a future section renders
text in the accent colour, this table grows at the same time and not before.

The failure message must name the palette, the pair and the measured ratio. A test that says
only "expected true" costs someone twenty minutes with a colour picker.

Also assert `relativeLuminance` throws on `"red"`, `"#ff"` and `""`.

### 8. `test/theme.test.ts`

- `buildTheme` with a valid palette and type pair returns a theme with **exactly** the namespace
  keys — compare sorted key lists against `TOKEN_KEYS` from `@retorika/schema`.
- Its output is accepted by `parseDocument` inside a minimal document. Build that document by
  copying the shape from `fixtures/documents/barbershop-cover.json`.
- Unknown `paletteId`, unknown `typePairId` and unknown `scaleId` each throw.
- Every id in `PALETTES`, `TYPE_PAIRS` and `SCALES` is unique.
- `RETORIKA_BRAND` is not one of the entries in `PALETTES`.

### 9. Wiring

Add `{ "path": "./packages/tokens" }` to the `references` array in the root `tsconfig.json`, and
a `"tokens"` project to `vitest.config.ts` with `environment: "node"`, copying the `catalog`
entry. Move `packages/tokens` to **here** in the README phase table.

## Definition of done

Run each of these and check the stated answer.

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop — the pin is not active |
| `pnpm install` | completes; `packages/tokens/node_modules` contains `@retorika` |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including the new `tokens` project |
| `pnpm vitest run --project tokens` | every palette reported by name in the contrast test |
| `pnpm test:coverage` | exit 0 — the floor holds. If coverage rose, raise `coverage-thresholds.json`; **never lower it** |
| `pnpm test:golden` | exit 0, unchanged — this task must not alter any rendered output |
| `pnpm coverage:ratchet` | `floor unchanged` or `floor raised` |
| `pre-commit run --all-files` | six hooks, all Passed |

- [ ] New tests that failed before and pass now
- [ ] Interface text in Spanish and in a translation file — `nameKey` holds a key, never a
      Spanish string in a `.ts` file
- [ ] No keys and no real client data
- [ ] `pnpm test:golden` unchanged: no rendered byte moved

## Out of scope

Things someone could reasonably add unasked, and must not:

- **A dark counterpart inside a palette.** Dark palettes are separate entries in `PALETTES`.
- **Any new token key.** The namespace is closed for this schema version.
- Changing anything in `packages/schema`, `packages/renderer` or `packages/catalog`.
- A colour picker, a palette editor, or any UI.
- Palette generation from a logo — that is the questionnaire, phase 1.
- Making `buildTheme` tolerant of partial input "for convenience". It throws.
- Per-breakpoint or per-section theme overrides.
- Touching `fixtures/` or regenerating golden files.

## If anything is unclear, stop and ask

The executor of this task may **not** decide any of the following. Stop and ask instead.

1. **A palette that cannot reach 4.5:1 on all five pairs.** Do not lower the threshold, do not
   exclude the pair, and do not quietly nudge the token values to slip past. Change the palette
   and say you did, or bring the palette and its numbers.
2. **Anything that seems to need a token key the namespace does not have.** That is a schema
   change: exclusive zone, minor version bump, migration. Not this task.
3. **Whether a specific palette is the right one aesthetically.** Four are required; which four
   is a product decision.
4. **Any change to `packages/renderer`'s CSS**, including "just to make a pair pass". The five
   pairs above are read from the renderer as it is. If the renderer should use different colours,
   that is a separate, exclusive task.
