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

### Amendment — the patch, behind a key (día 2, 22 October 2026)

**morphdom, adopted** (adjustment 1), read first: a keyed walk with positional fallback, text
rewritten by `nodeValue` in place, attributes the fresh node lacks removed, and the hooks the four
rules need — `getNodeKey`, `onBeforeElUpdated`, `onBeforeNodeDiscarded`, and
`onBeforeElChildrenUpdated` for the editable with focus. MIT, no dependencies, 2.7.8, a dependency
of the editor and never of the page. **What it does not cover, and `patchCanvas.ts` does:** it
moves a keyed node with `insertBefore`, so focus inside a moved node is put back by hand; it has no
notion of the chrome; it has no notion of which attributes the editor owns, so the preserved lists
are copied from the live node onto the fresh one before it compares them.

**The chrome is parked, not keyed.** The first design gave every chrome node a key of its own and
let the hooks refuse its discard. Measured on the first patch of a session — the one that strips
the pretty-printer's text nodes — morphdom, meeting a keyed node the fresh tree lacks, inserted the
fresh node *before* it and pushed an `.rb-actions` cluster from first child to third. So the
chrome is taken out of the tree for the duration of the walk and put back after the renderer
sibling it followed, which persists because keyed renderer nodes keep their identity. The test
that proves it had to be written on the unsettled document: on a settled one it passed with the
parking removed.

**Keys are paths.** A collection's cards share the template's `data-id`, so a node is keyed by its
chain of keyed ancestors — `s:sec-cover/e:el-headline`, `s:sec-list/n:3/e:el-title` — which is
unique and stable.

**Rule 3, corrected by the walk that could not run.** The first version protected *any* focused
element's children on an ordinary edit. A chosen headline has focus too — it is a Tab stop — and
its words are nobody's draft: an edit from elsewhere must show on it. The guard is now
`isContentEditable`, with the test that a focused non-editable is patched.

**Adjustment 2, as it stands in the product.** The rule is built and unit-tested — a history patch
rewrites the focused editable, keeps the caret by offset, leaves the words behind for the `blur`,
and the `blur` commits only the difference from what the document last said. But the scenario
David named, Ctrl+Z with the caret inside a text, **has no keyboard path**: `shortcuts.ts` has
yielded to the browser inside a `contentEditable` since sprint 12 — «nothing fires while focus is
in a contentEditable», his own condition for writing it — so inside a text Ctrl+Z is the native
undo of the DOM, the history does not move and no patch comes. The one reachable undo while
writing is the «Deshacer» button, which takes the focus first; and there the `blur` half of the
rule is what shows: with the native undo having already taken the typed words out of the DOM, the
`blur` finds the DOM equal to the document and commits nothing, and the undo reverts the one real
step. The walk asserts both halves. The rule stays, because the hazard it closes needs no user to
reach it — any doc change from outside the frame while a text is being written — and because the
day the shortcut stops yielding, the walk is already there.

**The old route takes what the patch does not.** Día 2 patches text, marks, inline styles and
attributes inside an unchanged keyed skeleton. A changed skeleton — a section, an item or an
element that came, went or moved — is refused with `reason: "structure"`, and a change of
`chromeKey` (the tools toggled, a section escalated or returned) with `reason: "chrome"`; both hand
the frame the current html **and a new key**, so it reloads even when the html string repeats. The
patch then continues on the document that arrives.

**Three things only the browser could say.**

1. **A text edit under `patch` wires zero documents** where día 1 measured one: the document's
   identity survives (stamped before, read after), the serial moves, the letter is committed and
   saved. A patch costs **0.8–1.6 ms** on this machine, by the probe. The default route, measured
   in the same run, still wires one.
2. **After a chrome swap two documents are wired in a row** — serial 3 by `promote`, serial 4 by
   `onload` — and `wiredDoc` names the last one, which need not be the one on screen. A patch
   effect that waited for `wiredDoc.current === iframeDoc` parked forever; it asks the document
   for its own `data-rb-wired` mark instead, which is sprint 18 día 5's lesson in a new place.
3. **With the design tools on, Enter does not commit a text**; the walks that run with the tools
   on commit by pressing outside, on the hint strip, and the día 2 walk learned to do the same.
   The gesture queue was sabotaged — `gestureLive` returning `false` — and the mid-drag walk went
   red on «el parche no quedó en cola».

**What día 2 retires: nothing.** Under `swap` every piece of the old route runs as before; under
`patch`, `keepWriting`, `keepChosenFocus`, `pendingReturn` and the reading-position family simply
never fire, because nothing rebuilds. They are retired when the route is (adjustment 6).

### Amendment — the closures read the present, and the listeners are the document's (día 3, 22 October 2026)

