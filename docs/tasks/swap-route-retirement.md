# The `swap` route's retirement — the list for sprint 27, día 1

**Written on sprint 26 día 6 (22 October 2026), to be executed on sprint 27 día 1 and not before.**
ADR 0051 §6 and David's adjustment 6 to the sprint 26 plan: the canvas keeps two routes until
sprint 27 closes — `patch`, the default since día 5, and `swap`, the model the editor had since
sprint 15, reachable under `localStorage["rb.canvas"] = "swap"`. CI runs the whole e2e suite on both
until then. This file names what leaves when `swap` does, symbol by symbol, with the line each one
lives on **today**; `apps/editor/test/swapRetirement.test.ts` checks that every symbol still exists
near its line, so the list cannot rot in silence while the days before the 27 move the file.

**What dies today under both routes: nothing.** The two refusals día 4 left `patchCanvas` without
(`structure`, `chrome`) were already gone with it; `pendingHistory` became `pendingCause`;
`chromeKeyPatched` left with the chrome swap. What is listed below runs under `swap` and nowhere
else — and under `patch` it is dead weight the route pays for in the file, not in the browser.

## `apps/editor/src/questionnaire/Editor.tsx`

The lines are those of commit `c3d3a85` (main after PR #288), one per symbol in the order the
first cell names them. Each row says what the symbols do, and what the 27 does with them.

| Symbol | Line | What it is | 27 día 1 |
|---|---|---|---|
| `canvasMode` (ref) and its one `localStorage` read | 1008 | Which route this session took, read once at mount | **Remove.** One route; the key `rb.canvas` stops being read. `canvasMode.ts` and `canvasMode.test.ts` go with it |
| `html` memo, `initialHtml` | 1457, 1484 | The html target rendered on every change; under `patch` only the first value is used | **Keep the first paint, drop the memo.** `initialHtml` becomes a `useState(() => render(…, "html"))`; nothing re-renders html after mount |
| `fallback`, `frameHtml`, `frameSerial`, `takeOldRoute` | 1485, 1486, 1487, 1998 | A refused patch reloading the frame with the current html and a new key | **Remove.** The only refusal left is `no-body`, which cannot happen on a wired document; `applyPatch` throws on it instead, which is the house rule for the impossible |
| `chromeKey` | 1504 | What the chrome depends on but the page does not — the trigger of the buffered swap | **Remove.** Under `patch` the switch redraws (`redrawChrome`) and escalation is a patch. `escalationChrome.test.ts` loses its transcribed key and keeps its `rb-free` assertions |
| `buffer`, `pendingSlot`, `everSwapped`, `slotFrame`, `liveFrame`, `BUFFER_DEADLINE_MS` | 1531, 1537, 1687, 1689, 1693, 475 | The two-frame buffered swap of 6 October (`04bee33`), the fade rule that depends on it, and the deadline that falls back to a visible remount | **Remove.** One `<iframe>`, no key, no slot. `liveFrame()` becomes the one ref |
| `promote` | 6484 | Wiring the buffered frame before it is shown, and the `syncHole`/`syncGrid` second pass | **Remove.** `redrawChrome` is the second pass now |
| `refocusAfterSwap` | 1842 | Putting the keyboard back into the frame that replaced the one that had it | **Remove.** The document is never replaced |
| `lookAheadStep`, `LOOK_AHEAD_DEADLINE_MS` | 1952, 122 | The look-ahead effect: wiring a new document the moment it is parsed, before `load` (`editor/lookAhead.ts`) | **Remove the effect; keep `lookAhead.ts` only if the first paint still wants wiring before `load`** — measure on 27 día 1: if the first `wire` event lands via `onload` within one frame of `lookahead`, the module goes too, with its test |
| `wiredDoc`, `wireSerial`, `rbSerial` | 6385, 6387, 6443 | «Never twice» across two frames, and the count the baseline walk reads | **Keep the mark, simplify the guard.** `data-rb-wired` on the document stays as the one guard; the serial stays because the e2e counts wirings (the día 1 baseline promises exactly one) |
| `rememberCanvasBackground`, `canvasBackground` | 6551, 1494 | The frame's background during the one-frame remount of a chrome swap | **Remove.** No remount |
| `restoreReadingPosition`, `settleReadingPosition`, `applyRestoreTarget`, `readingRaw`, `readingAnchorAt`, `restoreTarget`, `restoredTo` | 1619, 1667, 1637, 1560, 1561, 1574, 1581 | Where the page was being read, recorded on scroll and put back on every new document | **Remove the restore, keep the record if día 7 finds a reader for it.** Under `patch` the only rule is «another page starts at the top» (`pageChanged` in `applyPatch`) |
| `wireReadingPosition` | 1588 | The scroll listener that records the reading position | **Stays only if the 164 px width re-anchor (sprint 25 día 8's open item) is built on it**; otherwise it goes with the restore |
| `keepWriting`, `keepChosenFocus`, `pendingReturn`, `focusTarget` | 904, 894, 1224, 1252 | The intents a gesture leaves for whoever draws next | **Keep.** They are read by the settles under both routes — the plan's precision of 21 October named them as swap-only and the days proved otherwise: `keepWriting` was día 4's third real defect. What goes is the «at wiring» restoration blocks around them, not the refs |
| `pendingPatch` | 1042 | A patch that arrived before the first wiring | **Keep.** It is the patch route's own |
| `handlePainters` | 924 | One handle painter per document (`WeakMap<Document, …>`) | **Simplify to one ref** once there is one document; not before |
| `data-buffered` | 1304 | The second slot in the JSX: `key`, `data-buffered`, `inert`, `aria-hidden` | **Remove** with the buffer |

The comments that reason from the rebuild (día 7's list: `:1056, :864, :1117, :4393, :5606, …`)
are día 7's to rewrite as «under `patch` … / under `swap` …», and 27 día 1 deletes the `swap` halves.

## `apps/editor/e2e/critical-flows.e2e.test.ts`

| Symbol | Line | 27 día 1 |
|---|---|---|
| `PREVIEW` | 50 | **Becomes `"iframe"`**: one frame, and the 52 other `data-buffered` reads go with it |
| `onTheRouteAsked`, `canvasRoute` | 820, 426 | **Remove.** The per-route branches in the three buffered-swap walks and the día 1 baseline collapse to the `patch` branch; the `swap` branches are deleted, not kept as dead code |
| `watchPreviewWhile`, `canvasSnapshot`, `whereHandlesAre` | 10525, 5306, 17540 | **Simplify**: no buffered frame to watch or to label; the walks keep their samples (never blank, opacity 1) |
| `studioToolsOn` | 283 | **Rewrite its doc comment**, which still explains the outgoing document |

## `.github/workflows/ci.yml`

| Symbol | 27 día 1 |
|---|---|
| The `e2e-swap` job | **Remove.** One e2e job; the 20-minute question (two cancels in two days) is David's and stands on its own |

## `apps/editor/src/editor/canvasMode.ts`, `apps/editor/test/canvasMode.test.ts`

**Remove** both; `DEFAULT_CANVAS_MODE` has no second value to default from.

## What this list does not decide

- Whether escalating a section should measure and write its rows in one step (día 5 found the two
  steps 200 ms apart, racing a hand that drags at once — in both routes). An editor question, not
  a retirement one.
- The 20-minute limit of the e2e jobs.
- The 164 px re-anchor on width (sprint 25 día 8's open item), which decides `wireReadingPosition`'s
  fate above.
