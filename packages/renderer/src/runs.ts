import { MARKS, type Mark, type MarkRun } from "@retorika/schema";
import { element, inlineElement, type RenderNode } from "./nodes.ts";

/**
 * A text with its marked runs, as nodes (ADR 0024, ADR 0027).
 *
 * **The split happens here, in the node tree, and not in the HTML string** — which is what makes
 * this the safe version of the thing ADR 0024 called «the delicate part»:
 *
 * > «Today the guarantee against `fixtures/documents/xss-attempt` is one `escapeHtml` over the
 * > whole string. With runs, the string is **split, each piece escaped separately**, and only the
 * > marked pieces wrapped.»
 *
 * Both halves of that are true here, and neither is new code. The string is split into several
 * children, and `nodeToHtml` has escaped **every string child, separately,** since sprint 1. So the
 * escaping rule is not extended, re-implemented or special-cased for marks: a piece of a marked
 * text takes the identical path a whole unmarked text already took. `xss-attempt` stays green
 * without being touched because nothing about how it is escaped has changed.
 *
 * The tag names are fixed by ADR 0024 — `strong` and `em`, the two that mean emphasis rather than
 * decoration and that a screen reader conveys — and never come from the document.
 */
const TAG: Record<Mark, string> = { strong: "strong", em: "em" };

interface Segment {
  from: number;
  to: number;
  /** In `MARKS` declaration order, which is the nesting order. */
  marks: Mark[];
}

/**
 * The text cut at every boundary of every mark, each piece labelled with what covers it.
 *
 * Every boundary of **every** mark, because ADR 0027 §1 lets two different marks overlap partially:
 * `strong` over `[0,12)` and `em` over `[10,19)` have three distinct regions and no two of them
 * carry the same set.
 */
function segmentsOf(text: string, marks: readonly MarkRun[]): Segment[] {
  const cuts = new Set<number>([0, text.length]);
  for (const run of marks) {
    cuts.add(run.from);
    cuts.add(run.to);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i] ?? 0;
    const to = points[i + 1] ?? 0;
    if (from >= to) continue;
    segments.push({
      from,
      to,
      // Filtered from MARKS rather than from the document, so the nesting order is this file's and
      // not the order somebody happened to apply them in. Two documents with the same marks publish
      // the same bytes, which is what INV_5 and the golden corpus rest on (ADR 0027 §5).
      marks: MARKS.filter((mark) =>
        marks.some((run) => run.mark === mark && run.from <= from && run.to >= to),
      ),
    });
  }
  return segments;
}

/** `strong` outside, `em` inside, always. The choice is arbitrary; having one is not. */
function wrap(text: string, marks: readonly Mark[]): RenderNode | string {
  let node: RenderNode | string = text;
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const mark = marks[i];
    if (mark === undefined) continue;
    node = inlineElement(TAG[mark], {}, [node]);
  }
  return node;
}

/**
 * The children a text element gets: one string when it carries no marks, and a mixed list when it
 * does.
 *
 * **One string is the whole of the no-marks case, and it is load-bearing.** A document without
 * marks produces the identical child it produced before this file existed, so it serialises to the
 * identical bytes and the golden corpus does not move. That is what makes marks additive rather
 * than a rewrite of every published page.
 *
 * Consecutive pieces carrying the same marks are joined back into one, so the ordinary case —
 * one bold phrase in a sentence — comes out as `Solomillo <strong>al whisky</strong>` rather than
 * as a run of adjacent tags. Where two marks only partly overlap the pieces genuinely differ and
 * each gets its own wrapper; that is more verbose than a human would write by hand, and it is
 * unambiguous, deterministic and correct, which matters more here.
 */
export function textChildren(
  text: string,
  marks: readonly MarkRun[] | undefined,
): (RenderNode | string)[] {
  if (marks === undefined || marks.length === 0) return [text];

  const segments = segmentsOf(text, marks);
  const children: (RenderNode | string)[] = [];

  let index = 0;
  while (index < segments.length) {
    const current = segments[index];
    if (current === undefined) break;
    const key = current.marks.join("|");
    let last = index;
    while (last + 1 < segments.length && (segments[last + 1]?.marks.join("|") ?? "") === key) {
      last += 1;
    }
    const piece = text.slice(current.from, segments[last]?.to ?? current.to);
    children.push(current.marks.length === 0 ? piece : wrap(piece, current.marks));
    index = last + 1;
  }

  return children;
}

/**
 * A text element, inline when it carries marks and exactly as before when it does not.
 *
 * The `inlineChildren` flag is set from whether a mark actually produced a node, not from whether
 * the document declared a `marks` key: an empty list and an absent one have to publish the same
 * bytes, and anything else would make the output depend on how the editor happened to clean up.
 */
export function textElement(
  tag: string,
  attributes: Record<string, string>,
  text: string,
  marks: readonly MarkRun[] | undefined,
): RenderNode {
  const children = textChildren(text, marks);
  const marked = children.some((child) => typeof child !== "string");
  return marked ? inlineElement(tag, attributes, children) : element(tag, attributes, children);
}
