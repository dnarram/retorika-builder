/**
 * The design-tools switch (ADR 0025, and the advanced dossier §4).
 *
 * **This is the account, for now.** The dossier puts the switch «en su cuenta, del mismo rango que
 * el idioma de la interfaz». There are no accounts: ADR 0012 approved `localStorage` alone and ADR
 * 0021 deferred Supabase until the product is judged sellable. So the preference lives in this
 * browser, the editor says so in those words, and when accounts arrive **this file is the one that
 * moves**.
 *
 * **It is deliberately not a field of `StoredSession`**, and that is the decision rather than a
 * detail of where a key went:
 *
 * - `clearSession()` is «Volver a empezar». Throwing away the draft and starting again must not
 *   change who is looking — a person who restarts their site is the same professional they were a
 *   minute earlier. A separate key gets that for free, because `clearSession` removes the session
 *   keys and nothing else.
 * - **`INV_4` holds by construction.** `Variants.tsx` autosaves when the answers, the histories,
 *   the open variant or the page change; the switch is none of those, so flipping it does not even
 *   run a save. Put it in the session and every flip would rewrite the document's serialisation,
 *   which is the exact shape of the failure the dossier's callout names: «Si encender las
 *   herramientas escribe algo en el proyecto, hemos reconstruido el problema de Wix.»
 *
 * Nothing here may import `@retorika/schema` or touch a document. `test/designTools.test.ts` reads
 * this file and asserts that, because the mistake this guards against is somebody later deciding
 * it would be convenient to remember the switch alongside the site.
 */

const KEY = "retorika.designTools.v1";

/**
 * Below this the switch is not offered at all.
 *
 * The dossier §4 safeguard: «En el móvil van siempre apagadas. Diseñar con rejilla en seis
 * pulgadas no funciona, y es más honesto no ofrecerlo.» That sentence admits two readings and only
 * one survives the rest of the same table — this is the **editor's own window**, not the canvas's
 * device preview. Two rows above, the same table promises «Escritorio, tablet y móvil, editables»,
 * and the three mobile adjustments of rule 7 have to be made with the tools on while looking at the
 * mobile preview. Suspending them there would make that impossible.
 */
export const MIN_STUDIO_WIDTH = 1024;

/** `false` on a first visit, on anything that is not the stored `"1"`, and on storage that throws
 * — a private window, blocked site data. The safe default is the one §4 wants anyway. */
export function loadDesignTools(): boolean {
  try {
    return globalThis.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** `false` when storage refuses, so a caller can tell the difference between "off" and "we could
 * not remember". Same contract as `saveSession`. */
export function saveDesignTools(on: boolean): boolean {
  try {
    if (on) globalThis.localStorage.setItem(KEY, "1");
    else globalThis.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * What the interface actually shows: the stored preference, or `undefined` when the window is too
 * narrow for the switch to be offered at all.
 *
 * **Three states, not two.** «Off» and «not offered» must not collapse into one `false`, because
 * they are different screens: off draws a switch somebody can press, not offered draws nothing.
 * ADR 0025 §5 chose absent over disabled — a greyed switch invites working out how to enable it,
 * and the honest answer is «use a bigger screen», which a disabled control cannot say.
 *
 * The stored value is never rewritten by a narrow window: widening it again brings the tools back
 * exactly as they were. A switch that forgot itself because somebody resized a window would be a
 * second way to lose a setting, and the person did not change their mind.
 */
/**
 * Which of the two places the switch is kept could not be written — and therefore what the editor
 * is allowed to say about it.
 *
 * **One boolean used to carry both, and that made the interface state something untrue.** The
 * preference is written twice: to this browser, and — when somebody is signed in — to their
 * account, because the dossier puts it there, «del mismo rango que el idioma de la interfaz». Either
 * write can be refused, and they are refused for unrelated reasons: blocked site data on one side,
 * a row that is not there on the other.
 *
 * Both of them set a single `toolsRemembered` flag, and every sentence that flag drew names the
 * browser as the cause: «este navegador no nos deja guardar la preferencia», «la próxima vez que
 * entres estarán apagadas». When it was the *account* write that failed, both of those were false —
 * `localStorage` had just accepted the value, and the next visit would have the tools on. The editor
 * was telling the owner the one thing it exists not to tell them.
 *
 * Found on 6 October 2026 from direction's question «¿por qué aparece "No se recordará"?», which
 * the editor could not answer because it did not keep the difference.
 */
export type SwitchNotice = "none" | "browser" | "account";

/**
 * The browser's refusal outranks the account's, and that is not arbitrary: if this browser will not
 * keep the preference, «solo en este navegador» would be the opposite of true. When both fail the
 * owner needs to hear the one that costs them the next visit.
 */
export function switchNotice(browserRefused: boolean, accountRefused: boolean): SwitchNotice {
  if (browserRefused) return "browser";
  if (accountRefused) return "account";
  return "none";
}

export function designToolsFor(stored: boolean, viewportWidth: number): boolean | undefined {
  if (viewportWidth < MIN_STUDIO_WIDTH) return undefined;
  return stored;
}
