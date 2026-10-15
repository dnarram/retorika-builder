# 0042 — The application fits a phone

**Status:** proposed · **Date:** 2026-10-15 ·
**Decided by:** David, 15 October 2026, opening sprint 21 — the request in his own words: «Quiero
que al abrir la aplicación web de Retorika esta se adapte al tamaño de pantalla. Para ello quiero
que compruebes que ningún elemento de la landing sobresale, ningún texto sobresale de su botón y
ningún elemento termina cortado por la pantalla. Esto es aplicable también a las pantallas con
preguntas, a las 3 propuestas presentadas al usuario y al editor así como a los paneles izquierdo,
superior, derecho la barra flotante, los iconos de sección, la pantalla de editor principal y el
encabezado conteniendo los botones de Descargar.» Two choices made the same day, between options
put to him: the proposals become a carousel on a phone, and the editor's header becomes three rows.
Two additions on approving the plan: fields of at least 16px on a phone, and a checklist for a real
iPhone. ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** ·
**Relates to:** [ADR 0025 §5](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md)
(the design tools are not offered on a small screen — unchanged), [ADR 0012](0012-application-stack-approved.md)
(«Guardado en este navegador» is never shortened — unchanged), [ADR 0030](0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md)
(the one breakpoint of the published site, which this decision borrows), [ADR 0034](0034-the-account-arrives-at-the-end.md)
(where the account is reached — unchanged) ·
**Touches:** `apps/editor` only. Not `packages/renderer`, not the goldens, not the document.

## Context

The published site has answered for a phone since sprint 2: the renderer's one media query at
720px, the overflow harness at 320, 768 and 1280, the mobile Lighthouse preset. **The application
that builds it never had.** `apps/editor` carried no width media query at all; the editor was
measured only at 1024, 1280 and 1600, and a comment in the e2e suite called anything narrower
«unsupported» — a rule nobody had decided, living in a test comment and in `MIN_STUDIO_WIDTH`,
which ADR 0025 §5 wrote for a different purpose (not offering the design tools on a small screen,
not refusing the editor).

Measured on the deployed application on 15 October 2026, in Chromium emulating a phone:

| Screen | 390px (iPhone 13) | 320px | 768px |
|---|---|---|---|
| Landing | fits | fits | — |
| The five questions | three-column choice grids with a fixed `height: 56`: «Que me manden un correo» paints three lines, two of them outside the box | «Peluquería y barbería» spills | fits |
| The three proposals | each card 60px wide; the thumbnail shows **17 %** of the page | 37px, **10 %** | 186px, 52 % |
| The editor | the header's right-hand group is 673px fixed, so the page opens **822px** wide: «Descargar» and «Guardar en mi cuenta» off-screen, the canvas at scale 0.36 | the same, 0.27 | the header is 53px wider than the screen; the rest works at 0.69 |
| The editor with «Estilo» open | the canvas card pushed **257px past the left edge** | the same | fits |

The dossier calls the proposals «la pantalla más importante del producto: aquí es donde el usuario
decide si sigue o se va a Canva». On a phone it showed a sixth of each proposal.

## The decision

1. **The application answers to three widths, and both boundaries already existed.**

   | Class | Window width | What it means |
   |---|---|---|
   | phone | ≤ 720 | the width at which the owner's own site would be showing its phone layout — `PHONE_BREAKPOINT`, the renderer's one media query (ADR 0030) |
   | tablet | 721 – 1023 | between the two |
   | studio | ≥ 1024 | `MIN_STUDIO_WIDTH`, where ADR 0025 §5 starts offering the design tools |

   No new number is introduced. «La vista de móvil» inside the editor and «un móvil» holding the
   editor mean the same width, which is what lets the canvas on a phone simply *be* the phone view.
   The CSS side says it as three named variants in `globals.css` — `phone:`, `tablet:`, `studio:` —
   and the JavaScript side as one `matchMedia` in `viewport.ts`; `test/canvasZoom.test.ts` reads
   both and the renderer and fails if any of the three copies drifts.

2. **What each screen does in each class.**

   | Screen | phone | tablet | studio |
   |---|---|---|---|
   | Landing, the five questions, sign-in | fluid: no breakpoint. Padding and headings in `clamp()`, choice grids as «as many columns of N px as fit», every card and button `minHeight` rather than `height` | the same | the same, unchanged to the eye |
   | The three proposals | **a horizontal carousel**: one card about 85 % of the width, the next peeking, snapping card to card; the thumbnail scaled to the card's measured width so the whole page shows | the same below 900px; three columns above | three columns, as drawn |
   | Editor header | **three rows**: (1) brand, site name, undo, redo, «Descargar»; (2) page tabs and the device toggle; (3) a status strip with the full save sentence and «Guardar en mi cuenta» as a text button, wrapping when the two do not fit | two rows: the status strip drops under the rest | one row of 58px, as drawn |
   | Editor rail | **a bottom bar**: five items, icon and word, above the home indicator | the 80px rail | the 80px rail, seven items with the tools on |
   | Editor canvas | opens in «Ver en móvil», at its real 320px; the desktop view stays available and scales, as it always has | as studio | holds its layout width and scales (sprint 11) |
   | Editor panels, fields panel | **sheets** from the bottom, full width, their own scroll, a close button each | beside the canvas, 340px | beside the canvas, 340px |
   | Dialogs, toast, key legend | fit the screen; the toast clears the bottom bar; the key legend is not drawn where there is no keyboard | as studio | as studio |