**Delegation, adopted (David's adjustment 5).** Every listener the canvas used to attach per node
— nine on each text, nine on each placed element, four on each section plus one per handle — is
now one set on the frame's document, registered once per wiring and dispatched by
`closest(selector)` to the renderer node the event concerns (`apps/editor/src/editor/delegate.ts`).
A node that arrives with a patch is heard the moment it exists; a node that stays keeps no closure
from before. What is still done per node is attributes and one observer, as the adjustment said:
`prepareTexts` (the `data-rb-text` mark, a Tab stop, the entry link unwrapped) and
`prepareDraggables` (`draggable` off on images and links, a Tab stop on a placed non-text), both
idempotent and run after every patch; and `observeSections`, which asks one `ResizeObserver` per
document to observe every section it has — `observe` on one already observed is a no-op, so a
section inserted by a patch costs one call and nothing else. `focus` and `blur` do not bubble, so the
wiring asks for `focusin` and `focusout`; the border zone's `pointerdown` stays in the capture
phase, so it keeps beating the click that chooses. The gates that used to sit on the wiring —
`designTools !== true` at the top of `wireResizing`, `wireDragging` and `wireHandmade` — moved
inside the handlers, because under `patch` the wiring runs once per session and the tools can be
turned on after it. Per-element state (what a text said when writing began, a drag's grab point,
an arrow run) moved from closures into a `WeakMap` keyed by the element; one resize happens at a
time, so its state is the document's.

**The refs that read the present.** Every value a handler reads — `doc`, `designTools`,
`photoStates`, `designOn`, `designSectionId`, `placingElementId` and the eighteen `on*` callbacks —
goes through a `*Now` ref kept in step by the render (`docNow`, `designToolsNow`, `propsNow`, …),
on the `deviceNow` precedent. `closureGuard.test.ts` reads `Editor.tsx` between `wireLinks` and
`wireOnce` and refuses a bare `doc`, `designTools`, `pageId`, `photoStates`, `designOn`,
`designSectionId`, `placingElementId`, or a bare `on[A-Z]…(` other than `onClick(`. `wireSelection`
reads its sections through `sectionsNow()` rather than an array captured at wiring, at 27 sites.

**Draw and attach, split; the chrome redrawn after every patch.** The functions that drew *and*
listened were split into a drawing half that clears its own chrome first (`drawGaps`, `drawLines`,
`drawPhotoChrome`, `wireHandmade`) and an attaching half registered once (`attachDocument`,
`attachPhotos`, the toolbar's `focusin`/`focusout`). `redrawChrome(iframeDoc)` runs them all after a
successful patch, structural or not — a text that grew moved the gap below it — followed by what
each wiring used to settle at its end: the selection and `placeAfterRebuild` (`settleSelection`),
the chosen text (`settleEditing`), the focus a gesture asked to keep (`settleDragging`),
`focusLineAfterChange`, the observer, the handles. It runs synchronously, before the `data-rb-edit`
serial moves, so a walk that sees the serial sees the chrome. The cost is in the report as
`redrawMs`.

**The structural refusal, lifted.** `patchCanvas` no longer answers `{ ok: false, reason:
"structure" }`; a changed skeleton is patched like anything else and the report says
`structural: true`. The tests that proved the refusal now prove the patch: a section gone with the
chrome beside its neighbour kept in place, a section gained in its place with a second patch a
no-op.

**`chromeKey`, by id and not by position.** The key was one bit per section in page order, so a
duplicate, a delete, a move or their undo changed it — a chrome swap under `swap`, and under `patch`
a refused patch and a rebuilt document, for an edit that changed no section's source. Measured in
the día 3 walk as three refusals with `reason: "chrome"`. It is now the sorted ids of the
hand-designed sections, so it moves only when a section is escalated or returned (día 4 makes those
a patch too), when the tools are toggled, or when a hand-designed section is duplicated — which is
a new bar to draw. `escalationChrome.test.ts` carries the new shape and the three cases that must
not move it.

**CI runs the walks in both modes from today.** `e2e (patch)` is the same job with
`RETORIKA_CANVAS=patch`, which the harness turns into `localStorage["rb.canvas"] = "patch"` in every
context it opens; `continue-on-error` until día 5 rewrites the walks' contract (`afterTheEdit`) and
turns the default, then both block until the 27 closes.

**Three things only the browser could say.**

1. **Two lines, up, duplicate, delete, undo — six structural patches, zero documents wired,** the
   same document at the end by its stamp. Patch **1.2–1.8 ms**, redraw **0.6–2 ms, median 1 ms**,
   on this machine. The second line receives the keyboard and its placeholder is replaced; one
   «Añadir línea», one verb cluster, one gap per section plus one, after every change; the focus
   is inside the moved section when the serial moves.
2. **Tab into the frame cannot reach a section once a text has been touched**, under either route
   and before today: Tab enters at the top, every text it crosses is a Tab stop whose `focusin`
   moves the roving `tabindex` to *its* section, so by the time Tab reaches the section that held
   it, it no longer does — measured as sixty stops and no section. `keyboardTo` now prints the trail
   it walked; the walk selects by click. This is the backlog's open question on Tab inside a
   section, not today's.
3. **The sabotage the plan named did not turn the walk red, and the guard did.** A handler returned
   to the captured `doc` (`boundAt(doc, …)` in the commit) and to a captured callback
   (`onDeleteSection`) left the walk green both times: the callbacks are stable, the once-registered
   handlers read structure from the DOM, and the drawing functions run from the render's own
   closure after every patch — so the stale read today's walk could see does not exist. What the
   walk does catch is the mechanism itself: `redrawChrome` skipped, and the new line has no focus
   (`-1`). The closure guard is the net for the closures; the walk is the net for the redraw. Said
   here rather than claimed otherwise.

**What día 3 changes under `swap` too.** The listeners are the document's under both routes; `swap`
still wires each new document, once, and `redrawChrome` is not called there — the wiring draws.
Nothing is retired (adjustment 6).

### Amendment — photographs, styles, pages and the switch (día 4, 22 October 2026)

**What día 3's patch-route run measured, closed.** Fifteen walks were red under the key; read one
by one they were five causes, three of them defects of this route:

1. **The menu kept the links the document dropped.** A link was keyed by `href` alone, and the
   renderer draws every link twice — the wide strip and the narrow `<details>` — in up to two
   `<nav>`s each. morphdom keeps one node per key, so a fresh link matched a twin in the other
   strip and the orphan stayed: «Qué ponemos» twice, `#sec-services` beside `./que-ponemos.html`.
   The strips (`m:wide`, `m:narrow`) and the lists (`nav:<aria-label>`) now have keys of their own,
   so a link's chain names exactly one node. Unit test on `menu-y-paginas.json`, folding a page
   back; sabotaged by removing the two keys.
2. **Rule 3 deferred the text's own mark.** A mark set from the floating toolbar while writing is an
   edit of the focused editable's children, and rule 3 refused it until the blur — five walks whose
   `<strong>` never came. `PatchCause` gains `mark`: the toolbar names the change as the text's own
   act, and the patch applies it like `history`, with the **selection** put back by its plain-text
   offsets (start and end, where `history` restored a caret), and the writing's capture re-read
   from the document so the next commit carries the new marks and not the old ones. Rule 3 as
   amended: *the focused editable's children are left alone unless the change is the history's or
   the text's own.*
3. **`keepWriting` had no listener under `patch`.** A resize while writing commits and asks for the
   writing back, and only the wiring answered. `settleWriting` is now part of the redraw.

The other two were the plan's own: a change of page starts at the top (**done**: the patch that
changes page scrolls to 0; the same page keeps its scroll by doing nothing), and the bank photograph
«never reaching the `img`» — which was the switch taking the old route under `patch` and the walk
polling a frame in transit, gone with the next point.

**The switch redraws; escalating and returning are patches.** `chromeKey` is a `swap` notion — it
decides when that route needs a new document wired for the tools. Under `patch` it opens no slot
and refuses nothing: toggling the tools runs `redrawChrome` (the handles, the bars, the Tab stops
the tools add) and moves the serial, recorded as `redraw {cause: "tools"}`; a section escalated or
returned arrives as a patch — `rb-free` and the inline grid areas are the renderer's and the fresh
tree wins — and `wireHandmade` draws its bar in the same redraw. Measured: switch on, escalate,
return, switch off — zero documents wired, one `.rb-handmade` while escalated and none after, the
photograph a Tab stop while the tools are on.

**Photographs.** One document from the first paint: the proposals card writes the bank's
photographs in one batch, and in the walk they were already in the first html (`venían en la
primera pintura`); when they arrive later they are a patch of five `src` attributes. Either way the
count of wired documents is one, which `swap` could not say — día 1's baseline measured the second
document the photographs used to bring.

**Fonts: two sheets.** The html target writes one stylesheet with the `@font-face` rules inside it.
Rewriting it on a change of palette re-declared the faces: **measured as one `loadingdone` per
rewrite, ten in ten, with no request behind any** — the files are cached, but a face re-declared is
a face the browser may paint its fallback for while it re-resolves. So the first patch moves the
faces into `<style data-rb-font-css>` before the page's sheet, and from then on the page's sheet
is rewritten and the faces' only when the document names other faces. **Measured after: ten
rewrites, `loadingdone` 0, requests 2 → 2, both nodes the same, the heading face still loaded.**
Sabotaged by rewriting the faces' sheet on every patch: the walk goes red on `loadingdone`. The
report says `fontsChanged` beside `cssChanged`.

**The toolbar, reopened by the redraw.** Every control in the floating bar — the role pressed, the
size step, the colour in force — is read when the bar opens and never after; under `swap` each
rebuild reopened it, and under `patch` nothing did, so the «Aa» walk pressed the body role and the
bar still said `aria-pressed="false"`. `settleToolbar` reopens the bar in the redraw, with the
selection put back — and with **the control the hand was on focused again in the new bar**: `open`
removes the old bar, the focused `<select>` with it, focus falls to the body, and the text's deferred
`focusout` would otherwise dismiss the bar it had just rebuilt (measured as the spacing select
«not found» right after choosing in it). Both routes green on the sprint 9 and 13 toolbar walks.

**What stays for día 5.** Every walk that waits on `replacingTheDocument` around the switch, an
escalation or a verb is red under `patch` by contract, not by defect — the switch and the
escalation no longer replace the document, so the wait never returns. Día 2's own mid-drag walk
was moved to the serial today; the rest is día 5's `afterTheEdit`. The día 1 baseline measures the
old route by definition. «Desenlazar» compares `textContent` across a block boundary the first
patch strips the pretty-print whitespace from; día 5 decides whether the walk or the first patch
is the one to change.

### Amendment — the walks' contract, and `patch` by default (día 5, 22 October 2026)

**One wait for both routes.** `afterTheEdit(page, act)` replaces `replacingTheDocument` in the
e2e: it reads the live document's edit serial (`data-rb-edit`, §4), runs the act, and waits for
the serial to move. Under `patch` a patch or a repaint moves it; under `swap` the new document is
wired and stamped before it is promoted, so the live frame's serial moves the moment the swap
lands. The old wait stamped the outgoing document and waited for one without the stamp — a wait
that under `patch` never returns, because nothing replaces anything; día 4's full run under the key
was red on **thirty-eight walks for that reason alone, and none for a defect**. The new wait keeps
the old one's guard — it waits for the canvas to be wired first, and a canvas that never wires fails
by name — because two list walks act while the first document is still parsing.

**Per route, never per page.** The three walks that exist to prove the buffered swap («la vista
previa nunca se queda sin página», «un clic durante el relevo», «encender y apagar seguido») and
día 1's baseline assert what each route promises, chosen by `canvasRoute()` — what the harness
asked for, or the editor's default — and never by looking at the page, so a walk cannot drift into
testing whatever route it finds. Under `patch` the promise is the opposite one: never a second
frame, a text edit that wires nothing and produces no html, a window of **0 ms**. «Desenlazar»
compares what a card *says* (`innerText`) rather than the whitespace between its blocks, which the
two routes leave differently.

**(a), measured.** Thirty keystrokes at five milliseconds while the text's own mark lands as a
patch: all thirty are there, the mark is on its word, and one document was wired in the session.
Two things the walk found on the way, both of the editor and not of the route: a mark pressed on
text that has not been committed marks the document's text, not the typed one — the toolbar should
commit first, in both routes, which is a defect to its own backlog line — and `End` does not
collapse the selection the patch puts back where an arrow does; noted, not chased.

**`patch` is the default.** `DEFAULT_CANVAS_MODE` turns; `swap` stays reachable under the key
until sprint 27 closes (adjustment 6). CI runs the default job on `patch` and `e2e (swap)` on the
other route, and **both block** from today.

**Two more things the browser said.** `applyPatch` read the photo URLs, the page and the entry
from the render's closure, and `wireOnce` — which applies a patch queued before the first wiring —
can be renders behind: measured on the keyboard walk as the bank's photographs never replacing
their sample names. They go through `*Now` refs now, like everything else a handler reads (día 3).
And the photograph's bottom-edge resize was red twice under `patch` inside a long filtered run,
green three times alone, and red again — with the drag's drop landing 22 px high — in CI's first
full run on this route. The cause is the escalation, which is **two changes of the document**: the
section turns free, and a couple of hundred milliseconds later its rows, measured on the live
layout (ADR 0050 §3), are written in a second step. A gesture begun between the two measures a box
the second step moves. Under `swap` the two steps were two rebuilds, slow enough to hide it; under
`patch` they are two patches, fast enough to show it. The walks now wait for the canvas to go quiet
after every escalation (`canvasQuiet`, 400 ms without the serial moving), which is what a person's
eye does. **The race itself is the editor's, not the harness's**: a hand that escalates and drags
within 200 ms meets it in either route, and whether the escalation should measure and write in one
step is a question for día 6's list or the backlog, named here rather than closed.
