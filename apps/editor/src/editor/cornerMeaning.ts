import type { Role } from "@retorika/schema";

/**
 * **What a corner of the chosen element's box scales** (ADR 0082, sprint 41 día 2).
 *
 * David's decision planning the sprint, in his own words: «La esquina de un texto escala la letra»,
 * «La esquina de la foto escala la foto (puede hacerla más pequeña o más grande). De igual modo
 * funciona la caja para los distintos elementos (estilo Canva)». So a side still stretches the box
 * — the gesture ADR 0050 día 4 built — and a corner scales **what is inside**: the letter of a
 * text, the photograph whole, and for the elements that have nothing of their own to scale, the
 * box on both axes, which is what the corner did until today.
 *
 * Decided by role rather than by tag, because the role is what the document knows (rule 2) and
 * what the catalog promises an element is; a tag is how the renderer happened to draw it.
 */
export type CornerMeaning = "letter" | "photo" | "box";

export function cornerMeaning(role: Role): CornerMeaning {
  switch (role) {
    case "heading":
    case "subheading":
    case "body":
    case "button":
    case "link":
    case "map":
      // Everything that is words: the pill of a button grows with its letter, since its padding is
      // the system's and its height is its line (`.rb-section [role=button]`); the map is a link.
      return "letter";
    case "image":
      return "photo";
    case "list":
    case "field":
    case "embed":
      // A list's cards fix their own letter (`.rb-item h3`, `.rb-item p`), so a letter on the list
      // would change nothing anyone can see; a field is the browser's; an embed is opaque. The box
      // on both axes is what the hand can honestly be given.
      return "box";
  }
}
