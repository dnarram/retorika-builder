# 0061 — The canvas lays out at 1280 and scales, and says so where it cannot

**Status:** proposed · **Date:** 2026-10-30 · **Decided by:** David, 30 de octubre de 2026, al
aprobar el plan del sprint 31 — he set the condition («lo que no vale es que el lienzo enseñe otra
cosa sin decirlo») and chose this among the three repairs the plan costed; the legibility floor is
his, from 26 October (sprint 28). · **Recorded by development at his instruction, with the standing
note that development does not sign.** · **Amends:** the canvas decision of 5 October 2026
(`docs/design/REVIEW.md`, «Día 3: los seis paneles derechos»: the canvas zooms instead of
reflowing, floored at the narrowest desktop) and its restatement on sprint 24 día 3 (PR #265, «el
lienzo se encoge y se escala solo»); closes the first open item of sprint 28 («escalar con un panel
abierto guarda el ancho del panel», `docs/tasks/backlog.md`). · **Relates to:**
[ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md) (the rows a
section is measured into), [ADR 0053](0053-chrome-is-drawn-in-screen-pixels-and-an-element-too-small-on-screen-keeps-its-corners.md)
(the chrome follows the zoom), ADR 0060 (sprint 31 día 2, not yet written: the header rail that folds
below 1024) · **Touches:** `apps/editor` only. Nothing
in the published site changes.

## Context

