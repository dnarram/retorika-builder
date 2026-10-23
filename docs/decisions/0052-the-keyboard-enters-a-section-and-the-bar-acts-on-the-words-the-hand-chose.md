# 0052 — The keyboard enters a section, and the bar acts on the words the hand chose

**Status:** proposed · **Date:** 2026-10-23 · **Decided by: David, 23 de octubre de 2026**, choosing
the theme of sprint 27's days 2 to 6 from the inventory — «teclado y foco del editor», what
[ADR 0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md) left on purpose («keyboard
inside a section … the text toolbar's own open defect») and what the backlog had measured for four
sprints without touching — together with the four adjustments he made while approving the plan, each
quoted where it lands below · **Recorded by development, which does not sign** · **Relates to:**
[ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) §5,
[ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) (a text is chosen before it is written
in; its §2 said where the Tab stop went and this one says when it is one),
[ADR 0049](0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) §3,
[ADR 0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md) §5 (the listeners are
delegated, which is why a `tabindex` is an attribute and not a wiring) · **Touches:** `apps/editor`
(the canvas's keyboard, the floating bar, the shell's landmarks), `apps/editor/e2e`, docs. **Neither
`packages/renderer` nor `packages/schema`: the published page does not change by a byte, and no
golden moves.**

## Context

**The canvas wanted to be one Tab stop and stopped being one without anybody deciding it.** Sprint
17 día 3 built the roving `tabindex` — `0` on the section that holds the keyboard's place, `-1` on
the rest — and wrote beside `markChosen` that «`tabindex` arrives only while chosen, which is what
keeps the canvas **one** Tab stop when nothing is». The walk «se alcanza con Tab, es una sola parada»
has asserted it since. But `prepareTexts` gave `tabindex="0"` to **every** text on every repaint, and
`prepareDraggables` to every photograph and list once the design tools were on; nothing ever took a
`tabindex` away (`removeAttribute` did not appear in `Editor.tsx`). The sections were one stop. The
page was not.

Measured on 19 and 23 October 2026, in Chromium, with the design tools on:

| What | Measured |
|---|---|
| Tab stops in the canvas, from its first to the rail | **about seventy-five** (twenty-three of them the gallery's photographs) |
| presses from inside a hand-designed section to «Colocación» in the «Diseño» panel | bound of **200**, because the panel sits after the canvas in the document; a bound of forty ended on the `IFRAME` |
| Tab reaching a section *itself* once focus had been inside it | **never**: the delegated `focusin` moved the one `0` to the child's section, always *behind* the cursor. `-1,-1,-1,-1,-1,0` before entering, `0,-1,-1,-1,-1,-1` the moment a child took focus; sixty presses of `keyboardTo` found nothing. `Shift+Tab` from inside was the only way forward |

The last row is the one that shaped the walks. The sprint 24 día 10 mouseless walk Tabs into the
canvas, lands on a text, and goes *backwards* with `Shift+Tab` to stand on the section, with a comment
calling it «a finding rather than a trick». The backlog carried it as an open question — whether Tab
should walk a section's insides at all before the section is chosen — through sprints 24, 25 and 26,
each one adding stops (the fine grid gives a hand-designed section more placed elements to walk past).

**Four more things the inventory read in the code, for days 3 to 6.** The floating text bar keeps
half of `role="toolbar"`: one stop on its grip and fourteen controls at `-1`, with the arrows between
them written down as «the easy part» and what they act on as the hard one, because «B» needs the
words the person chose and Tab-ing off a text collapses the selection that chose them. Marking a text
that has not been committed marks the *document's* words, not the ones on screen, because the button
reads the DOM's range and writes to a document that does not have the new words until `focusout`.
Escalating a section to a hand-designed one is two document changes about 200 ms apart, which the
walks hide behind 400 ms of silence in about twenty places. And the editor's shell has no landmark at
all — no `<main>`, no `<nav>`, no `<header>`; the three `region` nodes axe reports are a status line,
an anchor and a notice.

## Decision

### 1. The canvas is one Tab stop

Tab enters the canvas by the section that holds the keyboard — `keyboardSection`, the first section
when none does. ↑ and ↓ move between sections, Intro chooses one, Escape lets go. This is the model
`sectionKeyAction` and `rovingTabIndex` have implemented since sprint 17; what changes is that it is
now true of the page and not only of the sections.

### 2. A section's insides are stops only while that section holds the keyboard

Everything inside a section that Tab could stop on — the texts, the placed photographs and lists with
the design tools on, the page's own links and buttons, the chrome's verbs, badges and line buttons —
carries `tabindex="0"` while its section is the holder and `-1` otherwise. One pass,
`applyCanvasStops`, applies the sections' roving `tabindex` and their insides' together: at wiring,
after every patch, and whenever the keyboard's place moves. The pure half is `rovingTabIndexInside`
in `sectionKeys.ts`, which shares `keyboardHolder` with `rovingTabIndex` so the two can never
disagree about who the holder is.

What follows from it, each the opposite of a row in the table above:

- **Tab from the holder enters its own stops in document order**, and Tab after the last of them
  leaves the canvas, because the other sections' insides are not in the way.
- **A section is reachable by Tab from outside after its text has been touched.** The `focusin` that
  moves the keyboard's place still runs, but it now also takes the other sections' insides out of the
  order, so from the rail Tab stands on the holder itself before anything inside it.
- **The keyboard route to a text of the third section is Tab, ↓, ↓, Tab** — stand on the door, move
  to the section, enter it. Intro before the last Tab chooses the section and draws its verbs, which
  then come first inside it.
- **A click still focuses a text at `-1`**, which is what `-1` means. Nothing changes for the hand.

Three things are deliberately outside the rule, and each is named in the code where the rule is:

- **The floating text bar keeps its own contract** — one stop on the grip, controls at `-1` — so its
  insides are skipped and the grip is treated like any other button inside the section. Its arrows
  are §3's, on día 4.
- **A placed element with the design tools off is not a stop at all.** It loses the attribute rather
  than keeping yesterday's `0`, which is the «nothing ever took one away» of the context.
- **The gaps' pills stay what they are**: one native stop per gap, *between* the sections and not
  inside any, because «añadir una sección aquí» has no other keyboard route. They are the stops left
  in the canvas besides the holder and its insides, and the published page's own navigation links
  before the first section.

### 3. The floating bar is a complete keyboard landmark (día 4)

One stop, the grip, as today. ← and → between the controls, Inicio and Fin to the first and the
last, Intro and Espacio press, Escape returns to the words without doing anything. **It is reached by
Tab**, because the bar sits in Tab order right after the text that opened it (it is inserted after the
text's top-level branch inside its section today; día 4 asserts it with a text that is *not* the last
of its branch, and inserts the bar right after the text if that fails, or says why not — David's note
7), **and by Alt+F10** from a text with focus, the convention of TinyMCE and CKEditor (adjustment 4);
the legend says so, as «Alt+F10» on Windows and «Fn+⌥+F10» on a Mac, because without Fn a MacBook's
F10 mutes the audio and the key never arrives (note 8).

**What the bar acts on**: the selection `refresh()` recorded before focus left the text, kept **as
offsets** — `{ id of the text, start, end }` in characters — and never as a live `Range`, which a
patch collapses when it replaces the text nodes under it (adjustment 2); put back with
`setSelectionOffsets`, which exists. **After a press from the keyboard, focus returns to the words
with the selection restored**: the bar is a detour and the text is home, the same as with the mouse,
where `mousedown` never lets go of the text.

### 4. Marking commits first, and the mark shows without leaving the text (día 3)

A mark on uncommitted text calls the commit — the `focusout`'s, extracted into a function — and then
reads the range; with the DOM and the document equal, the offsets of `selectionRange` are good for
both. And the mark is an edit on the very text that has focus: it is applied **in place**, focus
inside, and the selection is restored by offsets (adjustment 3). The exception to the patch's third
rule already exists for `cause: "mark"` (`patchCanvas.ts`, `touchedByHistory`); what is missing is
asserting it in the DOM while focus is still in the text.

### 5. Escalating is one document change (día 5)

One history entry, one serial, and the walks stop waiting for silence after it.

### 6. The shell has landmarks (día 6)

`<header>` for the top bar, `<nav aria-label>` for the rail, `<main>` for the canvas and its panel.
The canvas's sections stay `role="group"` — David's correction of sprint 17, for the reason it was
made: a named `<section>` is a `region` landmark, and naming every section would add five to nine of
them to the tree.

### 7. Mitigation for the main audience (David, 17 October 2026)

The key legend (`.rb-keys`, `showKeyLegend`) says the model in one Spanish line when a section has
the keyboard — «Tab: lo de esta sección, y después fuera del lienzo» — and it appears the moment a
section itself takes focus, by Tab as much as by an arrow. And everything keeps working by click
without knowing the model exists: a text at `-1` is one click from being written in, as it always was.

## What this does not decide

The 164 px the page shifts when a panel closes (its two untried repairs stay named in the backlog:
keep the scroll *fraction*, or take the panel's width out of the mock-up's width); named versions;
what the keyboard does in the gallery of twenty-three photographs beyond Tab between them. And the
chrome at screen size, which is ADR 0053's on día 7.

## What is measured on día 2 (23 October 2026)

Día 2 ships §1, §2 and §7 alone — the change of model in its own pull request, before any feature
leans on it, so that what it breaks is seen on its own. Measured in Chromium, 1440 × 900:

| Measure | Before | Día 2 |
|---|---|---|
| Tab stops in the canvas with the design tools on, first stop to the rail | about 75 | **22** — three navigation links, a pill, the door, its five elements (each text followed by the grip of the bar that opened on it, the photograph by its badge), six pills |
| presses from inside a hand-designed section to «Diseño» / «Colocación» (the sprint 24 walk's bound) | 200 | **36** and **37**; the bound is 60 |
| Tab back to the section whose text was clicked, from the top of the document | never (60 presses, no section) | **20** presses, and the first section it stands on is that one |
| Tab from «Qué hacemos» to the rail | into the next section's texts | **12** presses: seven inside the section, five pills, nothing of another section |

Walks rewritten for the model: **one** — the sprint 24 día 10 mouseless walk, which went backwards onto the section with `Shift+Tab` and now stands on it going forward, and whose two bounds of two hundred are the measured sixty. The other ten walks that press Tab passed unchanged, in the full suite. Walks added: three, under `sprint 27 día 2`, the first two red under the old model.

## What is measured on día 3 (23 October 2026)

Día 3 ships §4, and the cause of the bar that dies with it — which turned out to be the same
sentence from the other side: a mark is useless if the bar cannot be pressed.

| Measure | Before | Día 3 |
|---|---|---|
| the bar's top in the frame's own pixels, after a section was chosen and then a text of another section (1440 × 900, `scrollY` 189) | **−31**, thirty-one pixels above anything on screen | **75**, with its bottom at 113 inside a band 774 tall |
| «B» pressed with the mouse where the bar actually is | the focus left the words for the body, the deferred blur closed the bar, no bold | the focus stays on the words, the bar stays, the word is bold |
| a mark on text that was never committed | the mark's patch put the document's older text back over the typed words | the typed words stay, in bold, with the focus still in them |
| presses of the end-of-line key before the restored selection collapses | 2 measured on a Mac with `End` | **1 on each platform's own key**: `End` on Linux (CI), `Cmd+→` on a Mac — nothing to fix (below) |

**The cause of the bar, which four days of notes had not named.** The bar's place was decided
against the section it sits in — «above the words» meaning «above them inside the section» — and the
canvas is a scrolling document inside an iframe. Choosing a section focuses it, focus scrolls, and
the next text clicked can be a few pixels below the frame's top edge with its whole section above
it: the place above it is then off the top of what is on screen. The press lands on the editor's own
chrome *outside* the frame, the words lose the focus, and the deferred `focusout` closes the bar.
`toolbarPoint` now takes the band of the section that is on screen and decides against that, falling
to the visible edge when neither side fits. The band narrows the section rather than replacing it:
the section's own top stays the floor, which the first version forgot and the sprint 9 walk on
«Contacto» caught in the full suite, the bar drawn over the section above it. Nothing about the press itself was ever wrong, which is
why the four things the backlog ruled out were all correctly ruled out.

**`End` is measured, and it is not the editor's.** The backlog's framing was wrong in both halves:
it is not the restored `Range`'s direction and it is not the mark. On Linux — CI's run — `End`
collapses at the first press; the walk was an `it.fails` until that run passed it. On a Mac the
first `End` and the first `Home` do nothing in the canvas and the second `End` collapses, while
`Cmd+→`, the Mac's own end-of-line key, collapses at the first press. No code of ours treats the
key, nothing calls `preventDefault`, nothing calls a `Selection` method on the press, and an
element the editor never wired behaves the same. The walk asserts each platform's own key.

## What is measured on día 4 (23 October 2026)

Día 4 ships §3. Measured in Chromium on macOS, 1440 × 900, with the walks under `sprint 27 día 4`
in `critical-flows.e2e.test.ts`; where the «before» is read off the code rather than measured, the row
says so.

| Measure | Before | Día 4 |
|---|---|---|
| Tab from a text with another stop behind it in its own branch — a gallery caption, `ul > li > p`, found by asking the page | not the bar (measured); by the document's order, the stop behind the caption, with the bar — inserted after the whole list — further on | the bar's grip; Tab again goes on to the stop that followed the caption (its own card's «bajar» button), Shift+Tab comes back to the caption |
| Tab from a text **being written in** — the cover's headline, typed over and not committed | the focus was lost: `focusout` toward the grip and **no `focusin` on it**, the focus on the body, the bar gone about 10 ms later | the grip, which keeps the focus through the commit's patch |
| Alt+F10 from a text | nothing (no listener took it — read off the code) | the grip |
| → on the grip | moved the bar 16 px to the right (`gripKeyAction`, read off the code) | «B», coming round from the grip, which is the bar's last control |
| «B» from the keyboard, on «hoy» chosen with Shift+← | unreachable | «hoy» in bold, the focus back in the headline, writing, «hoy» still selected; axe finds nothing serious with a control of the bar focused |
| Escape inside the bar | nothing (read off the code) | back to the words, writing, with the caret where it was: the next key types after «Reserva hoy» |
| Tab from the bar on to a stop that is not a text | the bar stayed drawn — measured with the new rule taken out, at a person's pace | the bar closes |

**The cover's headline was the surprise.** It is a direct child of its section, so the bar was
already inserted right behind it and note 7's mechanism does not apply to it — and still the
browser's own Tab from it, while it was being written in, never arrived at the grip. Measured on the
unchanged code, and then twice with a recorder of focus events and the editor's own Tab taken out: the headline's `focusout` names the grip as where the focus is
going, and the grip never gets a `focusin`. Deferring the line that takes `contenteditable` off the
headline inside that same `focusout` does not change it, so that line is not the cause; what the
browser does is not established. What is established is the other half: a focus the editor moves
itself, from the text's `keydown`, arrives and survives the commit's patch. The sprint 20 walk that
first reached the grip by Tab did it from a text that was chosen and not being written in, which is
why it never met this. **It was a second way for the bar to die**, and it is gone with the first.

### What the plan did not say, and the code had to decide

Written by development for David to confirm or overturn; none of it is in the plan he approved.

1. **The bar is not inserted right after the text, and the Tab order is made by the keys instead**
   (note 7's «o la PR dice por qué no»). Inside a card the bar would sit in an `.rb-line`, which the
   line chrome makes `position: relative`: the card would become the bar's containing block while
   every `top` and `left` the bar is given is in its section's coordinates, and the bar would be
   drawn a card's offset away from its words. So Tab from the text goes to the grip, Tab from
   anywhere in the bar goes on to the first stop after the text in document order
   (`nextStopAfter`), and Shift+Tab from the bar comes back to the text. The order a person gets is
   the one a bar beside the words would give, and where the bar is drawn does not move.
2. **On the text bar's grip, ↑ and ↓ still move it; ← → and Inicio are the toolbar's.** The grip is
   the one control a keyboard arrives on, so → there has to reach «B» — the plan's own walk says
   «→ hasta «B»» — and Inicio there has to mean «the first control». The horizontal nudge is
   dropped, and «forget where I put it» is two presses of the grip, the first sending the bar to the
   other side of the words and the second bringing it to its computed place. The legend says «En el
   asa: ↑ ↓ moverla». **The verbs' cluster keeps all four arrows and `Home`**: it is not a toolbar.
3. **← and → are taken in the exact-pixel fields too**, against the pattern's advice for a text
   input: the fields hold up to three digits, typed and stepped with ↑ ↓, and leaving the arrows to
   them would make two places in the middle of the bar where → stops.
4. **What «a press» returns to the words**: the controls that act on them — the marks, the sizes,
   the families, the swatches and the colour's «quitar» — go back to the words first, **writing
   again if they were being written in**, and act there, which is exactly the state a mouse press
   finds them in. The grip acts on the bar and stays; «Enlace» and «Desvincular» go elsewhere; the
   selects and the number fields keep the focus, because a change in them is not a press.
5. **The record of the words includes the caret.** §3 speaks of the selection `refresh()` records,
   which is words only; the way back also needs a collapsed caret, or Escape after typing would
   come back to a select-all and the next key would replace the whole text. So the record is taken
   as the focus crosses from the text into the bar — `{ text, writing, from, to }`, offsets, with
   the text itself so an edit made while the bar had the keyboard drops it rather than putting it
   back on other letters.
6. **The bar closes when the keyboard leaves both it and its words**, the text's own rule from the
   other side. Nothing did before, and nothing needed to while the bar could not be walked.

**One finding that changes the framing of adjustment 2.** With the record taken out, «B» was still
drawn: in Chromium the words stayed selected in the DOM while the grip had the focus. What the
record is load-bearing for is the way back. Without
it the return to writing selects the whole text, and «B» bolded «Reserva hoy» instead of «hoy».

### Sabotages

| Sabotage | What went red |
|---|---|
| the record not taken (`at: null`) | both «negrita sin ratón» walks (the bold landed on «Reserva hoy») and the Escape walk (the caret came back as a select-all) |
| Tab from the text left to the browser | the next-stop walk and «negrita» by Tab |
| Tab from the bar left to the browser | the next-stop walk: «Tab from the bar skipped what follows the text» |
| the bar at the end of `<body>` (the plan's) | **none of día 4's** — the order no longer depends on where the bar is — and two others: día 2's «el lienzo entero cabe en pocas paradas» (Tab never left the frame in 60) and día 3's «la barra se dibuja donde se puede pulsar» (drawn above the screen) |
| the bar's leaving rule taken out | the next-stop walk, **only at a person's pace**: pressing faster than the text's own deferred blur check lets that check run after the next Tab and close the bar for its own reasons, so the walk waits 100 ms before that Tab |
| a press from the keyboard acting without going back | both «negrita» walks: the focus did not come back to the words |
| the way back without putting the selection back | both «negrita» walks (whole text bold) and the Escape walk |

## Consequences

- **The canvas with the tools on is a short list again**, and the two mouseless walks say so with
  their bounds instead of a comment about why the bound is two hundred.
- **A `tabindex` the patch must keep.** `tabindex` is in `CHROME_ATTRIBUTES`; the stops are
  reapplied after every patch inside `redrawChrome` regardless, after every drawing that can add a
  button to a section and before the settles that may focus one.
- **Verbs, badges and line buttons of a section that is not the holder are `-1`.** They exist only
  for the chosen section in practice — `select` draws them — and the chosen section is the holder
  except after an arrow moved the keyboard without choosing; then they are not in the way either,
  which is the point.
- **Two ADRs proposed on top of ten unsigned**: this one and 0053.

**Still `proposed`.** This ADR until David signs it.
