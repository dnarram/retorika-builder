import type { Client } from "../auth/clients.ts";

/**
 * The design-tools switch, in the account — which is where the dossier always put it.
 *
 * The advanced dossier: «Un interruptor **en su cuenta**, del mismo rango que el idioma de la
 * interfaz», and depth is «por cuenta y por sección, nunca por sitio».
 *
 * **ADR 0025 predicted this and got it half right, which is worth writing down.** It said, of
 * `editor/designTools.ts`: «When accounts arrive, that module is the one file that moves.» It did
 * not move. It gained a sibling — this one — because the prediction assumed accounts would replace
 * `localStorage`, and ADR 0034 §2 kept the anonymous journey instead. Somebody who never signs in
 * still gets a switch that remembers, so **both paths have to exist**: the account when there is
 * one, this browser when there is not.
 *
 * Everything `editor/designTools.ts` refuses still holds here. This is not a field of the
 * document, it is not part of the saved session, and flipping it reaches no document — the Wix trap
 * the dossier §4 names («Si encender las herramientas escribe algo en el proyecto, hemos
 * reconstruido el problema de Wix») is avoided for the same reason as before: the switch is a
 * property of the person.
 */

/**
 * The stored preference, or `null` when it could not be read at all.
 *
 * `null` and `false` are different answers and the caller needs both: `false` is «this person has
 * the tools off», `null` is «we could not ask», and only the second should fall back to whatever
 * this browser remembers. Collapsing them would silently overwrite an account preference with a
 * browser one the first time the network hiccupped.
 */
export async function loadAccountDesignTools(
  client: Client,
  userId: string,
): Promise<boolean | null> {
  const { data, error } = await client
    .from("accounts")
    .select("design_tools")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.design_tools === true;
}

/** `false` when the write did not land, so the editor's «no lo recordamos» notice stays honest. */
export async function saveAccountDesignTools(
  client: Client,
  userId: string,
  on: boolean,
): Promise<boolean> {
  const { error } = await client.from("accounts").update({ design_tools: on }).eq("id", userId);
  return !error;
}