Since 5 October 2026 the editor's canvas has been laid out at **whatever room the panels leave**,
floored at `NARROWEST_DESKTOP` (721 px, one past the renderer's breakpoint) and scaled down only
when the room fell under that floor. The reason was good and still holds: before it, opening «Estilo»
in a 1024 window made the preview fall under 720 px and silently become the phone layout while the
device toggle still read desktop.

But a width that is «whatever room there is» is a different page at every window and with every
panel. Measured in Chromium on 30 October 2026, before a line of this was written:

| Window | Room, no panel | Room, «Menú» open (340 px) |
|---|---|---|
| 1024 | 752 | 532 → laid out at 721, zoom 0.7379 |
| 1280 | 1008 | 788 |
| 1440 | 1168 | 948 |
| 1680 | 1408 | 1188 |

Every cell but one was the layout width at zoom 1. Two things followed from that, one old and one
about to arrive:

- **Sprint 28's open item.** A hand-designed section is measured into 8 px rows from its live boxes
  (ADR 0050). Escalated with a panel open, it was measured at the panel's width: at 1280 with
  «Diseño» open the cover's headline wrapped to two lines and took 13 rows; closed, it was one line
  and the subheadline sat 95 px under it where 16 were meant. Sprint 28 día 7 removed the row
  readjustment and left this door open with its price, «the fixed layout width», for the day
  another symptom asked for it.
- **Sprint 31's rail.** ADR 0060 gives each menu a position, and a side rail of 240 px that folds to
  the top bar below 1024 px so the content never falls under the 768 px the overflow suite proves.
  At a 1280 window the frame was 1008 wide with no panel and 788 with one: the owner would choose
  «Columna izquierda» in the panel and watch the rail fold in the canvas the moment they chose it,
  and never see it unfold without closing the panel and widening the window past 1296 px.

Three repairs were costed. Lowering the fold threshold cannot hold the 768 px floor (at 788 of frame
the content would be 548). A notice in the panel would have to read «se ve en ventanas de más de 1296
px», which is a canvas that shows something else and says so only in the small print. The third is
this decision.

## Decision

### 1. The desktop canvas lays out at 1280 px, whatever the window

`DESKTOP_LAYOUT_WIDTH = 1280` in `apps/editor/src/editor/overflowCheck.ts`, beside the other two
widths the canvas rests on. It is the width the published page is measured at — the overflow suite,
Lighthouse's desktop subjects — so what the owner sees is what a visitor at 1280 sees. The card is
scaled to the room there is (`zoom = room / 1280`, never above 1), and opening a panel changes the
zoom and nothing else: no text reflows, no row is measured at a width the visitor will not have, no
rail folds.

The zooms this gives, from the rooms above: **0.79 / 0.62** at 1280 (no panel / «Menú»), **0.91 /
0.74** at 1440, **1 / 0.93** at 1680. At 1680 with no panel the card is 1280 wide at zoom 1 with the
table's grey either side: a preview magnified past its own size would show the owner something no
visitor sees, so the zoom stays at or under 1, as it always has.

### 2. Under the legibility floor the canvas gives up width, not legibility — and says so

David's floor from sprint 28 is **0.6**. At 1280 fixed a 1024 window would zoom to 0.59 with no panel
and **0.42** with one, under the floor. So the layout width is

```
layoutWidth = min(1280, max(room / 0.6, 721))
```

(`desktopLayoutWidth` in `overflowCheck.ts`): 1280 wherever that still zooms at or above 0.6, which
is 768 px of room and up; narrower under it, exactly as narrow as the floor requires; and never under
721, the page still being the desktop page. The two floors meet at 433 px of room; under that the
desktop floor wins and the zoom goes under 0.6, as it did before (a 768 tablet with a panel open).

Measured after the change: at 1024 the canvas lays out at **1253 px (no panel) and 887 px («Menú»)**,
both at zoom 0.6. At 1280 with «Menú» open the room is 788, twenty pixels over the boundary, and the
page is the 1280 page at 0.616.

**Whenever the desktop canvas is not the 1280 page, the card says at what width it is**: a notice
over the card's top edge, outside the `<iframe>` and outside the scaled card, «Vista a 1253 px»
(`editor.canvas.viewWidth`). This is David's condition made a rule: the canvas may show something
other than the 1280 page only where it says that it does. The same rule, read from the panel, is
what ADR 0060's «Dónde va» note derives from `layoutWidth` on día 5: with 1280, «en el lienzo se ve
siempre»; under the floor, «en esta ventana el lienzo maqueta a N px», and whether the rail folds at
that width.

### 3. What shrinks, and what is gained

What shrinks: the preview. At a 1440 window with no panel it was drawn at 1.0 and is now drawn at
0.91; with a panel open it was 1.0 (of a 948 px page) and is now 0.74 (of the 1280 page). At 1280 the
preview with no panel goes from 1.0 to 0.79.

What is gained: a text no longer reflows when a panel opens or closes; a hand-designed section is
measured into its rows at the width the visitor has, with or without a panel — the sprint 28 item,
closed — and the header's positions of ADR 0060 are seen in the canvas as a visitor at 1280 sees
them, with the panel that chooses them open.

### 4. The room after the page is now visible at rest, and stays

Sprint 28 día 1 gave the page a grey room after its last section (`.rb-overscroll`, `overscrollFor`)
equal to what the frame's viewport gains when the zoom falls, so that a change of zoom clamps no
scroll. It was zero at zoom 1, «the normal case». Zoom 1 is no longer the normal case, so the room is
there at rest: measured, **78 frame px at 1440 with no panel (71 on screen), 221 at 1280, 545 at
1024**, and 0 only at 1680 with no panel. It lies past the end of the page, in the table's grey, and
is seen only when the owner scrolls to the end.

It stays. Making it zero at rest would need the shell to know the room *without* a panel while a
panel is open, which is predicting the room from the window — the prediction the canvas decision of
5 October refused in favour of measuring, and the one that varied by 200 px between panels. If the
band proves a nuisance, the way to bound it is to compute the room against the zoom the window
would give with no panel, measured once with the panel closed; it is written here so the next person
starts there.

### 5. What the change costs the editor's own machinery

- `onZoomChange` → `redrawChrome` (ADR 0053) now runs on a window resize as well as on a panel,
  since the zoom changes with the window below 1552 px. Measured: 40 viewport steps in 57 ms produced
  **2 redraws of 1.0–1.1 ms each**; the observer and React batch the rest. No change.
- The `ui-reflow` transition on the device toggle animates `width` and `transform` together now,
  where before at wide windows the transform did not exist. The walks that count intermediate widths
  («pasa por anchos intermedios», `deviceArrived`) are the check, and `canvasZoom.test.ts` pins the
  formula at the eight measured rooms and its two boundaries (768 and 433).

### 6. Four defects a zoom under 1 had all along, now every laptop's case — fixed here

A zoom under 1 is not new: a 1024 window with a panel open has drawn the canvas at 0.738 since the
canvas learned to zoom. It was the case nobody walked. This decision makes it the case of every
laptop, and the full e2e suite run against the change found four defects that had been living
there. They are fixed in the same change, because shipping the width without them would ship them
to the most common screen.

1. **The box that holds the card was scrollable by script.** Under a zoom the card is laid out
   `100 / zoom %` tall and scaled back, and `transform` takes no layout space, so its layout box is
   taller than the box holding it by `height × (1 / zoom − 1)`. That box was `overflow: hidden`, which
   clips and can still be scrolled by script, and the canvas's own `scrollIntoView` scrolled it: at
   1440 with no panel it sat **83 px** down (exactly 868 × (1 / 0.9125 − 1)), the top of the page was
   cut off under the editor's row, and a press on the header landed on the row. Now `overflow: clip`,
   which paints the same and is not a scroll container; `min-w-0` takes over the flex minimum that
   `hidden` used to zero. Found by the sprint 30 día 3 walk.
2. **A redraw with no edit closed what the owner had open, or took the keyboard away.** Since ADR 0053 a change of zoom redraws
   the chrome; since this decision the zoom changes with the window. The escalation offer did not
   survive a redraw — it shares `compositionMenuOpen` with the composition menu, and the restore
   only knew how to reopen that one (on a section with compositions it reopened the *wrong* menu) —
   and the insertion menu lived inside a gap that `drawGaps` redraws from a clean slate. Both are now
   put back after a redraw that did not change the page's structure, the insertion menu with what
   had been typed in its search. Found by the chrome-words sweep, which resizes with each state open.
   And the same redraw rebuilt the chosen section's verbs under the keyboard: «Cerrar los campos»
   gave the focus back to «Campos», the zoom that changed as the panel closed redrew the chrome a
   frame later, the button was replaced by its twin and the focus fell to the body. `redrawChrome`
   now remembers the verb the keyboard is on by its section and its `data-action`, and gives it
   back after the selection has settled when nothing else has taken it. Found by the sprint 17 día 5
   walk — which passed once after fix 1, by winning the race, and then failed every time.
3. **Escalating a section mid-page moved it 49 px.** The promise («escalar una sección a media
   página no la mueve en pantalla») rested on the browser's scroll anchoring, and measured, the
   browser does not keep it once the section fits inside the frame's viewport: Chromium anchored on
   an element inside the section (which the escalation moves by up to one 8 px row), and a
   programmatic scroll during the entrance of «Diseñada a mano» switched anchoring off for the rest of
   the entrance — reproduced on a bare page with no editor. It did not depend on the zoom: a 1680 ×
   1050 window failed the same way at zoom 1. This decision made the frame's viewport taller on
   every laptop (852 px of the frame at 1440 × 900, where it was 774), and Safari has no scroll
   anchoring at all. So the editor keeps the reading point itself (`readingPoint.ts`): the section at
   the top of the view and its offset, taken before a patch and put back after the chrome is drawn,
   with a bar that lands at or above it arriving without its entrance. At the very top of the page
   nothing is taken, and the bar still arrives in view.

None of them touches the published site.

## What is preserved

- **The device toggle's phone preview**: 320 px at zoom 1, untouched.
- **The page never becomes the phone layout under a desktop toggle** (the 5 October decision): the
  floor of 721 is still the last word.
- **«Measured, not assumed»**: the room is still read from a `ResizeObserver` on the canvas area and
  never predicted; only what is done with the measurement changed.
- **Nothing in the published site.** `packages/renderer` and `packages/publisher` are not touched;
  the goldens do not move.

## What is lost, and it is named

- **A larger preview at wide windows with no panel.** 0.91 at 1440 where it was 1.0. David weighed
  this against the two gains above and chose the gains.
- **The sprint 28 día 7 walk's premise.** «Con «Diseño» abierto el titular pasa a dos líneas» was
  the premise of the walk that proved rows are a minimum; it is false by design now. The walk is
  inverted — the headline stays one line, the gap and the rows do not move when the panel opens — and
  measures inside the frame, because a box in screen pixels would compare two zooms (0.788 and
  0.616 at 1280) and call the difference a regression. That inversion, with sprint 25 día 2's second
  door (escalated with the panel open, nothing moves when it closes), is the proof the sprint 28 item
  asked for.
- **Nineteen walks went red on the first full run**, and every one is accounted for in REVIEW,
  sprint 31 día 1: four were the defects of §6 and pass unchanged now that they are fixed, two had
  premises this decision makes false, and thirteen measured the frame's pixels against numbers of
  the screen — a handle's 44 px, a verb's 32, a hand's travel — which were one number only at zoom 1.
  Those fifteen are rewritten: they read the zoom from outside the frame and say each value in its
  unit.

## What this does not decide

- **Whether 1024-px windows should offer panels at all.** `MIN_STUDIO_WIDTH` is 1024 (ADR 0025 §5);
  with a panel open such a window shows the page at 887 px and zoom 0.6, which is the floor and no
  more. The notice says so; whether that is good enough for the smallest studio is David's to judge
  with it in front of him.
- **Bounding the room after the page at rest** (§4): written with its mechanism, not built.
- **A width other than 1280.** The sprint 28 row costed «the width the window gives the canvas with
  no panel»; it was refused here because it still varies with the window, and a rail that folds at
  a fixed threshold needs a canvas whose width the owner can predict.

## Consequences

- `apps/editor/src/editor/overflowCheck.ts`: `DESKTOP_LAYOUT_WIDTH`, `CANVAS_ZOOM_FLOOR`,
  `desktopLayoutWidth`. `EditorShell.tsx`: the formula and the «Vista a N px» notice.
  `locales/es.json`: `editor.canvas.viewWidth`.
- `EditorShell.tsx` also: `canvas-area` is `overflow: clip` (§6.1). `Editor.tsx`: the escalation
  offer, the insertion menu and the keyboard's verb survive a redraw (§6.2); the reading point is taken in `applyPatch`,
  honoured by `wireHandmade` and put back in `redrawChrome` (§6.3), with `readingPoint.ts` and its
  unit tests.
- `apps/editor/test/canvasZoom.test.ts`: the formula at the eight measured rooms, the two
  boundaries, monotonicity. `e2e/critical-flows.e2e.test.ts`: `canvasZoom` and `nearInFrame` at the
  top of the file; the walks of §«What is lost» rewritten; a walk of its own, «sprint 31 día 1».
- `docs/tasks/backlog.md`: the fixed-width row closes against this ADR (sprint 31 día 6).
- Day by day in `docs/design/REVIEW.md`, sprint 31 día 1.