3. **The questions and the proposals have no breakpoint.** They are inline-styled screens, and
   everything they need is fluid: `clamp()`, `repeat(auto-fill, minmax(min(100%, N px), 1fr))`,
   `minHeight`. A breakpoint is a number to pin and a second layout to keep honest; a grid that
   fits as many columns as it has room for has neither. The one width the proposals read — 900, for
   switching to the carousel — is the exception, and it is read with `matchMedia` through
   `viewport.ts` like everything else.

4. **ADR 0025 §5 stands exactly.** Below 1024 the design-tools switch, «Diseño» and «Listas» are
   absent. What changes is only the sentence next to it: the honest answer «use a bigger screen» is
   now about the *tools*, not the editor. The phone editor is the simple editor, which is what the
   dossier's own safeguard says («Diseñar con rejilla en seis pulgadas no funciona»).

5. **ADR 0012's sentence stands exactly.** «Guardado en este navegador» and its account variants
   are never truncated and never hidden on any width. They move to their own row and wrap. The
   alternative considered — moving «Guardar en mi cuenta» into the «Compartir» panel to keep the
   header at two rows — was put to David and not chosen: it takes the account out of sight, which
   touches what ADR 0034 promises about where the account is reached.

6. **The alternative for the proposals, considered and not chosen:** the three cards one under the
   other, full width. Simpler, with no gesture to learn, and it costs about 1200px of vertical
   scrolling to compare three things the dossier wants compared at a glance. The carousel keeps the
   three in view as three. The order is not changed: Clásica, Con foto grande (recommended),
   Compacta, and the row opens scrolled to the recommended one.

7. **On a phone, every field has text of at least 16 pixels.** `input`, `textarea`, `select`,
   wherever they are visible: the questionnaire's, the sign-in forms', the editor's panels'. Safari
   on iOS zooms the whole page into a field whose text is smaller than that, and un-zooming is left
   to the owner. `TextField` enforces the floor whatever a caller asks for, the panels' 13px fields
   grow to 16 in the phone class, and the harness measures the computed size of each one.
   **`maximumScale` and `userScalable: false` are not the fix**, because they take the pinch away
   from everyone to spare one field.

   **The canvas is the exception, and it is named rather than hidden.** The texts inside the
   preview are the owner's site, drawn at the site's own type scale by the renderer that will
   publish it, and editing one is a `contenteditable` on that text. A 14px body line stays 14px in
   the canvas because that is what the visitor will see, and the editor does not restyle the site
   to suit the editor (rule 6, and ADR 0001's one renderer). So on an iPhone, tapping into a line
   of body text smaller than 16px may zoom the page; the headline, the subheadline and the buttons
   are above the threshold in every type scale and do not. This is recorded here, it is on the
   real-iPhone checklist of the sprint's last day, and what David measures there goes to the
   backlog with its number — not quietly fixed by changing a site's type to suit the tool.

8. **The guard is a walk, not a review.** `apps/editor/e2e/critical-flows.e2e.test.ts`, «nada
   sobresale en un móvil»: three emulated devices (320×568, 390×844, 768×1024, each `isMobile`),
   one walk each from the landing through the five questions, the proposals, the editor with each
   panel open, a section and a text selected, both device views and the account dialog. At every
   step: the page opens at the device's width and does not scroll sideways; no visible element is
   outside the screen; no element is cut by an ancestor it cannot scroll; no button's painted text
   leaves its box; and in the phone class, no field under 16px. Screens that later days of the
   sprint fix are written `it.fails` with the day named, so a merged pull request is never red and
   each day turns exactly one into `it`.

## What this does not decide

- Anything about the published site. Rule 7, ADR 0030 and the renderer's CSS are untouched; the
  goldens do not change.
- Whether the design tools should ever be offered below 1024. ADR 0025 §5 holds.
- Two fingers at once on the canvas, which the backlog already records nothing answers.
- A real device. The harness is Chromium's emulation; the sprint's last day leaves David a list to
  walk on an iPhone with Safari — zoom on focus, the bottom bar and the home indicator, `dvh`
  against the browser's bar, the carousel, the ZIP download — and what he finds goes to the
  backlog with its measurement.

## Consequences

- `apps/editor/src/editor/viewport.ts` (new), the three variants in `globals.css`, `viewportFit:
  "cover"` in `layout.tsx`, the editor shell at `h-dvh`.
- The questionnaire kit loses its last fixed heights; `test/buttonText.test.ts` now scans it.
- The e2e comments that said «below 1024 is unsupported» are rewritten as the sprint reaches them;
  `designTools.ts`'s «use a bigger screen» now says which thing needs the screen.
- Day by day in `docs/design/REVIEW.md`, sprint 21.
