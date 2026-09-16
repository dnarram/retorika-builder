# Phase 0 skeleton and test harness

> **Claude-only task.** It touches `packages/schema`, `packages/renderer` and
> `packages/catalog`, which are exclusive zones under Part 2 of the protocol. It is never
> delegated to OpenCode.

## Objective

A pnpm monorepo exists with the document model, the renderer and the catalog's first section,
and the document's rules are enforced by tests that fail when a rule is broken — not by good
intentions.

## Where it comes from

- Protocol Part 14, Phase 0 (walking skeleton) and Part 3.4 (repository structure).
- Protocol Part 8 (invariants and their harness) and Part 9.1 (local reviewer).
- Advanced dossier §11, "Lo que cuesta no decidirlo ahora": the document must support grid
  coordinates, style-as-system values, per-device variants and collection references from day
  one, even though the Phase-1 interface exposes none of them.
- ADRs 0001–0004, written before this code.

## Files that may be touched

Closed list. Nothing outside it without asking.

```
package.json  pnpm-workspace.yaml  tsconfig.base.json  biome.json  vitest.workspace.ts
.nvmrc  .npmrc  .gitignore  .claudeignore  .env.example  .pre-commit-config.yaml
CLAUDE.md  README.md

docs/document-rules.md
docs/decisions/0001-static-published-sites.md
docs/decisions/0002-document-invariants-restated.md
docs/decisions/0003-section-deletion-is-permanent.md
docs/decisions/0004-role-vocabulary-v1.md
docs/tasks/skeleton.md
docs/protocolo.md                     (authorised corrections only: Parts 3.5, 4.4, 9.1, 18, 20)

packages/schema/**
packages/catalog/**
packages/renderer/**
scripts/schema-guard.ts
scripts/renderer-deps.ts
fixtures/documents/**  fixtures/golden/**  fixtures/assets/**
```

`docs/dossiers/*.docx` are **not** in the list. They are the board-approved artefacts and stay
untouched; `docs/document-rules.md` supersedes the technical annex instead.

## Invariants it touches

All five, and this task is where they first exist. Their canonical identifiers and names live
in exactly one place, `packages/schema/src/invariants-catalog.ts`; `docs/document-rules.md`
transcribes them and a test fails if the two ever disagree.

| Id | Proven by |
|---|---|
| `INV_1` | `listEditableFields` over the corpus and over generated documents, plus `checkAgainstPreset` on every corpus section |
| `INV_2` | dropping `layout` yields content equivalent to the catalog preset |
| `INV_3A` | fast-check property: structure and content equality, ignoring timestamps |
| `INV_3B` | fast-check property: no content id lost; surplus present with `hidden: true`; `applyRevert` throws without an explicit decision |
| `INV_4` | **provisional in Phase 0** — see below |
| `INV_5` | render determinism over the corpus, with and without the flag |

**`INV_4` is provisional and must not be read as covered.** The design-tools switch does not
exist in Phase 0, so the only thing genuinely verified is that the document schema *rejects* a
`designTools` key. What completes it — toggling the real switch a hundred times over a real
document — arrives with the editor in Phase 1. An invariant flagged as incomplete is worth more
than one that looks covered and is not.

## Steps

1. This file, then `docs/document-rules.md` and ADRs 0001–0004, then the `docs/protocolo.md`
   corrections. Commit `docs:`.
2. Monorepo root: workspace, TypeScript, Biome, Vitest, version pins, ignore files.
   Commit `chore:`.
3. `packages/schema`: invariants catalog, roles, token namespace and `Theme`, document schemas,
   `checkInvariants`, `parseDocument`, `listEditableFields`, `checkAgainstPreset`,
   `escalate`/`planRevert`/`applyRevert`, `migrations/0001-initial`. Commit `feat:`.
4. `packages/catalog`: the Portada section with its slots, roles, cardinality and two variants;
   Spanish strings only in `src/locales/es.json`. Commit `feat:`.
5. `packages/renderer`: `render(doc, target, options)` for `"html"` and `"dom"`, one shared node
   tree, embeds off by default, escaping, determinism. Commit `feat:`.
6. The harness: fixtures including `xss-attempt.json`, golden files, the five invariants, the
   documentation-sync test, the guard scripts and `.pre-commit-config.yaml`. Commit `test:`.

Six commits on `feat/phase-0-skeleton`. Stop at the first red verification step.

## Definition of done

- [ ] New tests that failed before and pass now
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green
- [ ] `pnpm test:invariants` green, reporting every invariant under its canonical name
- [ ] If the published output changes: golden regenerated and the diff reviewed
- [ ] If the schema changes: migration and round-trip test
- [ ] Interface text in Spanish and in the translation file
- [ ] No keys or real data in the code

## Out of scope

The editor and any UI. `apps/editor`, `apps/serve`, `packages/tokens`, `packages/publisher`,
`packages/templates` — no stubs and no empty directories; the README's tree says which phase
each one arrives in. Next.js, Supabase, Stripe, R2. Playwright, axe-core, Lighthouse. The
GitHub Actions workflows of Part 9.2. `.claude/skills` and `.claude/commands`. Every catalog
section other than Portada. ZIP packaging and the publish path.
