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

/**
 * `false` when the write did not land, so the editor's «no lo recordamos» notice stays honest.
 *
 * **It asks for the row back.** `!error` alone was not enough: an `update` that matches no row is
 * answered by PostgREST with a 204 and no error, so while `public.accounts` had no rows — true in
 * production until migration `0002` — this reported the preference saved and it was not. The
 * switch then silently stopped following the person between machines while claiming to, which is
 * the precise thing the notice exists to never do.
 *
 * **It upserts rather than updates, and that is the fix for the failure it was detecting.**
 * Reported by direction on 6 October 2026 and reproduced exactly: signed in, with `public.accounts`
 * holding no row for that person, the editor said «Solo en este navegador» every time the switch
 * was pressed. The detection was right; the operation was wrong. «This person's preference is X» is
 * a statement about a row that ought to exist, so a missing one is something to create, not a
 * failure to report.
 *
 * The row is the trigger's to create (migration `0002`), and that is still where it belongs — the
 * deletion window, the purge sweep and the audit trail all need it, and none of them are reached
 * from here. **This does not replace the migration and is not an excuse to skip it.** It stops one
 * feature breaking when the row happens not to be there, which is a different thing from pretending
 * the row is unnecessary.
 *
 * Safe against the table's own shape: every other column is nullable or has a default, so an insert
 * of `id` and `design_tools` alone is exactly the row the trigger would have made. RLS still
 * decides — `accounts_insert_own` is `with check (id = auth.uid())`, so this can only ever create
 * the caller's own row.
 *
 * **And it does not contradict `createSite`'s rule, which is the next thing a reader will ask.**
 * `account/sites.ts` may only ever insert, because of direction's adjustment of 4 October: «una web
 * anónima nunca sobrescribe una de la cuenta», and the guarantee is that nothing there can replace
 * a row it did not create. A site is somebody's work and two of them can collide. This is the
 * caller's own preference row, addressed by primary key and fenced by `auth.uid()`: there is
 * nothing here to overwrite that is not already theirs.
 */
export async function saveAccountDesignTools(
  client: Client,
  userId: string,
  on: boolean,
): Promise<boolean> {
  const { data, error } = await client
    .from("accounts")
    .upsert({ id: userId, design_tools: on }, { onConflict: "id" })
    .select("design_tools");
  return !error && (data?.length ?? 0) > 0;
}
