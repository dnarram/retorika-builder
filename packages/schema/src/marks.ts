import { z } from "zod";
import type { ContentElement, RetorikaDocument } from "./document.ts";
import type { ElementAddress } from "./fields.ts";

/**
 * Marked runs inside a text, as data and as verbs (ADR 0027, amending ADR 0024).
 *
 * **The field stays a plain string.** A mark is a pair of offsets beside the text, never markup
 * inside it: ADR 0024's «no `execCommand`, no editable HTML, no second serialisation format» is
 * what this shape exists to keep true. The renderer splits the string at these offsets and escapes
 * each piece separately; nothing here produces HTML.
 */

/**
 * The two, and no third.
 *
 * ADR 0024 closed the list: `strong` and `em` are the ones that mean emphasis rather than
 * decoration and that a screen reader conveys. **Underline is refused for good** — on the web an
 * underline means a link, and two owners out of three have now asked for it without the answer
 * moving.
 *
 * The declaration order is also the sort order of the normal form and the nesting order of the
 * renderer, so it is load-bearing rather than alphabetical: see `compareRuns` and ADR 0027 §5.
 */
export const MARKS = ["strong", "em"] as const;
export type Mark = (typeof MARKS)[number];
export const markSchema = z.enum(MARKS);

/**
 * `from` and `to` index the text in **UTF-16 code units** — the units `String.prototype.slice`
 * takes and the units a DOM `Range` reports inside a text node (ADR 0027 §2).
 *
 * The same units at both ends with no conversion anywhere is the decision, not the default. If the
 * editor counted code points and the renderer counted units, a mark would drift the first time
 * somebody bolded a word after an emoji, and nothing would fail until a client's site was already
 * published.
 */
export const markRunSchema = z.strictObject({
  from: z.number().int().nonnegative(),
  to: z.number().int().positive(),
  mark: markSchema,
});
export type MarkRun = z.infer<typeof markRunSchema>;

/** A half-open range of the text, in the same units. */
export interface MarkRange {
  from: number;
  to: number;
}

/**
 * An edit as a replacement: the half-open range that went, and how many code units arrived in its
 * place. A pure insertion is `from === to`; a pure deletion is `inserted === 0`.
 *
 * One shape rather than separate insert and delete operations, because ADR 0027 §4 defines a
 * replacement as a deletion followed by an insertion at the same point — and that composition is
 * what settles typing over a selection without a sixth rule.
 */
export interface TextEdit {
  from: number;
  to: number;
  inserted: number;
}

function markIndex(mark: Mark): number {
  return MARKS.indexOf(mark);
}

/**
 * The normal form's order: by `from`, then by the mark's declaration order.
 *
 * Two runs cannot share both, so this is total rather than merely consistent — two runs of the
 * same mark with the same `from` would overlap, and overlapping runs of one mark do not survive
 * `normaliseMarks`. A total order is what makes two documents that mean the same thing serialise
 * to the same bytes, which `INV_5` and the golden corpus both rest on.
 */
function compareRuns(a: MarkRun, b: MarkRun): number {
  return a.from - b.from || markIndex(a.mark) - markIndex(b.mark);
}

/**
 * The normal form: empties dropped, same-mark neighbours merged, sorted.
 *
 * **Touching means touching, and a space is not nothing.** In `Solomillo al whisky`, `[0,10)` and
 * `[10,19)` merge because the first run took the space; `[0,9)` and `[10,19)` do **not**, because
 * `[9,10)` is unmarked between them. The second pair stays two runs and publishes different bytes
 * from one — in one of them the space is bold and in the other it is not, which is a difference in
 * what the document says rather than in how it was written down. ADR 0027 §1 records that the first
 * draft of that ADR illustrated merging with the pair that does not merge.
 *
 * Runs of *different* marks are never merged and never compared: the whole point of the amendment
 * to ADR 0024 is that `strong` and `em` may cover the same words.
 */
export function normaliseMarks(marks: readonly MarkRun[]): MarkRun[] {
  const out: MarkRun[] = [];

  for (const mark of MARKS) {
    const ofKind = marks
      .filter((run) => run.mark === mark && run.from < run.to)
      .sort((a, b) => a.from - b.from || a.to - b.to);

    let open: MarkRange | undefined;
    for (const run of ofKind) {
      // `<=` rather than `<`: abutting runs merge, which is the invariant. A run starting *after*
      // the open one ends leaves a gap, however small, and a gap is two runs.
      if (open && run.from <= open.to) {
        open.to = Math.max(open.to, run.to);
        continue;
      }
      if (open) out.push({ ...open, mark });
      open = { from: run.from, to: run.to };
    }
    if (open) out.push({ ...open, mark });
  }

  return out.sort(compareRuns);
}

