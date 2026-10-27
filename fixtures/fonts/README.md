# The owner's own font, for the corpus

What `fixtures/assets/` is for photographs, this directory is for a font the owner brought (ADR
0056): the bytes a caller would read from the browser or the account, keyed by the file name the
record mints. The corpus consumers — the publisher's tests, `pnpm size`, `pnpm site:sample` — read
them from here through `ownFontKeysFor`, exactly as they read an image from beside the document.

`fixtures/documents/letra-propia.json` names one font, id `3f9a7c21`, family «Karla 2»:

| file | what it is |
|---|---|
| `propia-3f9a7c21-regular.woff2` | `@fontsource/karla` 5.3.0, `files/karla-latin-400-normal.woff2`, byte for byte |
| `propia-3f9a7c21-bold.woff` | the same package's `files/karla-latin-700-normal.woff` — a second format on purpose, so the golden and the bundle exercise `format("woff")` beside `format("woff2")` |
| `LICENCIA-propia-3f9a7c21.txt` | Karla's OFL 1.1, the holders' text as `packages/publisher/licences/karla.txt` keeps it |

**Why Karla, and why «Karla 2».** The bytes had to be a real font under a licence that lets this
repository carry them, and the gallery's rows are exactly that. Uploading Karla's own file to the
editor would read «Karla» from its `name` table, which is a gallery row's name and therefore refused;
the editor resolves the collision with a numeral and shows the owner the name their site will use.
The fixture is that outcome, written by hand: a real collision, resolved the way día 5 resolves it.

Nothing here is read by the editor or by a published site. It is test data.
