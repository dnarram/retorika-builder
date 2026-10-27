/**
 * A document may carry the fonts its owner brought (ADR 0056): an optional `fonts` array of at most
 * two records, each the shape of a face that travels in the ZIP beside the page.
 *
 * **`up` seals and moves nothing.** The key is optional and absent on every document written before
 * today, so a 1.13.0 document is already a valid 1.14.0 one — the same shape as `0002`, `0006` and
 * `0008`. The affected set is counted rather than assumed: no corpus fixture below this version
 * carries a `fonts` key, and nothing could have written one. Counted 27 October 2026.
 *
 * **`down` is lossy and says so.** 1.13.0 has nowhere to keep a font record, so the key goes — and
 * with it, **the family goes out of every stack that names it first**. Leaving the name in place
 * would publish a stack whose first family nobody sends, which is the state ADR 0028 exists to
 * prevent and the one ADR 0032 §2 made unexpressible for 1.13.0 by refusing a typed family. What is
 * left is the fallback chain the stack already carried — the visitor who never received the face
 * reads exactly what they read before. A stack that is nothing but the family becomes its species'
 * generic keyword, written here as a table of its own rather than imported, so that this step
 * produces the same document in two years whatever the live table says then.
 */

const FONT_TOKENS = ["font.heading", "font.body"] as const;

/** The generic keyword each species falls back to, frozen at the version this step produces. */
const GENERIC: Readonly<Record<string, string>> = {
  sans: "sans-serif",
  serif: "serif",
  slab: "serif",
  display: "sans-serif",
};

interface OwnFontRecord {
  family?: unknown;
  kind?: unknown;
}

/** The first family of a stack, unquoted — the renderer's own reading, so a stack that selects an
 * own font here is exactly a stack that would have shipped it. */
function firstFamily(stack: string): string {
  const first = stack.split(",")[0] ?? "";
  return first.trim().replace(/^['"]|['"]$/g, "");
}

/** The stack with its first family removed, or the species' generic when nothing follows it. */
function withoutFirst(stack: string, kind: unknown): string {
  const comma = stack.indexOf(",");
  if (comma !== -1) {
    const tail = stack.slice(comma + 1).trim();
    if (tail !== "") return tail;
  }
  return GENERIC[typeof kind === "string" ? kind : ""] ?? "sans-serif";
}

const migration = {
  version: "1.14.0",
  description:
    "A document may carry the fonts its owner brought; they travel like a photograph (ADR 0056).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.14.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const { fonts, ...rest } = input;
    const records = Array.isArray(fonts) ? (fonts as OwnFontRecord[]) : [];
    const theme = rest["theme"] as Record<string, unknown> | undefined;
    if (records.length === 0 || !theme) return { ...rest, schemaVersion: "1.13.0" };

    const byFamily = new Map<string, unknown>();
    for (const record of records) {
      if (typeof record.family === "string") byFamily.set(record.family, record.kind);
    }
    const trimmed = { ...theme };
    for (const key of FONT_TOKENS) {
      const stack = trimmed[key];
      if (typeof stack !== "string") continue;
      const first = firstFamily(stack);
      if (byFamily.has(first)) trimmed[key] = withoutFirst(stack, byFamily.get(first));
    }
    return { ...rest, theme: trimmed, schemaVersion: "1.13.0" };
  },
} as const;

export default migration;