/** Whether these runs are already the normal form — what the schema checks, so a document that
 * parsed cannot need normalising before it is rendered. */
function isNormalised(marks: readonly MarkRun[]): boolean {
  const normalised = normaliseMarks(marks);
  if (normalised.length !== marks.length) return false;
  return normalised.every(
    (run, index) =>
      run.from === marks[index]?.from &&
      run.to === marks[index]?.to &&
      run.mark === marks[index]?.mark,
  );
}

/**
 * The list as it may appear in a document: in the normal form, and nothing else.
 *
 * Validated here rather than repaired on read, for the reason every other document rule is
 * validated in the schema: a document that parsed is one the renderer can emit without thinking.
 * The alternative — normalising on the way in — would mean the bytes a document produces depend on
 * which code path loaded it.
 */
export const marksSchema = z.array(markRunSchema).superRefine((marks, ctx) => {
  for (const run of marks) {
    if (run.from >= run.to) {
      ctx.addIssue({
        code: "custom",
        message: `A mark covers no text: [${run.from}, ${run.to}). A mark over nothing is not a mark.`,
      });
      return;
    }
  }
  if (!isNormalised(marks)) {
    ctx.addIssue({
      code: "custom",
      message:
        "Marks must be sorted by offset and then by mark, with no two runs of the same mark " +
        "touching or crossing. Two runs of one mark separated by unmarked text are fine; two " +
        "that abut are one run.",
    });
  }
});

/**
 * Whether this offset would cut a surrogate pair in half.
 *
 * **Found while implementing ADR 0027, which did not foresee it, and measured rather than
 * supposed.** Offsets are UTF-16 code units, and an emoji is two of them. A boundary between the
 * two does not break anything in JavaScript — `a + b` is still the original string — but the
 * renderer does not concatenate the pieces back: it escapes each one, wraps some of them in tags,
 * and the file is then written as UTF-8. Each half is a lone surrogate by then, UTF-8 cannot encode
 * one, and `Café 🍷 tinto` publishes as `Café �� tinto`.
 *
 * So it is refused here, where every other document rule is refused, rather than defended against
 * in the renderer. A browser will not put a caret inside a pair, so the editor cannot produce one;
 * a hand-written or generated document can, and «no current caller does that» is the argument every
 * corruption is eventually found behind.
 */
