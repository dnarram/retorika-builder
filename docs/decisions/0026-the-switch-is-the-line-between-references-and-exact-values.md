# 0026 — The switch is the line between a reference and an exact value

**Status:** **accepted** · **Date:** 2026-09-30 · **Amended:** 2026-09-30 (sprint 9 days 5 and 6, §2)
· **Proposed by:** development · **Accepted by:** **David, 1 October 2026 — not direction**
· **Amends:** `docs/design/REVIEW.md` ("Not implemented, and not planned: mockup 13's «Avanzado:
colores exactos y tamaños»") · **Touches:** document rule 6, the advanced-module dossier §§1, 4, 6, 9
and 11, the concept dossier §§3 and 5, ADR 0025 (the switch), `docs/tasks/a11y.md`,
`docs/tasks/theme-css-values.md`

> **Who accepted this, and what that does not mean.** The day-1 gate said the CEO would read this
> ADR and mockup 17 before the pull request merged. That is not what happened: **David read it and
> accepted it himself**, and the merge of PR #106 was his act rather than direction's. It is written
> here in the same words §3 already uses about the two contrast thresholds, and for the same reason
> — an accepted ADR gets cited later, and nobody should be able to read "accepted" here as
> "direction agreed".
>
> **Direction has still not seen it**, and there is a reason that is worth keeping visible rather
> than closing quietly: this ADR **amends `REVIEW.md`** and reconciles two *approved* documents —
> the concept dossier §§3 and 5 against the design review. Approved documents are direction's.
> Whether direction wants to look is direction's to decide, and until it does, the row in
> `docs/tasks/backlog.md` says so.

> **What is decided.** Rule 6 has two arms — «el estilo son referencias al sistema; un valor exacto
> se guarda como excepción marcada» — and until now only the first has existed in any screen. This
> decides that **the design-tools switch is the line between them**: references for everybody, an
> exact value only for someone who has said that building sites is their job. And it decides the
> safety net that makes the second arm shippable at all: **a contrast review before publishing, in
> two levels, whose one-click fix is to drop the exception**.

## Context

### Two approved documents contradict each other

- **Concept dossier §3 and §5:** «Los códigos de color exactos siguen existiendo, pero detrás de un
  "Avanzado" plegado que la mayoría no abrirá nunca.»
- **`docs/design/REVIEW.md`:** «Not implemented, and not planned… **A picker is a machine for
  producing** [untested contrast], **and a site built with one is a site that gets published**.»

Both are right about what they are looking at. The dossier is describing a professional who needs a
brand's exact hex; the review is describing what a free colour picker does to a small business owner
who cannot see the damage they are causing. A decision that simply picked one would throw away a
real requirement or ship a real hazard.

### The reconciliation was already written, and never built

The advanced dossier §4 carries it, and `docs/tasks/a11y.md` has been citing it since sprint 2:

> «**Antes de publicar, una revisión avisa de contraste insuficiente** o de desbordes por debajo de
> 320 píxeles, **con arreglo en un clic**.»

So the exact value is not gated on a folded «Avanzado» panel. It is gated on **a review that runs
before the ZIP leaves**, which is a thing this repository already knows how to do: `downloadGate.ts`
holds two of them (a dead destination blocks, too-few photographs warns) and
`DownloadGateDialogs.tsx` draws both.

### The engine has been finished and unread since phase 0

`styleValueSchema` — `{ref}` or `{exact, exception: true}` — has been in
`packages/schema/src/tokens.ts` since the first sprint, sits on `ContentElement.style`, and is frozen
in `schema-snapshot.json`. **Nothing reads it**: not the renderer, not the publisher, not the
catalogue, not the editor. Its own comment promises an audit that does not exist: «what lets a
**future** audit list every place that opted out of the system». And
`docs/tasks/theme-css-values.md` left this sprint an instruction by name: «**Rendering
`ContentElement.style` exact values.** They are not emitted today. When they are, they cross the same
boundary and must go through the same guard. **That belongs to the task that starts emitting them.**»

## Decision

### 1. The switch is the line, and it is the dossier's own line

The advanced dossier §4's table, quoted rather than paraphrased:

| Row | Off | On |
|---|---|---|
| **Floating toolbar** | «Texto, tamaño, **color del tema**, enlace» | «Añade **posición, medidas y espaciado**» |
| **Style panel** | «Paletas y parejas tipográficas» | «Añade **el sistema** y tipografías propias» |

Read carefully, that table is rule 6 said twice. **Off, the toolbar offers `color del tema` — a
reference, not a colour.** And **on, it adds no colour and no typeface at all**: it adds position,
measurements and spacing. So:

- **A reference is for everybody.** No switch, no panel, no gate.
- **An exact value exists only with the design tools on**, and only as `{exact, exception: true}`.

This is not a new rule. It is where the two halves of rule 6 were always going to divide, written
down so the code cannot drift from it.

### 2. An exact **colour** and the contrast review ship together, or neither ships

An exact colour without the review is precisely what `REVIEW.md` refused in writing. They are one
deliverable in two files, and the cut line runs around both of them: if the review does not land,
the colour half waits and the sprint ships references only.

> **Made precise on sprint 9 day 5, because acting on it required it.** This first said «exact
> values», which is broader than the argument underneath it and broader than what has to be coupled.
> Each day of this sprint is merged and redeployed on its own, so shipping the exact-colour control a
> day before its review would put a deployed editor in exactly the state this ADR refuses — for a
> day. Shipping an exact **padding** would not: a 20px gap carries no legibility claim, nothing
> measures it, and there is nothing for a review to say about it.
>
> So the coupling is named by property:
>
> | Exact value | Ships with |
> |---|---|
> | `padding`, `borderRadius` | Day 5, alone. Pure geometry — no contrast, no legibility |
> | `color` | Day 6 only, with the two-level contrast review |
> | `fontSize` | **Not this sprint.** Not for contrast — every proved pair clears 4.5:1 at any size — but because the dossier §4 promises the same pre-publish check covers «desbordes por debajo de 320 píxeles», and an exact size is the one value in this vocabulary that can cause one. Nothing measures that yet |
>
> The record is changed rather than the reading, which is the point of writing it down.
>
> **Closed on day 6 for colour, and left open for size.** The review landed and the exact-colour
> control landed with it, in the same merge, which is what this section asks. `fontSize` moved from
> «day 6» to «not this sprint» when it became clear that the overflow half of the §4 sentence is its
> own piece of work — a measurement at 320px that nothing in the editor makes today — rather than
> something to bolt onto a contrast gate. Offering an exact size behind a gate that cannot see the
> thing it would cause is the shape of promise this ADR exists to refuse.

### 3. Two levels, and who decided them

**David decided the two levels below, in the planning of sprint 9. Not direction.** It is written
that way here on purpose: the reconciliation between the concept dossier and `REVIEW.md` is a
development proposal, and a later reader must not be able to cite it as an agreement direction made.
**Mockup 17 and this ADR go to the CEO before the day-1 pull request is merged.**

| Contrast | What happens | Why that number |
|---|---|---|
| **< 3:1** | **Blocks the download**, with a one-click fix | It does not even clear AA for large text. Same family as the dead destination: there is nothing to warn about, only something to fix first |
| **3:1 – 4.5:1** | **Warns**, with a one-click fix | Clears AA for large text and fails it for normal text. Same family as marker text: say so and let them decide |
| **>= 4.5:1** | Silence | It meets AA |

The thresholds are WCAG's own, and they are the ones this repository already measures —
`packages/tokens/src/contrast.ts` implements WCAG 2.1 and `contrast.test.ts` asserts every palette
pair at 4.5:1. Nothing new is being invented, and nothing is being relaxed.

**The one-click fix is to remove the exception** — back to the reference the exact value overwrote.
That is the honest repair because it is rule 6's own default state, not a colour somebody's code
guessed at.

### 4. A reference is not automatically safe, so the toolbar offers per element

`color.surface` text on a `color.surface` background is 1:1 — invisible — and it is a perfectly legal
`{ref: "color.surface"}`. Offering all five colour roles everywhere would reproduce in miniature
exactly the hazard `REVIEW.md` rejects at full size. So:

- **The element's background is derived, never assumed**: `[role=button]` sits on `color.primary`, an
  element over a photograph sits on the `panelArea` panel, everything else sits on `color.surface`.
- **A role is offered only when its pair against that background is asserted** in
  `packages/tokens/test/contrast.test.ts`. Today that is ink, primary, secondary and muted against
  surface. **A role with no asserted pair is not drawn — not drawn greyed out.**
- **`color.accent` is out at the schema level**, not merely absent from a swatch row. No rule the
  renderer emits reads `var(--color-accent)`, its contrast is asserted nowhere, and
  `packages/renderer/test/theme-css.test.ts` fails if any corpus document starts reading it. As
  `REVIEW.md` puts it: «the fix then is a contrast pair first, not a relaxed test».

### 5. The property vocabulary is closed, and each property is bound to its token family

Today the style map's key is an open `z.string()`: `{"wobble": {ref: "color.primary"}}` parses. Worse,
a flat enum of property names would still admit `{color: {ref: "space.md"}}`, which publishes
`color: 16px` — a dead reference nobody discovers until it is on a client's site. So four properties,
each with its own narrowed set of admissible references:

| Property | References admitted |
|---|---|
| `color` | `color.primary`, `secondary`, `surface`, `ink`, `muted` — **no `accent`** |
| `fontSize` | `size.heading`, `subheading`, `body` |
| `padding` | `space.xs` … `space.xl` |
| `borderRadius` | `radius.sm`, `md`, `lg` |

**The vocabulary is disjoint from `{display, order, width, grid-*}`, and that is rule 7 rather than
tidiness.** A media query adds no specificity, so a per-element style rule outranks a mobile patch:
if `display` were in the vocabulary, an element hidden by its own mobile patch would **reappear on
the phone**, and rule 7 would lose silently.

### 6. An exact value is hex or nothing

An exact value is emitted literally and passes through `cssThemeValue`
(`packages/renderer/src/escape.ts`), which is the guard `theme-css-values.md` reserved for this work.
Its allowlist admits `#`, letters, digits, space, `. , - % _` and quoted families, and **refuses
`;{}()`** — so `rgb()`, `var()`, `calc()` and `url()` are impossible by construction rather than by
vigilance.

### 7. Reverting a section keeps the style of its elements

`applyDecisions` copies each element whole (`{ ...element }`,
`packages/schema/src/revert.ts:116`), so **per-element style survives «Volver a la plantilla»**:
reverting drops the section's hand-made layout and leaves its elements' colours and sizes alone.

That is the right behaviour — the two are different things, and the revert dialog talks about
placement — but until this sprint nobody had decided it, because there was never anything in `style`
to copy. It is decided here, and a test pins it, so the day somebody tidies that spread the revert
cannot quietly start erasing colours.

### 8. «El sistema» stops having a single setting

`packages/tokens/src/scales.ts` held **exactly one** `Scale`, `id: "default"`, which made the
dossier §6's «Escala tipográfica, espaciados, radios y sombras **como sistema**» a system with one
setting. There are three now — `compact`, `default`, `generous` — named by character and never by
number, which is the rule the type pairs already follow: "Compacta y nítida" is what the owner will
see; "0,875x" is what a developer chose.

`default`'s eleven values are unchanged to the byte, and deliberately: every document ever generated
carries them and the whole golden corpus renders with them.

## What this ADR refuses, and why

An ADR that does not say what it discarded invites the discarded thing to be redesigned in three
sprints as though it were new.

- **Typography, entirely** — neither a per-element `Aa` nor the §4 column's «**tipografías
  propias**». The style panel's On column reads «Añade el sistema **y tipografías propias**», and this
  sprint delivers the first half of that sentence and not the second. Issue #9 is open: `modern-sans`
  and `classic-display` fall back to the system font on a machine without Inter or Playfair Display,
  and ADR 0001 forbids downloading either. Offering a typeface before that is resolved is promising a
  letterform the visitor may never receive. #9 has four costed options and none of them is free; it
  is direction's and deserves its own ADR.
- **Alignment.** The worst-founded control of the set: **the advanced dossier does not mention it
  once**. It exists only in `HANDOFF.md`'s list and `REVIEW.md`'s. It has no token and no field, and
  it would be the only thing in the toolbar that is neither a reference nor a marked exception.
- **Bold and italic.** ADR 0024 stands; neither of its two waking conditions has been met, and its
  granularity is explicitly «a run of characters, not the whole element», which is its own sprint.
  Underline stays refused for good: on the web it means a link.
- **`Mover` / `Duplicar` / `Borrar` per element.** Moving already lives in the `Diseño` panel;
  **deleting an element collides with document rule 3** and the fields panel already achieves the
  same end by emptying; duplicating has no precedent and nobody has asked.

## Consequences

- `REVIEW.md`'s "not planned" entry is amended, not overruled: the picker it refused is still
  refused. What arrives is a marked exception behind a switch, with a blocking review in front of it.
- `styleValueSchema` gets its first reader, and `tokens.ts`'s promised audit gets built.
- The schema's shape changes (the map's key closes), so `scripts/schema-guard.ts` will require a
  migration and `SCHEMA_VERSION` moves to 1.2.0. **No existing document carries `style`** — no
  fixture, no prototype document, no producer — so the migration moves no data and the bump is minor
  rather than major. That is written in the migration's own header, because it is the whole
  justification and it **stops being true the day somebody writes styles against 1.1.0**.
- The audit cannot be called `audit-exceptions`: `scripts/audit-exceptions.ts` and
  `pnpm audit:exceptions` already exist and are about pnpm security advisories.
