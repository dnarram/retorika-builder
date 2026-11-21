# 0080 — The map is a link to the address, and it is born with the site

**Status:** proposed · **Date:** 2026-11-21 · **Decided by:** David, 20 de noviembre de 2026,
planning sprint 40 — his answers to encargo 2 («Un mapa en «Dónde estamos»»): *«Enlace «Cómo
llegar» a Google Maps desde la dirección»* over a static map image and an embedded map that loads on
press, and *«Nace con la web y se quita desde «Campos»»*; and his adjustment 1 approving the plan:
*«el enlace sigue a la dirección. El generador guarda `query` como copia de la dirección; si el dueño
corrige después la dirección en «Campos», «Cómo llegar» seguiría llevando a la antigua. El enlace se
deriva de la dirección actual, salvo que el dueño haya escrito otro destino a propósito. Prueba e2e:
cambio la dirección y el href cambia. Saboteo: la copia fija la pone roja»*. · **Recorded by
development at his instruction, with the standing note that development does not sign.** ·
**Amends:** [ADR 0004](0004-role-vocabulary-v1.md) («`map` publishes as a static image plus a link to
the maps application») · **Relates to:** [ADR 0001](0001-static-published-sites.md),
[ADR 0058](0058-a-published-page-carries-one-script-and-it-is-constant.md) (the script stays 829 B) · **Touches:**
`packages/schema` (1.21.0, migration `0022`), `packages/renderer`, `packages/generator`,
`packages/catalog` (a test), `apps/editor`. **One golden is new — `donde-estamos-con-mapa`; the
other 24 are byte-identical.**

## Context

The location section has had a `map` slot since the first sprint, and ADR 0004 wrote what it would
publish: «a static image plus a link to the maps application». Neither half was ever built. The value
demanded a latitude and a longitude; question 4 collects free text; no panel wrote one. The generator
left the slot empty with a comment, and the one corpus fixture holding a map (`contacto-y-horario`,
written by hand) linked to OpenStreetMap by coordinates nobody could produce.

David asked for the owner to be able to give the exact place and how to get there, and was offered
three things, costed: a link from the address; a static map image composed when editing; a map
embedded that loads on press. He chose the link, born with the site.

## Decision

### 1. One link, nothing fetched and nothing embedded

«Cómo llegar» is an `<a>` under the address — the map's own slot, in the place the catalog already
gives it. It goes to **Google Maps** (`https://www.google.com/maps/search/?api=1&query=…`), which on a
phone opens the maps application the visitor already has. The page holds no script for it (the header's
constant stays 829 B), no image, no frame, no request: the visitor's browser goes to Google only when
the visitor presses it, so there is no cookie, no third party and nothing to consent to on the
published page (RGPD, LSSI). Opened from a disk without network, the site works whole; the link alone
cannot go anywhere until there is one.

### 2. Where it leads is not stored: it follows the address (David's adjustment 1)

The value is `{ kind: "map", label }` and nothing else. **`mapHref`** (`packages/schema/src/map.ts`)
reads, when the page is drawn: a point, if the map has one (ADR 0004's form, to OpenStreetMap as it
always went — `contacto-y-horario` publishes byte for byte); otherwise a place written on purpose
(`query`, «Otro sitio, si no es la dirección» in «Campos»); otherwise **the address its section shows**
— the first visible element of the location preset's `address` slot. A corrected address moves the
link. A copy of the address in the document would be two copies of one fact, drifting at the first
edit — the avance already reads its title from its destination for the same reason.

The address travels **only as a query value**, through `encodeURIComponent`: quotes, ampersands, a
`javascript:` typed into the address all become characters of one parameter, and `safeUrl` is applied
as to every href.

### 3. Where it leads nowhere, the download says so

No point, no place and no visible address is a dead link: `listDeadDestinations` names the map with
its words, the download is refused as for any button pointing nowhere (the dead-link rule `/api/download` has held since sprint 5), «Campos» paints the
row red and says why, and the renderer writes `#` — never `""`, which from a disk reloads the page.
The renderer and the check read the same `mapHref`, so they cannot disagree.

### 4. Born with the site; changed or taken off in «Campos»

The generator writes `{ kind: "map", label: "Cómo llegar" }` into every location section — every
site whose owner gave an address. «Campos» lists the row «Mapa»: its words, a line saying where it
leads («Lleva a Google Maps con la dirección de esta sección», or «…con el sitio de abajo, no con la
dirección»), and the box for another place. Emptying the place follows the address again; emptying
the words takes the link off the page, as every row of that panel does. **A site saved before today
has no map, and keeps none**: the row is offered empty, and writing its words creates it following
the address. In the canvas the link is a text like a button's label (ADR 0079): the first click
chooses it, the second writes.

### 5. Schema 1.21.0, migration `0022`

`query` (1–300 characters, trimmed) is new, and the point becomes an optional pair — both or neither,
latitude within ±90 and longitude within ±180. `up` seals and moves nothing. `down` is lossy and says
so: a map without a point has no 1.20.0 form and is taken out of its section; a map with a point keeps
it and loses its `query`.

## What is preserved

- **ADR 0001 and ADR 0058**: static HTML and CSS, no script for the map, the constant at 829 B.
- **Every saved site, byte for byte**: none holds a map; the generator's new output is for sites
  generated from today. The corpus's 24 goldens do not move.
- **One source for dead destinations**, now with the map in it.

## What is lost, and it is named

- **The static image ADR 0004 promised.** Composing one needs a geocoder and map tiles fetched from
  our server, with a key, a licence and OpenStreetMap's attribution on the image: two to three days
  and its own ADR. Costed in the sprint 41 backlog.
- **A map that shows the place without leaving the page.** By David's choice: an embedded map is a
  third party on the published page, with cookies, a consent notice and nothing to show offline.
- **The visitor leaves the site to see the place**, in the maps application, which is where a phone
  user wanted to be anyway.

## What this does not decide

- Coordinates entered by the owner; a pin dragged on a map.
- Another provider than Google Maps for the address and the place (OpenStreetMap stays for a point).
- «Cómo llegar» anywhere but the location section.

## Consequences

- `packages/schema`: `document.ts` (the `map` value, `SCHEMA_VERSION` 1.21.0), `map.ts` (`mapHref`,
  `addressOf`, `MAP_ADDRESS_SLOT`), `destinations.ts` (the map in `listDeadDestinations`), migration
  `0022` with its block in `migrations.test.ts`, `test/map.test.ts`, the snapshot.
- `packages/renderer`: `build.ts` draws the href from `mapHref` over the section; `test/map.test.ts`.
- `packages/generator`: `buildLocation` writes the map; `locales/es.json`; the location test inverted.
- `packages/catalog`: the location test holds `MAP_ADDRESS_SLOT` to the preset's address.
- `apps/editor`: `sectionFields.ts` (the `map` row, `fieldValueFor`), `FieldsPanel.tsx`, `es.json`
  (six keys); the e2e walk «sprint 40 día 4».
- `fixtures/documents/donde-estamos-con-mapa.json` and its golden.
- The record is `docs/design/REVIEW.md`, sprint 40 día 4.