function splitsSurrogatePair(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/**
 * What is wrong with these marks against this text, or `undefined` when nothing is.
 *
 * The checks that need the text, and so cannot live in `marksSchema`. Exported because
 * `contentValueSchema` applies them to every value that carries a `text` field — **a plain text
 * and a link alike**. ADR 0027 §6: a mark is a property of the value, not of the role, so the
 * renderer splits every text the same way and there is exactly one path through the one piece of
 * this product that escapes a string in pieces. Forbidding marks on a button's label would buy a
 * second path through that code.
 *
 * A message rather than a boolean because both callers — the schema and the verbs — have to say
 * which run was wrong, and a refusal nobody can act on is a refusal that gets worked around.
 */
export function markTextIssue(
  text: string,
  marks: readonly MarkRun[] | undefined,
): string | undefined {
  for (const run of marks ?? []) {
    if (run.to > text.length) {
      return `a mark reaches [${run.from}, ${run.to}) past the end of a text of ${text.length} code units`;
    }
    for (const offset of [run.from, run.to]) {
      if (splitsSurrogatePair(text, offset)) {
        return `a mark boundary at ${offset} falls inside a surrogate pair, which would publish that character as two replacement marks`;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Moving marks when the text changes (ADR 0027 §§3-4)
// ---------------------------------------------------------------------------

/**
 * Where an offset lands after an edit. **This is the whole of ADR 0027 §3**, which is five rows to
 * read and one rule to implement.
 *
 * The deletion maps first — before the removed range stays, after it slides back, inside it
 * collapses to the start — and then the insertion applies at that same point, where the rule is:
 * **strictly before stays, at it or after moves.**
 *
 * That single asymmetry is what produces the two rows that look inconsistent and are the point. A
 * run whose `to` sits exactly at the insertion point grows over what was typed («al final
 * continúa»); a run whose `from` sits there is pushed along and does not («al principio no»). It is
 * what lets somebody write in front of a bold word without inheriting the bold, and keep writing
 * after one without losing it — which is what every word processor does and the reason to copy it
 * is that the owner learned it somewhere else.
 */
function mapOffset(offset: number, edit: TextEdit): number {
  const removed = edit.to - edit.from;
  const afterDeletion =
    offset <= edit.from ? offset : offset >= edit.to ? offset - removed : edit.from;
  return afterDeletion < edit.from ? afterDeletion : afterDeletion + edit.inserted;
}

/**
 * The marks after the text beneath them changed.
 *
 * A pure function over offsets: no document, no DOM, no string. The text is not a parameter because
 * the edit determines the mapping completely, and taking one would suggest this clamps to it — it
 * does not, and a caller handing in an edit that does not describe what happened to the string has
 * a bug this function cannot see.
 *
 * Mapping both ends can leave a run empty (its text was deleted), can leave two runs of one mark
 * abutting (the text between them went), and can leave them out of order. `normaliseMarks` answers
 * all three, which is why it runs here rather than being the caller's problem.
 */
export function shiftMarks(marks: readonly MarkRun[], edit: TextEdit): MarkRun[] {
  return normaliseMarks(
    marks.map((run) => ({
      ...run,
      from: mapOffset(run.from, edit),
      to: mapOffset(run.to, edit),
    })),
  );
}

/**
 * The edit that turns `before` into `after`, as the shortest replacement that explains it.
 *
 * The editor confirms an element's text on `blur` and knows only the two strings, so something has
 * to turn them into offsets before `shiftMarks` can move anything. A common prefix and a common
 * suffix give the smallest range that differs, which is what makes typing one letter inside a bold
 * word grow that run rather than replace the whole string and lose every mark on it.
 *
 * It is a heuristic about *where* somebody typed, not a diff: `"ab" -> "ba"` is reported as the
 * whole string replaced, because nothing in two strings says a letter moved. That is the honest
 * answer and it degrades the way the owner would expect — the marks on text that did not change
 * survive, and the marks on text that did are gone.
 */
export function textEditBetween(before: string, after: string): TextEdit {
  let prefix = 0;
  const shortest = Math.min(before.length, after.length);
  while (prefix < shortest && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    from: prefix,
    to: before.length - suffix,
    inserted: after.length - suffix - prefix,
  };
}

// ---------------------------------------------------------------------------
// Applying and removing a mark (ADR 0027 §1)
// ---------------------------------------------------------------------------

/**
 * This mark over this range, merged into whatever was there.
 *
 * Merging happens by construction rather than by a later tidy-up, so marking the same words twice
 * cannot produce two runs and cannot change the document the second time.
 */
export function addRun(marks: readonly MarkRun[], range: MarkRange, mark: Mark): MarkRun[] {
  return normaliseMarks([...marks, { from: range.from, to: range.to, mark }]);
}

/**
 * This mark taken off this range, leaving whatever it covered elsewhere.
 *
 * Unmarking the middle of a run **splits it in two with a gap between them**, and that result is
 * only expressible because two runs of one mark are allowed to coexist as long as they do not
 * touch. It is the third reason ADR 0027 §1 gives for merging: if abutting runs were legal, the
 * split would be indistinguishable from having removed nothing.
 */
export function removeRun(marks: readonly MarkRun[], range: MarkRange, mark: Mark): MarkRun[] {
  const kept: MarkRun[] = [];
  for (const run of marks) {
    if (run.mark !== mark || run.to <= range.from || run.from >= range.to) {
      kept.push(run);
      continue;
    }
    if (run.from < range.from) kept.push({ from: run.from, to: range.from, mark });
    if (run.to > range.to) kept.push({ from: range.to, to: run.to, mark });
  }
  return normaliseMarks(kept);
}

// ---------------------------------------------------------------------------
// The document verbs
// ---------------------------------------------------------------------------

/** The text a value carries, when it carries one. A plain text and a link both do; an image's alt
 * and a map's label are not editable text in the canvas and are not marked. */
function textOf(element: ContentElement): string | undefined {
  const value = element.value;
  if (value?.kind === "text" || value?.kind === "link") return value.text;
  return undefined;
}

function withMarks(element: ContentElement, marks: MarkRun[]): ContentElement {
  const value = element.value;
  if (value?.kind !== "text" && value?.kind !== "link") return element;
  // Rebuilt without the key rather than set to undefined: `exactOptionalPropertyTypes` and the
  // strict schema both treat "absent" and "present and undefined" as different, and only the first
  // round-trips. The same reason `setElementStyle` drops an empty style.
  if (marks.length === 0) {
    const { marks: _dropped, ...rest } = value;
    return { ...element, value: rest };
  }
  return { ...element, value: { ...value, marks } };
}

function replaceById(
  elements: readonly ContentElement[],
  elementId: string,
  next: (element: ContentElement) => ContentElement,
): ContentElement[] | undefined {
  let found = false;
  const mapped = elements.map((element) => {
    if (element.id === elementId) {
      found = true;
      return next(element);
    }
    if (!element.items) return element;
    let changedItems = false;
    const items = element.items.map((item) => {
      const replaced = replaceById(item.elements, elementId, next);
      if (!replaced) return item;
      changedItems = true;
      return { ...item, elements: replaced };
    });
    if (!changedItems) return element;
    found = true;
    return { ...element, items };
  });
  return found ? mapped : undefined;
}

function editMarks(
  doc: RetorikaDocument,
  address: ElementAddress,
  verb: string,
  next: (marks: readonly MarkRun[], text: string) => MarkRun[],
): RetorikaDocument {
  let addressed = false;
  let changed = false;

  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== address.sectionId) return section;
      const content = replaceById(section.content, address.elementId, (element) => {
        const text = textOf(element);
        if (text === undefined) {
          throw new Error(
            `${verb}: element "${element.id}" carries no text to mark ` +
              `(its value is ${element.value?.kind ?? "absent"}).`,
          );
        }
        const current =
          element.value?.kind === "text" || element.value?.kind === "link"
            ? (element.value.marks ?? [])
            : [];
        const marks = next(current, text);
        if (JSON.stringify(marks) === JSON.stringify(current)) return element;
        changed = true;
        return withMarks(element, marks);
      });
      if (!content) return section;
      addressed = true;
      return { ...section, content };
    }),
  }));

  if (!addressed) {
    throw new Error(`${verb}: no element "${address.elementId}" in section "${address.sectionId}"`);
  }
  // The identical document back when nothing changed, so a control pressed twice opens one history
  // step and not two — the contract `setElementStyle` and `setPlacement` already keep.
  return changed ? { ...doc, pages } : doc;
}

