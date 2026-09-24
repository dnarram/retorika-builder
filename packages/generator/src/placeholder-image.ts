/**
 * The cover's image slot is 1..1 (required), and `packages/photobank` does not exist yet: ADR
 * 0011 needs real photos, generated and reviewed like the text bank, which is content production
 * this sprint does not include. This is the same honest placeholder the usability prototype used
 * (see `docs/design/prototype/`, each business's `assets/foto-muestra.svg`), inlined so the
 * generator needs no filesystem access and works the same on a laptop and once deployed.
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

export const PLACEHOLDER_IMAGE_PATH = "assets/placeholder.svg";
export const PLACEHOLDER_IMAGE_ALT = "Marcador de foto: aquí irá tu foto";

export function placeholderImageBytes(): Uint8Array {
  return new TextEncoder().encode(PLACEHOLDER_SVG);
}
