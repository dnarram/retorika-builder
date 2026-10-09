/**
 * The cover's image slot is 1..1 (required) and there is still no photograph to put in it, so it
 * gets an honest marker — the same one the usability prototype used (see `docs/design/prototype/`,
 * each business's `assets/foto-muestra.svg`).
 *
 * **The reason changed and this comment did not, until the sprint 10 closeout.** It used to say
 * `packages/photobank` «does not exist yet». That package shipped in sprint 6: eleven sector files,
 * a schema that refuses an image breaking any of ADR 0011's checkable rules, and the same path an
 * upload takes. It held **zero images** until 8 October 2026, when `restaurante-bar` was approved
 * with nine; the other ten sectors still hold none, because ADR 0011 wants photographs generated
 * and reviewed like the text bank, and that is content production with a licence attached rather
 * than code. So the marker stays for those ten, for a reason that is one step further along than
 * the one written here before.
 *
 * Inlined as a `data:` URI rather than a file at a path: a relative "assets/placeholder.svg" only
 * resolves when something actually serves it there, which was true nowhere this generator runs —
 * not inside an app's live preview (day 4 found this: the browser 404s resolving it against the
 * page's own URL), and not inside a ZIP without publisher wiring copying it in (day 5). A data
 * URI is self-contained in both, and needs no asset map entry at all. `safeUrl` explicitly allows
 * `data:image/…`, which is exactly this.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600" role="img" aria-label="Tu foto aquí">
  <rect width="1600" height="600" rx="12" fill="#E7EDF6"/>
  <g fill="none" stroke="#94A3B8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="712" y="212" width="176" height="130" rx="12"/>
    <circle cx="759" cy="252" r="15"/>
    <path d="M719 330l54-49 46 41 30-26 32 27"/>
  </g>
  <text x="800" y="410" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="#64748B">Tu foto aquí</text>
  <text x="800" y="452" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#64748B">Cuando subas la tuya, ocupará este espacio</text>
</svg>
`;

export const PLACEHOLDER_IMAGE_ALT = "Marcador de foto: aquí irá tu foto";

/**
 * What an image element's `sample` field says when the image is this marker (ADR 0011, and the
 * schema's own note on the field).
 *
 * The ADR wrote `sample` as «the bank id», which was complete for a bank with images in it and
 * reaches nothing for a sector whose bank is empty — ten of the eleven, since 8 October 2026 —
 * where the marker is the only sample there is.
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