function checkRange(verb: string, range: MarkRange, text: string, mark: Mark): void {
  if (!Number.isInteger(range.from) || !Number.isInteger(range.to)) {
    throw new Error(`${verb}: offsets must be whole numbers, got [${range.from}, ${range.to}).`);
  }
  if (range.from < 0 || range.to > text.length) {
    throw new Error(
      `${verb}: [${range.from}, ${range.to}) is outside a text of ${text.length} code units.`,
    );
  }
  // Refused at the verb as well as in the schema, so the failure names the control that caused it
  // rather than surfacing later as a document that will not parse.
  const issue = markTextIssue(text, [{ from: range.from, to: range.to, mark }]);
  if (issue) throw new Error(`${verb}: ${issue}.`);
}

/**
 * This mark over these characters of this element's text.
 *
 * An empty range is **not** an error and writes nothing: a selection that collapsed between the
 * person pressing the button and the editor reading it is an ordinary thing to happen, and the
 * document is unchanged either way. A range outside the text is a different matter and throws,
 * because it means the offsets came from somewhere that disagrees with the document.
 */
export function applyMark(
  doc: RetorikaDocument,
  address: ElementAddress,
  range: MarkRange,
  mark: Mark,
): RetorikaDocument {
  return editMarks(doc, address, "applyMark", (marks, text) => {
    checkRange("applyMark", range, text, mark);
    if (range.from >= range.to) return [...marks];
    return addRun(marks, range, mark);
  });
}

/** This mark taken off these characters, splitting a run in two where the range is inside one. */
export function removeMark(
  doc: RetorikaDocument,
  address: ElementAddress,
  range: MarkRange,
  mark: Mark,
): RetorikaDocument {
  return editMarks(doc, address, "removeMark", (marks, text) => {
    checkRange("removeMark", range, text, mark);
    if (range.from >= range.to) return [...marks];
    return removeRun(marks, range, mark);
  });
}

/** The marks this element carries — the reader beside the writers, so a toolbar can draw `B` as
 * pressed without walking the document itself. */
export function marksFor(doc: RetorikaDocument, address: ElementAddress): MarkRun[] | undefined {
  for (const page of doc.pages) {
    for (const section of page.sections) {
      if (section.id !== address.sectionId) continue;
      const element = findElement(section.content, address.elementId);
      if (!element) continue;
      const value = element.value;
      if (value?.kind === "text" || value?.kind === "link") return value.marks;
      return undefined;
    }
  }
  return undefined;
}

/** Whether this whole range already carries this mark, which is what decides between `applyMark`
 * and `removeMark` when somebody presses `B`. */
export function rangeHasMark(
  marks: readonly MarkRun[] | undefined,
  range: MarkRange,
  mark: Mark,
): boolean {
  if (range.from >= range.to) return false;
  return (marks ?? []).some(
    (run) => run.mark === mark && run.from <= range.from && run.to >= range.to,
  );
}

function findElement(
  elements: readonly ContentElement[],
  elementId: string,
): ContentElement | undefined {
  for (const element of elements) {
    if (element.id === elementId) return element;
    for (const item of element.items ?? []) {
      const inside = findElement(item.elements, elementId);
      if (inside) return inside;
    }
  }
  return undefined;
}
