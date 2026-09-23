# 0015 — The interface has its own tokens, and they never reach a client's site

**Status:** accepted · **Date:** 2026-09-23 · **Decided by:** the CEO

## Context

The phase 1 screens (`docs/design/HANDOFF.md`, D5 and D6) fix what the product looks like: the
colours, the typeface and how the brand appears inside the application. The dossiers' own
interface images are high fidelity, so the design session treated them as the reference and
reproduced them.

There are now two palettes in the project, and confusing them would be expensive in one specific
direction: a client's site picking up Retorika's blue would make every generated site look like
ours, which is the opposite of what the product sells.

## Decision

**The application's interface has its own tokens:**

| Token | Value |
|---|---|
| App background | `#F5F7FA` |
| Card / panel | `#FFFFFF`, radius 20 for dialogs, 11–14 for controls |
| Border | `#E8ECF2` / `#E3E8F0` |
| Ink | `#0F172A` |
| Muted text | `#64748B`, placeholder grey `#94A3B8` |
| Brand blue | `#156FE7` — actions, selection, links |
| Selected surface | `#F1F7FE` / `#E8F1FE` |
| Confirmation green | `#03D26E` — the `Guardado` tick |
| Fuchsia | `#FF3A72`, accents only, never large areas |
| Interface typeface | Inter |

**The brand inside the product** is a small rounded blue square with a white "R" next to the
wordmark, which is what the dossier's own interface images show. The full logotype — the R with
the hammer and blocks — belongs outside the product: the landing page, the invoice, the
presentation.

**And the rule that matters most:**

- **These tokens are not `packages/tokens`.** They never enter a document's theme, never travel
  in a client's ZIP, and no generated site is styled from them.
- **A client's site is styled only from `packages/tokens`,** whose palettes and type pairs have
  their contrast asserted for every text pair, and whose values come from the client's own logo
  or their sector's default (ADR 0010).
- The published site keeps carrying no reference to Retorika at all (ADR 0008).

## Consequences

- When `apps/editor` exists, these values live in its own styles, next to it, and not in
  `packages/tokens`.
- `packages/renderer` cannot import them. The dependency allowlist (`pnpm renderer:deps`) is
  where that stays true.
- Inter is loaded for the interface the way an application loads a font. A published site never
  depends on a font being fetched (ADR 0001).
- **The editor's shell — the bar heights, the rail width, the toolbar's contents — is not decided
  here.** It is drawn in the mockups and written down in `docs/design/REVIEW.md`, where it can
  change as the editor is built without amending an ADR.
