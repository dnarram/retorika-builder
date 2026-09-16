/**
 * What the user would actually type.
 *
 * The concept dossier §9 asks for a catalog search that "entiende lo que el usuario
 * escribiría de verdad: si busca «hero» encuentra Portada". So the aliases carry both
 * the designer vocabulary the dossier wants to keep off the screen and the plain words
 * a shop owner would use.
 */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  cover: ["portada", "hero", "cabecera", "inicio", "principal", "arriba", "banner"],
};
