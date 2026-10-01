# 0027 — A mark moves with the text under it, and two of the same kind become one

**Status:** accepted · **Date:** 2026-10-01 · **Accepted by:** David, **not direction** ·
**Touches:** [ADR 0024](0024-formatting-inside-a-text-is-designed-and-waiting.md) (which it
**amends**), [#52](https://github.com/dnarram/retorika-builder/issues/52), document rule 6

> **«Accepted» here means David read it and accepted it, the same as
> [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md).** It is said in the
> header rather than left to be inferred, because an accepted ADR gets cited afterwards and nobody
> should be able to read this as «direction agreed». Direction has not looked at it.
>
> **Accepted with one correction, which he found and which was a real error rather than a wording
> one**: §1's merging example did not merge. See the note in that section — the rule is unchanged,
> the example was wrong, and the case it got wrong is now a required test.

> **This answers the one question ADR 0024 left open on purpose, and fixes one thing that ADR said
> which cannot be built as written.** It decides nothing about whether formatting happens — that was
> decided on 1 October 2026 — and nothing about which marks exist, which stays `strong` and `em`.

## Context

ADR 0024 settled the design of formatting and named, in advance, the single thing it had not
settled:

> «**Editing the text under a mark is the open question the implementation has to answer**, and it
> is named here so it is not discovered on the day: a run whose text changes beneath it either
> **moves, shrinks or dies**, and which of those it does is a **product decision**, not an
> implementation detail.»

It is a product decision because the answer is something a person feels rather than something a
test can derive. Put the cursor just after a word in bold, type, and whether what you type comes
out bold is not a matter of correctness — it is a matter of whether the editor behaves the way your
hands already expect.

### And one sentence of ADR 0024 cannot be built as written

The same ADR asks the schema to refuse a run that can «point outside its text, **overlap another**,
or arrive unsorted».

**Read literally, "overlap another" makes bold *and* italic on the same words impossible** — and
that is precisely what the third owner asked for, because he named both:

> cursiva, negrita, subrayado, tamaño exacto, fuente de letra, color exacto, y más libertad en la
> posición — `docs/sessions/2026-09-30-taller.md`

Two words that are bold and italic at once is an ordinary request. A rule that forbids it would
ship a feature that cannot do the thing the person who asked for it named first.

## Decision

### 1. Two marks of **different** kinds may cover the same text; two of the **same** kind merge

ADR 0024's «overlap another» is **amended to «overlap another of the same kind»**:

- **`strong` and `em` may cover the same range, or any two overlapping ranges.** The renderer draws
  it by splitting the string at every boundary of every mark and nesting, which is one more turn of
  the same partition it already has to do.
- **Two runs of the same mark that touch or overlap become one.**

**The invariant, and it is validated in the schema** the way every other document rule is:

> **No two runs of the same `mark` touch or cross.**

### Touching means touching, and a space is not nothing

In `Solomillo al whisky` — nineteen code units — the offsets are exactly these:

| Range | Text |
|---|---|
| `[0,9)` | `Solomillo` |
| `[9,10)` | a single space |
| `[10,19)` | `al whisky` |

- **`[0,10)` + `[10,19)` merge** into `[0,19)`. They touch at 10: the first run took the space.
- **`[0,12)` + `[10,19)` merge** into `[0,19)`. They overlap.
- **`[0,9)` + `[10,19)` do *not* merge.** The space at `[9,10)` is unmarked, so they do not touch,
  and the document keeps **two** runs.

**Two runs of the same mark separated by any unmarked text — one space included — are two runs and
stay two runs.** They are not an untidy spelling of one run: `<strong>Solomillo</strong>
<strong>al whisky</strong>` and `<strong>Solomillo al whisky</strong>` publish different bytes,
and they mean different things, because in one of them the space is bold and in the other it is
not. Merging them would be changing the owner's document rather than normalising it.

> **This paragraph exists because the first version of this ADR got it wrong.** It illustrated
> merging with «mark Solomillo, then mark al whisky», which is `[0,9)` and `[10,19)` — the one case
> on this list that does **not** merge. The rule was right and the example demonstrated its
> opposite. Caught by David on review, before any schema was written. **`applyMark`'s tests must
> cover it**: marking those two ranges in either order leaves two runs, and nothing in the merge
> may close the gap.

Three reasons it is merging rather than permissiveness, and the third is the one that would have
bitten later:

- **One meaning, one document.** `[0,10) strong` + `[10,19) strong` and `[0,19) strong` render
  identically. Two serialisations of one meaning is the thing `INV_5` exists to prevent, and it is
  how a golden corpus starts depending on which word somebody marked first.
- **Ordering becomes total.** With no two same-mark runs touching, sorting by `from` and then by the
  mark's declaration order puts any legal set of marks in exactly one sequence.
- **It makes `removeMark` meaningful.** Unbolding a word in the middle of a bold phrase has to
  split one run into two with a hole between them. If touching runs were legal, the result would be
  indistinguishable from a document where nothing was removed.

### 2. Offsets are UTF-16 code units, which is what both ends of the product already count in

A run is `{ from, to, mark }`, where `from` and `to` index `text` in **UTF-16 code units** — the
units `String.prototype.slice` takes and the units a DOM `Range` offset reports inside a text node.

This is a decision and not a detail, because it is the one place the editor and the renderer could
silently disagree. The editor reads the selection from the `iframe` and the renderer slices the
string; if one counted code points and the other code units, a mark would drift the first time
somebody bolded a word after an emoji and nothing would fail until a client's site was already
published. **The same units at both ends, with no conversion anywhere**, is what makes that
impossible rather than unlikely.

A combining accent is two code units and a letter with a precomposed accent is one; both are
correct, both round-trip, and neither is normalised. Normalising would change the owner's text,
which no part of this product is allowed to do.

### 2b. A boundary may not cut a surrogate pair in half

> **Added 1 October 2026, while building §2, and it is a rule this ADR did not foresee.** Written
> here rather than left as an implementation detail because it is a refusal — a document can say
> something the product will not accept — and every other such refusal is in this file.

An emoji is **two** code units, and §2 says offsets are code units. A boundary between the two
breaks nothing in JavaScript: `a + b` is still the original string. **The renderer does not put the
pieces back together.** It escapes each one, wraps some of them in tags, and the file is written as
UTF-8 — by which point each half is a lone surrogate, UTF-8 cannot encode one, and `Café 🍷 tinto`
publishes as `Café �� tinto`.

Measured, not supposed, and the measurement is a test.

**So the schema refuses it**, in the same place it refuses a run that reaches past the end of its
text. A browser will not put a caret inside a pair, so the editor cannot produce one; a hand-written
or generated document can, and «no current caller does that» is the argument every corruption is
eventually found behind — the same sentence `cssAttributeValue` was written on.

### 3. The convention is the word processor's, because everyone already has it in their hands

| What the person does | What happens to the mark |
|---|---|
| Types **inside** the run | **It grows** — the new text is marked |
| Types **right at the end** of it | **It continues** — the new text is marked |
| Types **right at the start** of it | **It does not** — the new text is outside |
| **Deletes part** of it | **It shrinks** |
| **Deletes all** of it | **It disappears** |

The two middle rows look inconsistent and are the whole point: it is what lets you write in front
of a bold word without inheriting the bold, and keep writing after one without losing it. Nothing
here is invented — it is what Word, Pages and Google Docs all do, and the reason to copy it is that
the owner's fingers learned it somewhere else.

**Pasting is typing**, at the place it is pasted, with the length of what was pasted.

### 4. The five rows are **one** rule, and that is what gets implemented

They are not five cases. For a pure insertion of `n` code units at offset `s`, every offset in
the document moves by one rule:

> **An offset strictly before `s` stays. An offset at `s` or after it moves by `n`.**

Apply it to both ends of a run and all three insertion rows fall out, including the asymmetry:

| Run, relative to `s` | `from` | `to` | Row |
|---|---|---|---|
| `from < s < to` | unchanged (`< s`) | `+n` (`> s`) | **grows** |
| `to == s` | unchanged | `+n` (`== s`) | **continues** |
| `from == s` | `+n` (`== s`) | `+n` | **does not** |

**A deletion is the other half, and a replacement is the two composed.** For a removal of `[s, e)`,
an offset maps: `p <= s → p`; `p >= e → p - (e - s)`; anything inside → `s`. A run clipped to
nothing becomes empty and **an empty run is not stored** — which is the fifth row, falling out
rather than being special-cased.

**Replacing a selection is a deletion at `[s, e)` followed by an insertion at `s`**, in that order,
each using its own rule. That composition is what settles the two cases the table does not draw and
the code still has to answer:

- **Typing over a selection**: the deletion collapses everything in the range to `s`, then the
  insertion rule applies — so a run that ended where the selection began **extends over what was
  typed**, and a run that began there does not. Consistent with the table rather than a sixth rule.
- **An edit crossing the boundary of two runs**: each run is mapped independently, then empties are
  dropped, then same-mark neighbours merge. Two bold runs with a plain word between them become one
  run when that word is deleted — which is right, and is the merge of §1 doing the work.

**The order is fixed and the normal form is the output**: map every offset, drop the empty runs,
merge touching or overlapping runs of the same mark, sort by `from` and then by the mark's
declaration order. Two documents that mean the same thing come out byte-identical, which is what
the golden corpus needs.

> **Corrected 1 October 2026, by sprint 10 day 7's own walk.** §4 says where an offset lands once
> `s` is known; it does not say how `s` is found when the editor only has the text before and after
> an edit, which is `textEditBetween`'s job and which this ADR did not spell out as its own rule.
> The first version of that function scanned its common **prefix** before its common **suffix**,
> and that order could misplace `s` by one character — found live, typing a word right after a bold
> run that was itself followed by a space.
>
> A common prefix and a common suffix can **overlap**: the run of matching characters right before
> an edit and the run right after it can share a character when what was typed repeats what is
> already adjacent to it, which a space is extremely often. In `"beber y…" → "beber casero y…"`,
> the typed text starts with a space and the next original character already was one, so a prefix
> scanned from the start walks straight through it and reports the edit one position later than
> where it happened — past the bold run's own `to`, which is exactly the boundary «al final
> continúa» depends on. The run stopped extending, silently, on the one case the rule exists for.
>
> **The fix is to scan the suffix first** and let the prefix take only what is left over. For an
> insertion this never lands `s` *later* than the true boundary — the direction that breaks the
> rule — it can only land it earlier or exact, which keeps «at it or after moves» true. The function
> itself carries the full reasoning; this note exists so the next reader of §4 does not assume the
> offset `s` it describes was ever unambiguous to find.

Where two different marks cover the same text, **`<strong>` is the outer element and `<em>` the
inner**. The choice is arbitrary; having one is not. Without a fixed order, two documents with the
same marks in a different array order would publish different bytes, and `INV_5` and the golden
corpus both depend on them not doing that.

### 6. The schema accepts marks on **any** text value, and the editor offers them on some

A mark is a property of a text value, not of a role — ADR 0024 is explicit that «a `strong` run
inside a body text is still a body text» and that ADR 0004's closed vocabulary is untouched.

**So the schema does not restrict marks by role, and the renderer splits every text value the same
way.** The alternative — forbidding marks on a button's label — would make the renderer's split
conditional on the role, which means two paths through the one piece of code in this product that
escapes a string in pieces. **One path is the safety argument**, and it is the reason this is
decided here rather than left to the day.

**The editor draws `B` and `I` only for a heading, a subheading or a body text**, and not for a
button or a link, for the reason the toolbar already applies to everything else: a control that
does not apply is not drawn. That is an interface choice, reversible, and it is not this rule.

## What this refuses

- **A third mark.** ADR 0024 closed the list at `strong` and `em`, and refused underline for good.
  Nothing here reopens it.
- **A mark with no text under it.** `from === to` does not parse. A mark over nothing is not a mark,
  and storing one would be a second way to write a document that renders identically to one without
  it.
- **Marks that survive their text being replaced wholesale.** Confirming an edit that replaces the
  entire string leaves no marks, because every run clipped to nothing is dropped. There is no
  "remember the formatting" behaviour, and inventing one would mean guessing where the marks go.
- **Normalising the owner's text** to make offsets tidier.
- **A second serialisation.** ADR 0024: «No `execCommand`, no editable HTML, no second
  serialisation format.» The field stays `{ kind: "text", text: string }`
  (`packages/schema/src/document.ts:33`) with an optional sibling list.

## Consequences

- **`packages/schema` gains the field, the invariant and three verbs** — `applyMark`, `removeMark`
  and `shiftMarks` — plus migration `0004` to `1.3.0`. Exclusive zone, sprint 10 day 3.
- **`shiftMarks` is a pure function over a string and a list of offsets**, so the table in §3 is
  testable row by row with no browser, and §4 means the implementation is one offset map rather
  than a branch per row. There is no excuse for it to be under-tested.
- **`applyMark` is tested on both sides of «touching»**, which is the distinction this ADR got wrong
  the first time: `[0,10)` then `[10,19)` must give one run; `[0,9)` then `[10,19)` must give two,
  in either order, with the gap left open.
- **The renderer splits at every boundary of every mark**, escapes each piece separately, and wraps.
  `fixtures/documents/xss-attempt` must stay green **without being touched**; if it has to be
  edited, the change is wrong.

  > **Built 1 October 2026, and the delicate part was not where this ADR expected.** The split
  > happens in the **node tree**, not in the HTML string — and `nodeToHtml` has escaped every string
  > child separately since sprint 1, so «each piece escaped separately» needed no new escaping rule
  > at all. A piece of a marked text takes the identical path a whole unmarked text already took.
  >
  > **What did need deciding was whitespace.** The html target pretty-prints: each child on its own
  > line, indented. Harmless for one string child, and it **corrupts the words** with several —
  > measured in Chromium, a `<p>` holding `"Solo"`, `<strong>millo</strong>` and `" al whisky"`
  > renders as «**Solo millo** al whisky», from a newline the document does not contain. So a node
  > holding marks is marked `inlineChildren` and its contents are laid end to end. A text with no
  > marks has one string child, does not set it, and publishes the bytes it published before.
- **A document with no marks publishes the same bytes it publishes today**, which keeps the golden
  corpus still and makes the whole change additive.
- **`arbitraryDocument` generates marks**, so `INV_3A` and `INV_3B` cover them from the first day
  rather than from the sprint that remembers.
- **ADR 0024 is amended in one clause and otherwise stands.** Its design, its refusal of underline,
  its granularity and its "not a rich-text editor" argument are all unchanged.

## What would reopen this

- **Somebody wants a mark to survive a wholesale replacement** — pasting a rewritten sentence over
  a formatted one and expecting the bold to land in the same places. It cannot be done without
  guessing, and a guess that is wrong is worse than nothing, but it is the obvious pressure.
- **A third mark arrives with a reason.** The nesting order of §5 is a list of two; a third makes it
  a list that has to be justified rather than declared.
- **The merge turns out to lose something an owner wanted kept.** Two adjacent bold runs are
  indistinguishable once published, so there is nothing to lose today. A future mark that carries a
  value — a colour on a run, say — would break that, and then merging two runs would be merging two
  different things.
