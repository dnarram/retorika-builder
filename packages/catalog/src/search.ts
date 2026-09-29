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
  services: ["qué hago", "servicios", "productos", "tarjetas", "lo que ofrezco", "carta"],
  prices: ["precios", "tarifas", "carta", "menú", "platos", "lista de precios", "cuánto cuesta"],
  gallery: [
    "fotos de trabajos",
    "galería",
    "fotos",
    "imágenes",
    "antes y después",
    "platos",
    "platos estrella",
    "escaparate",
  ],
  location: [
    "horario",
    "ubicación",
    "dónde estamos",
    "dirección",
    "mapa",
    "cómo llegar",
    "abierto",
  ],
  testimonials: [
    "opiniones",
    "reseñas",
    "testimonios",
    "valoraciones",
    "qué dicen",
    "clientes",
    "estrellas",
  ],
  team: [
    "equipo",
    "quién soy",
    "quiénes somos",
    "sobre nosotros",
    "nuestro equipo",
    "el personal",
    "trabajadores",
  ],
  contact: ["contacto", "reservas", "teléfono", "whatsapp", "pedir cita", "escribir", "llamar"],
  footer: [
    "pie de página",
    "pie",
    "aviso legal",
    "datos del titular",
    "nif",
    "cif",
    "abajo",
    "copyright",
  ],
};

/**
 * Words more than one section answers to, and which of them answers first.
 *
 * The first entry is the reason this table exists: **«carta»**. `services` has claimed it
 * since sprint 1, because a restaurant listing its dishes without prices really is a "Qué hago" —
 * and from sprint 4 a carta is also, and more precisely, a `prices`. Both are right, so the
 * question is not which keeps the word but which comes first.
 *
 * `prices` comes first because it is the one that has a price on every line, and both owners who
 * asked for «la carta» were asking for the thing with prices on it. `services` stays in the list
 * behind it rather than losing the word: an owner who wants dishes with no prices should still
 * find the section that does that, and dropping the alias would make «carta» stop finding the
 * only section that has served it until today.
 *
 * **«platos»** is the second, and it comes from one sentence: «le falta una sección para mostrar los
 * platos estrella **o** poner la carta del restaurante» (Taberna, 25 Sep). The «o» is doing real
 * work — those are two sections, `gallery` and `prices`, and an owner typing «platos» might want
 * either. `prices` comes first because the other owner's phrasing pairs the word with a list: «una
 * sección para mostrar mis platos, **la carta**, etc.» (Conchi, 27 Sep). Someone who means the
 * photographs is more likely to type «platos estrella», which only `gallery` claims exactly.
 *
 * Declared rather than derived, because there is nothing in the data to derive it from — every
 * section here matches its word exactly, and which one an owner meant is a product judgement. For
 * «platos» that is true even though the catalog's own order happens to give the same answer today:
 * that coincidence is what this table exists to stop depending on, since `CATALOG`'s order is the
 * order the "Añadir sección aquí" menu reads in, and reordering a menu must not silently reorder
 * search results.
 */
export const SHARED_ALIASES: Readonly<Record<string, readonly string[]>> = {
  carta: ["prices", "services"],
  platos: ["prices", "gallery"],
};

/** Lower case, unaccented, trimmed — so «Menú» and «menu» are the same query. */
function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * The sections a typed query finds, best first.
 *
 * The concept dossier §9 asks for exactly this — «El buscador del catálogo entiende lo que el
 * usuario escribiría de verdad: si busca "hero" encuentra Portada» — and it is also how this
 * catalog answers a word an owner uses that is not a section's name. A restaurant owner types
 * «carta»; the section is called «Precios»; the search is what joins them, rather than the
 * section being renamed for one sector.
 *
 * Ranking, in order: a section whose alias is exactly the query, then one where the query is
 * contained in an alias or the alias in the query. Within the first rank, `SHARED_ALIASES`
 * decides; otherwise the catalog's own order does, which keeps the result stable.
 */
export function sectionsMatching(query: string): readonly string[] {
  const wanted = normalise(query);
  if (wanted === "") return [];

  const exact: string[] = [];
  const partial: string[] = [];
  for (const [catalogId, aliases] of Object.entries(SEARCH_ALIASES)) {
    const normalised = aliases.map(normalise);
    if (normalised.includes(wanted)) exact.push(catalogId);
    else if (normalised.some((alias) => alias.includes(wanted) || wanted.includes(alias))) {
      partial.push(catalogId);
    }
  }

  const order = SHARED_ALIASES[wanted];
  if (order) {
    exact.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
    });
  }

  return [...exact, ...partial];
}
