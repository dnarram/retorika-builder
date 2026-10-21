# 0051 — The canvas keeps its document, and an edit is a patch

**Status:** proposed · **Date:** 2026-10-21 · **Decided by: David**, 21 de octubre de 2026, opening
sprint 26 with one open request — «busco mejoras sustanciales de las herramientas ya existentes en
el editor» — and, given four candidates with their cost, choosing the one that improves every tool
at once over three that improve one each: **«el lienzo que no reconstruye»**, alone, the whole
sprint, with seven adjustments while approving the plan, each quoted where it lands below ·
**Recorded by development, which does not sign** · **Relates to:**
[ADR 0001](0001-the-published-site-is-static-html-and-css.md) (the published page does not change by
a byte), [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) §7,
[ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md),
[ADR 0048](0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md) (the technical half of
«written on `pointerup`»),
[ADR 0049](0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) §3 and §4,
[ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md) (día 2
`measurePlaced`, día 7 one painter per document) — amended here where they lean on the rebuild ·
**Touches:** `packages/renderer` (one parameter of the `dom` target, two re-exports, one test),
`apps/editor` (the canvas), `apps/editor/e2e`, docs

## Context

**The protocol's own diagram was half built, and every tool in the editor paid for the half that
was not.** Protocol §3.2 — «Un solo renderizador, dos destinos» — draws two outputs from one tree:

```
documento ──► render(doc, "dom")   ──► nodos del DOM para el editor
        └───► render(doc, "html")  ──► cadena de HTML + CSS para publicar
```

The `html` target has published every site since phase 0. The `dom` target has existed just as
long (`packages/renderer/src/dom.ts`, twenty-nine lines, a `DocumentFragment` from the same
`RenderNode` tree) and **the editor has never called it**. It renders the `html` target into an
`<iframe srcDoc>`, and `Editor.tsx:1056` says what that costs in its own words: «Every action in
this editor replaces the iframe's whole `srcDoc`».

**What that cost, measured, by the day it was found:**

- A key press that lands while the frame is being rebuilt is **lost** — the window between the
  page being visible and its chrome being wired was 0.2 ms → 64.9 ms on a quiet machine and 1.5 s
  with the faces held (sprint 18 día 5), and text inserted by a verb was editable only ~14 ms after
  it appeared. ADR 0049 §4 named the loss as a cost of ADR 0001's architecture; sprint 25 día 6
  retired it for the arrow run only, by deferring the rebuild until the hand stops.
- **Two documents are live during an edit.** The buffered swap arrived on 6 October 2026 as
  `04bee33` — «fix(editor): the preview changes frame instead of going blank», 348 lines in
  `Editor.tsx` and 487 in the e2e — **and never had an ADR**; it appears in the record only as the
  día 7 amendment of ADR 0050, where a painter keyed to «the frame wired last» drew the touch
  handles into the document nobody was looking at. Everything that remembers anything across an
  edit has to survive two wirings: `keepWriting`, `keepChosenFocus`, `pendingReturn`,
  `restoreReadingPosition`, `focusLineAfterChange`, `wireOnce`, `chromeKey`, `lookAhead`, the
  `WeakMap` of painters — about seventy references in `Editor.tsx` and sixty-nine in the e2e
  (`data-buffered` 44, `replacingTheDocument` 25).
- The `aria-live` region that announces a keyboard move had to live **outside** the canvas,
  because a region inside it would be a freshly created one on every move (ADR 0049 §3).
- The sprint 18 intermittent: a bank photograph replaced the `srcDoc` thirteen milliseconds after
  the first document, before that document had been wired.
- `docs/tasks/backlog.md` has called «a canvas that does not lose its document on every edit» *the
  bigger change* since sprint 12, and nobody had budgeted it.

**What was put in front of David, with the cost of each.** Four substantial improvements to tools
that already exist: this one (every tool, a whole sprint alone, high risk, exclusive zone); the
text toolbar finished and the download review repairing in one click (four to five days); the
canvas chrome, the panels and the keyboard, as measured (four to five days); undo and named
versions (four to five days and an ADR). He chose the first, and on being told it is a change of
the editor's model and not a feature — the house rule is that such a change goes first and alone —
he kept it alone.

