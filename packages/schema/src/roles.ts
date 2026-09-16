import { z } from "zod";

/**
 * Rule 2: every element carries a role from a closed vocabulary, so the simple view
 * can build its form by walking roles and always knows how to offer "change the
 * title", wherever the element sits.
 *
 * Closed means closed *for this schema version* (ADR 0004). Adding a role is
 * backward-compatible and bumps the minor version; removing or renaming one breaks
 * and bumps the major. Because growing is cheap and shrinking is not, the list stays
 * small and grows when a real section demands it.
 */
export const ROLES = [
  "heading",
  "subheading",
  "body",
  "image",
  "embed",
  "button",
  "link",
  "field",
  "map",
  "list",
] as const;

export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/**
 * `list` is the container, not a peer of the others: it holds elements rather than a
 * value. Kept separate so code that walks leaf content does not have to special-case
 * a name.
 */
export const CONTAINER_ROLE = "list" satisfies Role;

export function isContainerRole(role: Role): role is typeof CONTAINER_ROLE {
  return role === CONTAINER_ROLE;
}

/**
 * The opaque block: custom code, third-party widgets, embedded video. The simple view
 * shows it labelled and not editable there, template extraction strips it, and the
 * renderer refuses to emit its payload unless embeds are explicitly enabled.
 */
export const OPAQUE_ROLE = "embed" satisfies Role;
