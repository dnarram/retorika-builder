# Theme values in `<style>` — a CSS-context guard instead of HTML escaping

> **Claude-only. Exclusive zone.** Every byte this task changes is emitted by `packages/renderer`
> into the client's published site, and the change replaces a security defence. Part 2 names
> the renderer for exactly that reason.
>
> Not delegated to OpenCode under any circumstances, however small the diff looks.

## Objective

Every theme value reaches the published CSS **exactly as written** — `'Times New Roman'` stays
`'Times New Roman'` — and **no value can close the `<style>` element or inject a rule**. A value
that could do either is refused with an explicit error. It is never altered, and it is never
emitted.

## Where it comes from

- **PR #6, finding 4**, the first of the four renderer fixes, in the agreed order 4, 2, 1, 3.
  The accessibility harness's font report showed Chromium drawing **Times** for the heading
  and the body of all three type pairs, even on macOS, where Georgia is installed.
- **The cause** is `packages/renderer/src/build.ts:131`:

  ```ts
  (key) => `  ${tokenToCssVariable(key)}: ${escapeHtml(doc.theme[key])};`,
  ```

  `<style>` is a raw-text element, and the HTML parser never decodes entities inside it.
  - `escapeHtml` turns `'Times New Roman'` into `&#39;Times New Roman&#39;`.
  - The browser reads that literally, the `font-family` declaration becomes invalid, and the
    browser falls back to its default serif.
  - Every site built from `packages/tokens` is affected: every type pair quotes at least one
    family name.
- **Why the golden corpus never saw it:** all five fixtures use unquoted stacks
  (`Georgia, serif`, `system-ui, sans-serif`). For those, `escapeHtml` is the identity. That
  is also why removing it leaves the existing goldens byte-identical.
- **The escaping is not decoration.** Today it is the only thing between a theme value and a
  literal `</style>` in the page. Removing it without a replacement would trade a visual bug
  for an injection. This task swaps one defence for the right one; it never removes a defence.
- CLAUDE.md, Style: "Explicit errors, never silent fallbacks." A value that cannot be emitted
  safely throws; it is not "cleaned".
- ADR 0001: the published site depends on no network. A theme value must not be able to make
  the page fetch anything, so `url(` cannot get through, and nor can any other function.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/renderer/src/escape.ts               (the new CSS-context guard, beside the other two)
packages/renderer/src/build.ts                (line 131 only: use the guard instead of escapeHtml)
packages/renderer/test/escaping.test.ts       (the tests of step 3)
fixtures/documents/tokens-quoted-fonts.json   (create: the new golden fixture)
fixtures/golden/tokens-quoted-fonts.html      (create: generated with -u, then read)
```

No change to `packages/schema`, to `packages/tokens`, to any existing fixture or golden file, or
to `packages/renderer/src/index.ts`. The guard is internal to the renderer.

## Invariants it touches

**`INV_5` — "Publishing produces identical output with tools on or off".** The guard is a pure
function of the value: no clock, no randomness. The five existing golden files must stay
**byte-identical**, and the new one must come out identical across runs.

**`INV_1`, `INV_2`, `INV_3A`, `INV_3B`: not exercised by the guard, and the task must not claim
otherwise.**
- The generated documents behind INV_1, INV_3A and INV_3B take their theme from `arbitraryTheme`
  (`packages/schema/src/testing.ts`). Its values are `${key}-${suffix}` with an **arbitrary**
  suffix (`fc.string({ minLength: 1, maxLength: 8 })`), so they can contain `;`, `<`, quotes or
  any Unicode. They are not identifiers.
- **No test renders a generated document.** Those invariants call `listEditableFields`,
  `escalate` and `applyRevert`, never `render(…, "html")`. Everything that does render comes
  from the golden corpus or is derived from it, and the `"dom"` target does not build CSS.
- So the invariants say **nothing** about which values the guard accepts. They stay in the
  definition of done as a **regression check**: exit 0, reported by canonical name.
- What the guard must accept is checked directly, with literals (step 3). That includes values
  of identifier shape such as `color.primary-abc`, which are not real CSS colours but are safe in
  context. This is the reason the guard checks context rather than meaning (see "Stop and ask",
  1).

**If an invariant test goes red anyway, stop.** Bring the value and the grammar rule that refused
it. Do not widen the grammar to let it through, and do not touch the generator, which lives in
`packages/schema`.

## Steps

### 1. `src/escape.ts` — a third defence, for a third context

This file's header already explains that it holds two distinct defences for two distinct
contexts: HTML text and attributes (`escapeHtml`), and executable URL schemes (`safeUrl`). Add
the third, and extend the header to say so. **The CSS context cannot be escaped into safety, only
validated**, because an HTML entity means nothing inside `<style>`.

```ts
/**
 * A theme value as it may appear in a CSS custom property inside <style>, returned
 * unchanged, or an error naming the key and the value.
 *
 * Never escapes and never cleans: a value is either safe to emit verbatim or refused.
 */