**Two things the plan got wrong and corrected before he chose, and one it told him wrongly.** The
page shifting 164 px when a panel closes is a re-layout by **width** — the page gets wider and
shorter and the browser clamps the scroll — and a patched document re-flows exactly the same way;
it was listed among this sprint's benefits and it is not one. The fonts no longer 404 (the editor
has served them from `app/fonts/[file]/route.ts` since sprint 14); what remains true is that `load`
waits for them and every new `srcDoc` asks again. And the device toggle does not touch the document.

## Decision

### 1. One `Document` per canvas, for the whole session

The first document is parsed from `render(doc, "html")`, so the first paint is the published bytes
and the look-ahead of sprint 18 still closes its window. **Everything after it is a patch** built
from `render(doc, "dom")` and applied to the live document in place. No `srcDoc` is ever set
again on a frame that has one.

**The fragment is built in an inert document** (David's adjustment 4): an `<img src>` created in a
document with a browsing context fetches its source the moment it exists, attached or not, so an
editor rendering the tree on every edit would fire one request per photograph per keystroke for
fragments it is about to throw away. `render(doc, "dom", { document })` takes the document the
nodes are born in — a generic parameter of the target, in `DomRenderOptions` and not in
`RenderOptions`, whose own first line is «options that change what reaches a published page» —
and the editor passes `document.implementation.createHTMLDocument("")`, which has no browsing
context and loads nothing. What the patch keeps is `importNode`d into the frame.

### 2. The patch is keyed on the renderer's own identities, under four rules

Nodes are matched by `data-section`, then `data-item`, then `data-id`, the menu's anchors by
`href`, and everything else by position among non-chrome siblings. Then:

1. **The chrome is invisible to the diff.** Every node the editor draws into the page carries
   `data-rb-chrome="1"`, set by one helper and no other way; the patch neither matches nor removes
   them, and a test holds `Editor.tsx` to the helper. The `rb-` class prefix is **not** the
   criterion — the renderer emits `rb-section`, `rb-panel`, `rb-list`, `rb-item`, `rb-nav`,
   `rb-page` and `rb-free` itself.
2. **The renderer's attributes are authoritative**, with a named list of what the chrome may keep
   on a renderer node (`tabindex`, `contenteditable`, `draggable`, `title`, `aria-describedby`;
   `role`, `aria-label` and `aria-current` on a `[data-section]` only, because the renderer puts
   them on the teaser's and the menu's own links), a named list of classes
   (`rb-selected`, `rb-chosen`, `rb-photo`, `rb-photo-host`, `rb-line`, `rb-designing`,
   `rb-placing`, `rb-resizing`, `rb-cursor-*`), and **no inline `style` ever written by the chrome
   onto a renderer node** (adjustment 3): `style` is the document's — a placement — and the fresh
   value always wins. The `position: relative` a photograph's parent used to receive and the
   cursor the border zone used to set become the classes above.
3. **The children of the editable element with focus are not touched** — unless the change comes
   from the history (adjustment 2). A patch caused by undo or redo applies to the focused text as
   well, keeping the caret by its offset in the plain text; and a `blur` commits only if the
   document has not changed that text since the `focus` (compared against the original re-read
   on `focus`, not captured at wiring). Without the second half, Ctrl+Z inside a text would be
   deferred and the next `blur` would quietly put the undone words back.
4. **A patch that lands in the middle of a gesture waits** (adjustment 3): while a drag, a resize
   or a run of arrows is live, the patch is queued and applied on release. A photograph arriving
   during a drag does not move the hand.

### 3. The renderer learns nothing about the editor

No option, no hook, no callback: the inert document is a parameter of the target, and the patch
is the editor's. What holds the two targets together is **`packages/renderer/test/parity.test.ts`**:
for every document in the corpus, every page of the multi-page ones, every one of them again with
the editor's entry hints, and a hundred generated covers, the html body is parsed and walked in
lockstep with the fragment, and **any** difference in tag, child order, attribute set or value,
comment or character fails. The only thing forgiven is the pretty-printer, forgiven **exactly**:
a leading `"\n" + two spaces per level` and the matching trailing one on a block's text child, and
the whitespace between a block's element children. It is a renderer test and **not a sixth
invariant** — protocol §8.2 names five and this is a property of the renderer, not of a document.

### 4. `data-rb-edit` is the signal

The live document's root carries a serial that increments once per applied patch **or chrome
redraw**. It is what the e2e waits on in place of `replacingTheDocument`, which stamped the
outgoing document and polled for a new one — under this decision there is never a new one. The
serial increments under both routes, so one suite serves both.

### 5. The listeners are delegated (adjustment 5)

«Wired once per document» becomes **one set of listeners per session on the frame's document** —
`pointerdown` in capture, so the border zone keeps beating the click that chooses; `pointermove`,
`pointerup`, `pointercancel`, `click`, `dblclick`, `keydown`, `keyup`, `focusin`, `focusout`,
`input`, `beforeinput`, `selectionchange` — each dispatching by `event.target.closest(
'[data-id], [data-section], img, a')` to the handler that lives today in `wireEditing`,
`wireToolbar`, `wireDragging`, `wireResizing`, `wirePhotos`, `wireSelection` or `wireLinks`.
Per node only what cannot delegate: the `contenteditable` attribute, and `observe()` of the one
`ResizeObserver` on an inserted section. The chrome is redrawn, clear-first, after every patch and
before the serial moves. **And every value a handler reads comes through a «now» ref** — `docNow`,
`designToolsNow`, `propsNow`, `photoStatesNow`, `pageIdNow`, `toastNow` — on the precedent of
`deviceNow`, which exists because the device switch already did not rebuild the document; the
closures of the old model captured `doc` thirty-four times and every `on*` prop, and were correct
only because each edit threw them away.

### 6. The old route survives the sprint (adjustment 6)

The buffered swap, `chromeKey` and the restoration machinery stay **behind a key**
(`localStorage["rb.canvas"]`, `swap` by default until día 5, `patch` from then on) **until the
close of sprint 27**, and CI runs the e2e in both modes from día 3 until then. Their retirement is
a decision of the 27, taken with the e2e of both modes in front of it. One precision David's own
examples needed: `chromeKey` and the restoration blocks *are* the swap route, so under his rule
they stay with it; what día 6 of this sprint removes is only what runs under neither route, which
is little, and día 6 becomes the two routes measured side by side with the retirement list written.

### 7. Day 2 begins by reading morphdom (adjustment 1)

A keyed morph with ordinals and exclusion rules is what morphdom (MIT, ~5 KB, no dependencies)
has done in production for years, and its hooks cover the four rules above. It is a dependency of
the editor and not of the published page, so it touches no budget and no allowlist. If the module
of our own is preferred after reading it, the pull request says what morphdom does not cover;
what is already known to be ours either way: `moveBefore` — morphdom moves a keyed node by removing
and reinserting it, so keeping focus across a move is the editor's — and the lists of rule 2.

## Three things only a browser could say — and one only the parity test could

1. **The two targets had exactly one structural difference, and it took the parity test to find
   it.** `nodeToDom` created an **empty text node** for an empty string — a generated button with
   no label — where the html target prints a line with nothing on it, which no parser turns into a
   node. Harmless on screen, and poison to a patch: a fragment with a node the page cannot have is
   a node added and removed on every edit for nothing. `dom.ts` now creates no node for `""`. The
   goldens did not move, because the html path was not touched.
2. **The html target refuses most generated themes, and the dom target does not know it.**
   `arbitraryTheme` writes every token as `key-<suffix>` with an arbitrary string, and `buildCss`
   throws on «`color.accent-! `» — rightly. A parity property over those documents would either
   starve on preconditions or compare a painted page to a refused one; it compares the **body** and
   never the stylesheet, so every generated document is given a theme a real site has and the
   hundred runs stay a hundred. The leniency of the dom target is not a defect: the editor's own
   patch calls `buildCss` and will throw on the same theme.
3. **The baseline, read from the editor's own probe on 21 October**, under today's model, one
   text edit in the generated cover's headline, two runs: **1 document wired** after the edit;
   **5.8 and 5.7 ms** from the new html to the chrome wired; **10.4 and 10.1 ms** from the key
   press to the chrome wired; **0 frame promotions** (a text edit changes no `chromeKey`); **1
   frame on screen**. The window
   is narrow on a quiet machine because the look-ahead of sprint 18 wires at parse time; it was
   64.9 ms before that day and 1.5 s with the faces held, and it is still a window — a press inside
   it still reaches no document. This sprint's walk (c) is what reads it, and día 5 turns its
   assertion around to **zero documents wired and no window at all**.
4. **The sabotage ran both ways and the plan had the second one wrong.** Dropping `loading` from
   `dom.ts`'s attribute walk turned the parity test red on exactly the four fixtures that lazy-load
   a photograph, with every golden green. Changing the pretty-printer to three spaces turned the
   parity test red too — the plan had said «green» — because the normalisation is exact and does
   not forgive a printer it was not told about. That is the stricter behaviour and it stays.

## What is preserved

- **The published page, to the byte.** `render(doc, "html")` is not touched, and the twenty-three
  golden pages did not move on día 1 and must not move on any day of this sprint.
- Every decision of sprints 24 and 25 about *what* an edit does: choosing before writing (0047),
  the drop in the nearest unit (0048, 0050), the arrows' run as one step (0050 día 6), the handles
  on the chosen element (0050 día 7). What changes is *how the page comes to show it*.
- The iframe, for the isolation it gives: the editor's own Tailwind never reaches the page, and
  the page's CSS is the same text the ZIP carries.

## What is lost, and it is named rather than glossed

- **The editor has a second code path that must agree with the renderer.** The parity test is the
  guard, and it is a test of the renderer, not of the editor: a patch that applied the fragment
  wrongly would pass it. The e2e walks of día 5 — thirty keystrokes at five milliseconds while a
  photograph arrives, every one committed; one `Document` through text, mark, move, duplicate,
  delete, undo, redo, photo, escalate, return, page switch and device toggle — are the editor's
  half of the guard.
- **Two routes for a sprint and a half**, and CI running the e2e twice per pull request for as
  long as they coexist. Every defect found in that time is looked for in both.
- The comments across `Editor.tsx` that reasoned from the rebuild — about seventy — are rewritten
  on día 7 as «under `patch` … / under `swap` …» while both routes live, and the orphaned comment at
  `Editor.tsx:1622-1660`, which describes a width re-anchor that nothing triggers, is corrected
  the same day.

## What this does not decide

- Nothing about the 164 px shift when a panel closes: a width re-layout, in the backlog with its
  measurements, untouched by this decision.
- Nothing about the chrome's size on a scaled canvas (sprint 25 día 8's open question), the
  keyboard inside a section, named versions, or the text toolbar's own open defect.
