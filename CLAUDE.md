# Retorika Builder

A tool for a small business to build its own website in under ten minutes without coding,
and for the Retorika team to build client sites and hand them over. The user answers five
questions, gets a finished site back, and only corrects what they do not like — they do not
build a site, they correct one. The same editor serves both audiences; what changes is who
builds and who maintains.

Source of truth: `docs/dossiers/` (approved, and they win over the code), `docs/document-rules.md`
(the document model), `docs/decisions/` (ADRs, which win over the dossiers where they say so).

## The architecture constraint — read this first

**The published site is static HTML and CSS.** No React, no runtime framework, no dependency
on any API of ours. A downloaded site must work when opened by double-clicking it, with no
server and no network. JavaScript appears only in sections that genuinely need one.

This is the constraint that is easiest to forget while writing code, and the one everything
else rests on: the download promise, the single price, and the cost per site. If a solution
requires the client's site to call our API, the solution is wrong. See ADR 0001.

One renderer, two targets — `render(doc, "dom")` and `render(doc, "html")` — from one shared
node tree. Two renderers diverge, and then the user sees one thing while editing and another
once published.

## The seven document rules

Full text and amendments in `docs/document-rules.md`.

1. Layout never owns content: it holds references only.
2. Every element carries a role from a closed vocabulary.
3. **Within a section**, a role hides — it is never deleted. (Deleting a whole section deletes
   its content; there is no trash inside the document. ADR 0003.)
4. Positions are relative to the section's grid, never absolute on the page.
5. No orphan elements: every element belongs to a section, every section to a page.
6. Style is references to the system; an exact value is a marked exception.
7. Mobile is a patch over the automatic derivation, not a parallel tree.

If a task seems to require breaking one, the task is wrong. Write an ADR before touching code.

## Zones only Claude touches

`packages/schema`, `packages/renderer`, `packages/catalog`, database migrations, anything that
touches money, and anything that touches permissions or ownership. Never delegated to OpenCode,
regardless of how mechanical the change looks.

## Commands

| Command | What it does |
|---|---|
| `pnpm test` | Everything |
| `pnpm test:invariants` | The five invariants of Part 8.2, by canonical name |
| `pnpm test:golden` | Generated HTML against the stored corpus (`UPDATE_GOLDEN=1 pnpm test:golden` regenerates) |
| `pnpm typecheck` | `tsc --build` across the workspace |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm size` | Published-page weight budget |
| `pnpm schema:guard` | Migration guard; takes an optional diff range |
| `pnpm renderer:deps` | Renderer dependency allowlist |

`pnpm dev` and `pnpm e2e` do not exist yet — they arrive with the editor and the publish task.

## Language

Code, comments, commits and documentation in **English**. Interface text in **Spanish**, and
always in a translation file (`packages/*/src/locales/es.json`), never inline in a `.ts` file.

Note that `docs/protocolo.md` and the dossiers are in Spanish. They are the user's own
documents; do not translate them.

## Style

- No class where a function does.
- No abstraction at two uses; wait for the third.
- Explicit errors, never silent fallbacks. An unknown section or variant throws rather than
  rendering an empty box, because the empty box gets published.
- **No new dependency in `packages/renderer` without discussing it.** Everything there travels
  to the client's site, and the allowlist hook will reject it anyway.
- The renderer is deterministic: no clock, no randomness, sorted output. The golden tests and
  `INV_5` depend on it.

## Before calling something done

- [ ] New tests that failed before and pass now
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green
- [ ] `pnpm test:invariants` green
- [ ] If the published output changed: golden regenerated and **the diff reviewed**
- [ ] If the schema changed: migration and round-trip test
- [ ] Interface text in Spanish and in the translation file
- [ ] No keys and no real client data in the code

Commit from the Terminal, not from an editor's source-control panel: macOS desktop apps do not
read the shell configuration, so the hooks would run without the pinned Node.