export function cssThemeValue(key: string, value: string): string;
```

**The grammar is an allowlist. It is decided, so do not improvise.** It rests on one character
set, the **safe set**:

- `A–Z a–z 0–9`, space, `#`, `.`, `,`, `-`, `%`, `_`;
- **space means U+0020 and nothing else.** Not `\s`: a tab, a newline, U+00A0 (no-break space)
  and every other Unicode space are outside the safe set.

A value is accepted only if it is a non-empty sequence of:

- **bare runs** of characters from the safe set;
- **quoted strings** `'…'` or `"…"`, closed with the same quote, whose content is made of
  characters **from the same safe set and nothing else**. The quotes only delimit; they never
  admit a character that a bare run would refuse.

So no accepted value contains `{`, `}` or `;` anywhere, inside quotes or out. The property of
step 3 counts exactly those characters, and it can only do so because the grammar holds that
line even inside strings.

Everything else is refused, and in particular each of these:

| Refused | Why it matters |
|---|---|
| `<` and `>` outside a string, and inside one | `</style` ends the raw-text element whatever CSS thinks. Neither character is needed by any token |
| a tab, a newline, U+00A0 or any space other than U+0020 | Space means U+0020. Other whitespace is invisible in review, and a newline can split what looks like one declaration |
| `;` `{` `}` | They end the declaration or the rule, and the next bytes become a rule of the attacker's choosing |
| `\` | A CSS escape can spell any of the characters above without writing them |
| `/*` and `*/` (via `/` and `*`) | A comment can swallow the rest of the stylesheet |
| `(` and `)` | No function at all, so no `url(`, `image-set(`, `expression(` or `var(`. No token uses one, and allowing a single function is a decision, not a default |
| `@` | `@import` and friends |
| `!` | `!important` reaching past the custom property |
| an unclosed quote | It would run into the following declarations |
| an empty or whitespace-only value | An empty custom property silently disables the style it feeds |

The error message names the token key and the value, the way `buildTheme` does for an unknown
id, so that a refused value can be found without digging.

### 2. `src/build.ts` — one line

Replace `escapeHtml(doc.theme[key])` with `cssThemeValue(key, doc.theme[key])` in `buildCss`.
Nothing else in the file changes. `escapeHtml` stays in use everywhere it already guards HTML
text and attributes.

### 3. `test/escaping.test.ts`

- **The regression.** The editorial-serif stack from `packages/tokens` renders verbatim: the
  output contains `'Times New Roman'` and `'Segoe UI'`, and contains no `&#39;`. It fails
  against today's code, passes after.
- **Every refused case in the table above** throws an error naming the key. Include at least:
  - `</style><script>alert(1)</script>` and `</STYLE>` inside a quoted string;
  - `red; } body { display: none`;
  - `url(https://example.test/x.png)` and `\3c /style\3e`;
  - `Georgia /* */`, an unclosed `'Times`, `red !important`, and an empty string;
  - `'Times;New'` and `'a{b}'`: `;`, `{` and `}` are refused inside quotes too;
  - a tab, a newline and U+00A0, both in a bare run (`Georgia,\tserif`) and inside a quoted
    name (`'Times\u00A0New Roman'`).
- **Every value in use today is accepted unchanged:**
  - the `theme` of each of the five existing fixtures;
  - every palette, type pair and scale value in `packages/tokens`, copied into the test as
    literals. The renderer has no dependency on tokens, and this task adds none;
  - identifier-shaped values such as `color.primary-abc` and `font.heading-x1`, written as
    literals. They are **not** samples of `arbitraryTheme`, whose suffix is arbitrary (see
    "Invariants it touches").
- **A fast-check property:** for every generated value, `cssThemeValue` either throws, or
  returns the value unchanged **and** a stylesheet built with it has these three properties:
  - no `</style` in any letter case;
  - exactly as many `{`, `}` and `;` as the fixed template;
  - one declaration per token key.

  That is the injection guarantee stated as a property, the same move `apps/serve` made for
  tenancy.

  **The generator must not make the property trivially true.** Over `fc.string()` almost every
  value is refused, and a property that only ever sees the throwing branch checks nothing. So:
  - **The values mix valid fragments with dangerous ones.** Valid fragments: real token values
    (`#1D4ED8`, `2.5rem`, `Georgia`), quoted family names (`'Times New Roman'`,
    `"Segoe UI"`), identifier-shaped values such as `color.primary-abc`, commas and single
    spaces.
    Dangerous fragments: `<`, `>`, `</style>`, `</STYLE>`, `;`, `{`, `}`, `\`, `/*`, `*/`, `(`,
    `)`, `url(`, `@import`, `!important`, a lone `'` or `"`, a tab, a newline, U+00A0, a
    non-ASCII letter.
  - **Weighted so both branches run often:** roughly one fragment in five is dangerous.
  - **The test counts the outcomes** over at least 2000 runs, and fails unless **at least 25%**
    of the generated values were accepted **and** at least 25% refused.
  - The threshold is part of the test, not a tuning knob. If the generator changes and the
    ratio drops, the answer is to fix the generator, not to lower the number.

### 4. The golden fixture

Create `fixtures/documents/tokens-quoted-fonts.json`:
- a one-section cover, the same shape as `barbershop-cover`;
- a `theme` copied **verbatim** from `packages/tokens`: palette `classic-blue`, type pair
  `editorial-serif`, the default scale;
- it reuses an existing asset from `fixtures/assets/`, since no new asset may be created.

Then run `pnpm test:golden -u` and **read the diff**. It must show exactly one new file,
`fixtures/golden/tokens-quoted-fonts.html`, and no change to the other five. In the new file:
- `--font-heading` reads `Georgia, Cambria, 'Times New Roman', Times, serif`;
- `--font-body` carries `'Segoe UI'`;
- `&#39;` appears nowhere.

Beware of `golden.test.ts`: it **writes** a missing golden file instead of failing. If the new
fixture is added without `-u`, the golden gets approved silently. Generating it deliberately and
reading it is what makes it a reviewed golden rather than a self-approved one.

The new fixture joins the corpus that the other suites iterate over: `pnpm size`, the publisher
tests and the serve contract test. All of them must stay green without modification.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| `pnpm install` | completes, lockfile unchanged |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including the new escaping tests and the property |
| `pnpm test:invariants` | exit 0, all reported by canonical name. A regression check only: no invariant renders a generated document, so this says nothing about which values the guard accepts |
| `pnpm test:golden` | exit 0 |
| `git diff --stat fixtures/golden` | **one** new file. The five existing ones do not appear |
| `grep -c "&#39;" fixtures/golden/tokens-quoted-fonts.html` | `0` |
| `pnpm size` | exit 0, the new fixture included |
| `pnpm renderer:deps` | exit 0, no dependency added |
| `pre-commit run --all-files` | six hooks, all Passed |

Manual, and it is what closes finding 4:

- [ ] On the `feat/a11y` branch rebased onto the result, run
      `RETORIKA_A11Y=1 pnpm vitest run --project a11y --silent=false -t "reports the font"`.
      On macOS the heading of `editorial-serif` and `classic-display` is **Georgia**, not
      Times, and the three pairs no longer collapse onto one font.
- [ ] Open the new golden file in a browser. The heading is visibly Georgia.

- [ ] New tests that failed before and pass now
- [ ] The five existing goldens byte-identical
- [ ] No existing fixture, token or schema file modified
- [ ] No keys and no real client data

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Semantic validation** — whether a colour is a real colour, or a size a real length. The
  guard answers "can this value break out of its context", not "is this a good value".
- **Moving the check into `packages/schema`**, so that `parseDocument` refuses the value at
  write time. That is the better long-term home, but it changes the schema, needs a migration
  for documents already stored, and has its own task.
- **Making `arbitraryTheme` produce safe theme values.** Its suffix is arbitrary today, and it
  does not matter only because nothing renders what it generates. The day generated documents
  are rendered, the generator has to produce values the guard accepts. That changes
  `packages/schema` and gets its own task.
- **Rendering generated documents in the invariants.** Today no invariant renders one, so none of
  them exercises the guard, or `render` at all, over generated input. Closing that gap depends on
  the same `packages/schema` task as the point above.
- **Rendering `ContentElement.style` exact values.** They are not emitted today. When they are,
  they cross the same boundary and must go through the same guard. That belongs to the task
  that starts emitting them.
- **Allowing any CSS function** (`clamp()`, `calc()`, `var()`, `rgb()`), even though a future
  scale may want one.
- A Content-Security-Policy header or meta tag.
- Changing `packages/tokens` values to avoid quotes. The values are right; the renderer was not.
- Any of the other three findings of PR #6 (image-background text hidden behind the photo,
  mobile row collisions, unstyled links). Each is its own task, in the order 2, 1, 3.
- Touching the `feat/a11y` branch beyond the manual check above.

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **A grammar rule that rejects a value in use today.** That means a value in any existing
   fixture, in `packages/tokens`, or an identifier-shaped literal such as `color.primary-abc` —
   including an invariant test going red. Bring the value and the rule that refused it. Do not
   widen the grammar, and do not change the generator: it lives in `packages/schema`, which this
   task does not touch.
2. **A legitimate token value that the grammar refuses.** Do not edit the token and do not
   widen the grammar on your own. Bring the value and the rule that rejected it.
3. **Any change to an existing golden byte.** It would mean a current value contained one of
   `& < > " '` and was being altered by `escapeHtml` — which the survey for this task found in
   none of them. If it happens, the survey was wrong, and a published site would change. Stop.
4. **Allowing a CSS function**, or any character outside the allowlist, because some value
   "needs" it. That is a decision about what theme values may express, not an implementation
   detail.
5. **Refusing at render time versus refusing at parse time.** This task refuses at render time,
   because the renderer is the last place before the bytes ship. If a caller needs the error
   earlier, that is the schema task, not a change of plan here.
6. **Anything that would make `render` fall back** — drop the declaration, substitute a
   default, or strip characters — instead of throwing. The empty box gets published; so would
   the silently altered font.
