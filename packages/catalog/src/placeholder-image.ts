/**
 * The cover's image slot is 1..1 (required) and there is still no photograph to put in it, so it
 * gets an honest marker — the same one the usability prototype used (see `docs/design/prototype/`,
 * each business's `assets/foto-muestra.svg`).
 *
 * **The reason changed and this comment did not, until the sprint 10 closeout.** It used to say
 * `packages/photobank` «does not exist yet». That package shipped in sprint 6: eleven sector files,
 * a schema that refuses an image breaking any of ADR 0011's checkable rules, and the same path an
 * upload takes. What it still holds is **zero images** — counted, not assumed — because ADR 0011
 * wants photographs generated and reviewed like the text bank, and that is content production with
 * a licence attached rather than code. So the marker stays, for a reason that is one step further
 * along than the one written here before.
 *
 * Inlined as a `data:` URI rather than a file at a path: a relative "assets/placeholder.svg" only
 * resolves when something actually serves it there, which was true nowhere this generator runs —
 * not inside an app's live preview (day 4 found this: the browser 404s resolving it against the
 * page's own URL), and not inside a ZIP without publisher wiring copying it in (day 5). A data
 * URI is self-contained in both, and needs no asset map entry at all. `safeUrl` explicitly allows
 * `data:image/…`, which is exactly this.
 */
/**
 * **4:3, and the drawing centred in it, since 9 October 2026.**
 *
 * It was `0 0 1600 600` — 8:3, a letterbox — which was its own shape and nobody else's as long as
 * `.rb-section img` let every image be whatever shape it liked. The cover now declares a ratio and
 * crops to it (`packages/renderer/src/build.ts`: 4/3 beside the words, 3/2 at full width), and a
 * marker drawn at 8:3 inside a 4/3 box is a marker cropped to a third of itself.
 *
 * Drawn at the taller of the two ratios and centred, so **neither box cuts any of it**: at 4/3 it
 * fits exactly, and at 3/2 `object-fit: cover` takes 11% of the height — 67px of this viewBox at
 * each edge — while the icon and the two lines sit inside margins of 478px and 477px. Measured, and
 * `cover-height.browser.test.ts` keeps it measured. What the 3/2 crop does remove is the rounded
 * corners of the backing rectangle, which is invisible: `.rb-section img` rounds the element
 * itself, so `rx` here was never what the owner saw.
 *
 * One marker rather than one per ratio. Two would need the variant threaded down to whoever asks
 * for a placeholder — through `sampleImageFor`, which does not know it — to buy nothing a margin
 * of 478px against a crop of 67px does not already buy.
 *
 * **It is also why the empty slot now reserves the space the photograph will take.** A cover whose
 * marker is 8:3 and whose photograph is 4:3 grows by about 135px at a 1100px window the moment one
 * arrives; drawn at the ratio it will be replaced at, nothing moves.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" role="img" aria-label="Tu foto aquí">
  <rect width="1600" height="1200" rx="12" fill="#E7EDF6"/>
  <g transform="translate(0 266)">
    <g fill="none" stroke="#94A3B8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="712" y="212" width="176" height="130" rx="12"/>
      <circle cx="759" cy="252" r="15"/>
      <path d="M719 330l54-49 46 41 30-26 32 27"/>
    </g>
    <text x="800" y="410" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="#64748B">Tu foto aquí</text>
    <text x="800" y="452" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#64748B">Cuando subas la tuya, ocupará este espacio</text>
  </g>
</svg>
`;

export const PLACEHOLDER_IMAGE_ALT = "Marcador de foto: aquí irá tu foto";

/**
 * What an image element's `sample` field says when the image is this marker (ADR 0011, and the
 * schema's own note on the field).
 *
 * The ADR wrote `sample` as «the bank id», which was complete for a bank with images in it and
 * reaches nothing while the bank is empty — and today the marker is the *only* sample that exists.
 * So the field holds the id of whichever sample it is, and the marker declares itself as one:
 * `marcador` collides with no bank id, because a bank id always carries its sector and a number.
 *
 * One field answers «is this photo the owner's?» for every image in the document, which is what
 * the Fotos panel, the «Foto de ejemplo» label and the warning before a download all ask.
 */
export const PLACEHOLDER_SAMPLE_ID = "marcador";

/**
 * `encodeURIComponent` rather than base64: it is built into both Node and the browser and
 * handles the UTF-8 accented characters in the SVG's own text correctly, with no `Buffer` and
 * no `btoa` — either of which behaves differently, or is absent, depending on which of those two
 * runtimes this ends up bundled for.
 */
export function placeholderImageSrc(): string {
  return `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;
}
