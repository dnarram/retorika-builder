import { tokenToCssVariable } from "@retorika/schema";
import type { PaletteColors } from "@retorika/tokens";
import type { Previewer } from "./panelKit.tsx";

/**
 * **A palette under the mouse paints the canvas before it is pressed** (sprint 38 día 6, David's P7:
 * «previsualizar al pasar escribe las variables de color en la raíz del iframe como cromo — nunca un
 * parche, nunca historia, se repone al salir, lo pisa cualquier parche»). The twin of `headerPreview.ts`:
 * where that one writes an attribute on the live bar, this one writes the theme's colour variables
 * **inline on the canvas's `documentElement`**, which wins over the page's own `:root { --color-… }`
 * block at equal specificity and without `!important` (which `build.ts` never writes there). The
 * document is not touched, nothing is dispatched and no step of history opens.
 *
 * Eight variables, not six: a palette with a fill of its own (ADR 0074) paints its buttons from
 * `--color-fill` and writes on them in `--color-on-fill`, so a preview of one has to carry the pair —
 * and a preview of one without has to **remove** the pair, or the document's fill would stay
 * underneath a palette that fills with its primary.
 *
 * Three things keep it honest, as the bar's:
 *
 * - **A patch wins, and it clears.** `patchCanvas` never touches `documentElement`, so the rule the
 *   bar inherits for free — every patch restores the renderer's attributes — is not inherited here.
 *   `patchNow` calls `clear()` after every patch instead, whether or not a preview is showing.
 * - **Pressing keeps it, unless the press changes nothing.** A press writes the same colours into
 *   the document, so the preview is forgotten and the patch takes the variables away. The one
 *   exception is the caller's: pressing the palette the site already wears dispatches a change that
 *   is not one, no patch comes, and the variables would stay — so that press restores instead.
 * - **One at a time.** A second preview takes the first away before it writes.
 */

const KEYS = [
  "color.primary",
  "color.secondary",
  "color.accent",
  "color.surface",
  "color.ink",
  "color.muted",
  "color.fill",
  "color.onFill",
] as const;

export interface ThemePreviewer extends Previewer<PaletteColors> {
  /** Takes the preview's variables off the canvas's root whether or not one is showing: what a
   * patch does, because the document now says what the colours are. */
  clear(): void;
}

function wipe(root: HTMLElement): void {
  for (const key of KEYS) root.style.removeProperty(tokenToCssVariable(key));
}

/** One previewer per canvas: `documentOf` is read at every call, since the canvas's document is the
 * live one only once it is parsed. */
export function themePreviewer(documentOf: () => Document | null | undefined): ThemePreviewer {
  let active: HTMLElement | null = null;
  const end = (mode: "restore" | "keep") => {
    const was = active;
    active = null;
    if (!was || mode === "keep" || !was.isConnected) return;
    wipe(was);
  };
  return {
    show(colors) {
      end("restore");
      const root = documentOf()?.documentElement;
      if (!root) return;
      active = root;
      for (const key of KEYS) {
        const value = colors[key];
        const variable = tokenToCssVariable(key);
        if (value === undefined) root.style.removeProperty(variable);
        else root.style.setProperty(variable, value);
      }
    },
    end,
    clear() {
      active = null;
      const root = documentOf()?.documentElement;
      if (root) wipe(root);
    },
  };
}