- The redraw after a patch is of the whole page; narrowing it to the sections a patch touched is a
  measurement for the day it costs more than a few milliseconds, not a decision for today.
- `moveBefore` as the only way to move a node — it is used where the browser has it and
  `insertBefore` with a synchronous refocus where it does not.
- The day the old route is deleted: the 27's, with the e2e of both modes as the evidence.

## Consequences

- `packages/renderer`: `DomRenderOptions.document`; `buildCss` and `fontFaceCss` re-exported;
  `nodeToDom` creates no node for an empty string; `parity.test.ts`.
- `apps/editor`: the patch module and its rules (día 2), the delegated listeners and the «now»
  refs (día 3), photographs and the stylesheet as attribute and text patches (día 4), the key and
  both routes (días 5–6).
- `apps/editor/e2e`: `afterTheEdit` on `data-rb-edit` in place of `replacingTheDocument`; the
  helpers that count frames assert by mode; walks (a)–(e) of the plan.
- **Amendments.** ADR 0049 §4: a press during a rebuild is no longer a cost of ADR 0001's
  architecture, because there is no rebuild. ADR 0049 §3: the announcement *could* now live in the
  canvas and stays outside it on purpose — the reason changes, the decision does not. ADR 0050's
  día 7 note on one painter per document is superseded by one document. ADR 0048's technical half
  of «written on `pointerup`» no longer holds; the product half does.
- `docs/tasks/backlog.md`: the lost-keypress row (sprint 24, item 2) closes when día 5 lands; the
  two-documents row of sprint 17 closes with it; the panel-shift row stays as it is.

## Amendments

*(One per day, in the plan's order, written the day each lands.)*
