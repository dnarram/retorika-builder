# 0030 — One breakpoint bucket, and the canvas shows the width the gate measures

**Status:** **proposed** · **Date:** 2026-10-02 ·
**Decided by:** David, 2 October 2026, approving the sprint 12 plan — asked which of three things to
do with the tablet hole, and chose «el esquema lo rechaza» ·
**Awaiting:** his signature on this file ·
**Touches:** the advanced dossier §4 (which it **does not keep**),
[ADR 0004](0004-role-vocabulary-v1.md) (the minor/major asymmetry this reads against),
[ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md) §2 (whose overflow
check is the gate below), document rule 7, protocolo Part 14's Fase 3 — «control por dispositivo»

> **`proposed` is literal.** The decision is David's — he was given three options and picked one —
> but he has not read this file. Development does not sign on anybody's behalf.
>
> **Two things in one ADR, and they are one decision.** Both are the same sentence said twice: *the
> editor must not hold a state it cannot publish, and must not measure one width while showing
> another.* The tablet bucket was a shape the schema accepted and the renderer refused; the mobile
> canvas was a width the gate measured and the canvas did not show. Separating them would file the
> same reasoning twice.

## Context

### A document the product could build and could not publish

Measured, not recalled:

| | |
|---|---|
| `packages/schema/src/document.ts` | accepted `breakpoints.tablet` as an optional array of patches |
| `packages/renderer/src/build.ts` | **threw** on a non-empty one, since sprint 8 |

So a document carrying a tablet patch was valid, storable and autosavable, and was refused at the
one moment that mattered — the download. That is an invalid state the schema held open and the
renderer repaired, which is the wrong way round: the cheap place to refuse a shape is where shapes
are decided.

**Nothing could produce one.** The editor writes mobile patches only (`setMobilePatch`); the
questionnaire and the catalogue never touch breakpoints. So the hole was reachable only by hand.

**But the key was everywhere.** `packages/catalog/src/layout.ts` wrote `breakpoints: { tablet: [], mobile: [] }`
into **every section layout it ever built**, so nine stored documents carry the key — three fixtures
and six prototype documents — and every single one holds `[]`. The key present, never a patch.

### A warning that sent the owner where the problem is not

Three widths, and the owner never saw the one they were told about:

| Where | Width |
|---|---|
| `overflowCheck.NARROWEST_WIDTH` — what the pre-download gate measures | **320** |
| `EditorShell` — the canvas in the mobile device view | **400** |
| `build.ts` — where rule 7's patch takes over | **720** |

The gate's own words are «A 320 píxeles de ancho —el móvil más estrecho— … **Míralo en la vista de
móvil**». The mobile view was 400 pixels wide, where what it had just measured does not happen.

**The 400 has no recorded reason.** It arrives in one commit, `900804d`, whose message says only
that the canvas narrows «and the renderer's own responsive CSS takes over» — which 720 already
decides, so any width below it would have done. And **mockup 14 draws the phone at 330px with 12px
of padding**, about 304 of page: the approved drawing was never 400 either.

## The decision

### 1. The schema refuses a tablet bucket

`breakpoints` holds one key, `mobile`. Migration `0005` strips `tablet` where it is present, and the
renderer's throw is **removed** rather than kept.

**Why removed, against the sprint plan's own expectation.** The plan said the guard should stay as a
dead one that documents the rule. Once the schema refuses the shape, keeping it means casting past a
type that states the bucket cannot exist in order to look for it — and the renderer re-validates
nothing else the schema guarantees: not the role vocabulary, not that a placement names a real
element. One place knows the shape, and it is the one whose job that is. The refusal moved; it did
not disappear, and the test moved with it.

### 2. It is a minor, 1.3.0 → 1.4.0, and migration `0003` is why

ADR 0004's asymmetry says removing breaks and bumps the **major**. It says that of the role
vocabulary and the token namespace, not of a structural key, so it does not settle this on its own.

**Migration `0003` does, and it is the closest precedent in the repository.** It closed the style
vocabulary — a *narrowing*, where `{"wobble": …}` parsed yesterday and does not today — and took a
**minor**, on one argument: «the set of affected documents is empty». The same is true here and was
counted rather than assumed: no producer writes a tablet patch, no stored document carries one, and
the renderer refused one anyway.

**And, exactly as `0003` warned of itself, that window was open once.** The day somebody writes a
real tablet patch, `up` has to choose between dropping it silently and locking them out of their own
site. There is a test named after that case so the choice is visible rather than discovered.

### 3. The mobile canvas is the width the gate measures

`NARROWEST_WIDTH`, **imported** from `overflowCheck.ts` rather than written a second time. One
number: the width the warning names, the width it measures, and the width the owner is sent to look
at are now the same 320.

## What this does not decide

**It does not keep the advanced dossier §4's promise**, which reads «Escritorio, tablet y móvil,
editables», and it does not pretend to. A tablet breakpoint is a third stylesheet width, a third
device in the toggle and a third patch target; it belongs with «control por dispositivo» in the
protocol's Fase 3, and nobody has asked for it. **What changes today is only that the document can
no longer hold a half of it that never worked.**

It also decides nothing about what «mobile» should look like beyond its width, and nothing about the
three adjustments rule 7 allows, which are unchanged.

## Consequences

- **`SCHEMA_VERSION` is 1.4.0.** A stored session or a prototype document written before it opens
  through `migrateToCurrent`, which strips the key — including the six session records under
  `docs/design/prototype/`, which are left exactly as the sessions produced them.
- **The golden corpus does not move**, and that is the check rather than the hope: an empty array
  drew nothing, so removing it changes no published byte. Verified, with no diff.
- **The mobile preview is narrower than most phones**, deliberately. It is the narrowest one, which
  is what the gate promises to protect and what the dossier's own «avisa» is about.
