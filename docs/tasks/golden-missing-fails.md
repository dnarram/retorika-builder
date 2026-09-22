# golden.test.ts — a missing golden fails, and `UPDATE_GOLDEN=1` is the only way to regenerate

> **Claude-only. Exclusive zone.** `packages/renderer` is an exclusive zone, test files
> included, and the golden corpus is the guard that shows a style change altering every
> published site. A guard that approves its own output is worse than no guard.
>
> Not delegated to OpenCode under any circumstances, however small the diff looks.

## Objective

`pnpm test:golden` **fails** when a golden file is missing, with a message that says exactly how
to generate it. It never writes one on its own. Regenerating is possible **only** with
`UPDATE_GOLDEN=1 pnpm test:golden`, and every place in the repository that documents
regeneration says that and nothing else.

## Where it comes from

- **Issue #8**, and the comment added to it while executing
  `docs/tasks/image-background-panel.md`.
- **Defect 1 — a missing golden is written silently.** `packages/renderer/test/golden.test.ts:25-28`:

  ```ts
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, html, "utf8");
    return;
  }
  ```

  - A new fixture committed without its golden passes `pnpm test` on the first run, and
    whatever the renderer produced becomes the stored "correct" output, approved by nobody.
  - It nearly happened twice in this repository's history, in #7 and in #10: the new fixture
    existed before the fix, and a full `pnpm test` would have stored the bug as the golden.
  - Both times it was avoided only because whoever was executing knew to run a single suite by
    name. The test did not prevent it.
- **Defect 2 — the documented `-u` has never regenerated anything.**
  `golden.test.ts:15`:

  ```ts
  const UPDATE = process.argv.includes("-u") || process.env["UPDATE_GOLDEN"] === "1";
  ```

  - Vitest runs test files in worker processes and does not pass its own flags on to them. A
    probe test printed the worker's `process.argv.slice(2)` under `vitest run -u` and got `[]`.
  - So `-u` never reaches the check, and `pnpm test:golden -u` only ever *seemed* to work: that
    was when a golden was missing, which is defect 1.
  - Environment variables do reach the workers, which is why `UPDATE_GOLDEN=1` works. #10, #11
    and #12 regenerated their goldens that way.
- **Where `-u` is documented today** (every mention in the tracked files, checked for this
  task):

  ```
  packages/renderer/test/golden.test.ts:12   Regenerate deliberately with `pnpm test:golden -u`, then read the diff.
  packages/renderer/test/golden.test.ts:15   const UPDATE = process.argv.includes("-u") || ...
  docs/protocolo.md:577                      propósito, se regenera con `pnpm test:golden -u` y **el diff se revisa en el pull request**:
  docs/protocolo.md:1083                     | Regenerar las doradas | `pnpm test:golden -u` |
  docs/protocolo.md:1132                     `pnpm test:golden -u` y **revisar el diff antes de hacer commit**. Si el diff toca secciones
  CLAUDE.md:53                               | `pnpm test:golden` | Generated HTML against the stored corpus (`-u` regenerates) |
  README.md:82                               ... `-u` regenerates, and the diff must be read |
  .github/workflows/ci.yml:75                # Never with -u here. Regenerating in CI would mean the build approving its own
  ```

  The task files that mention `-u` are listed under "Out of scope".

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/renderer/test/golden.test.ts   (the behaviour, and its own comment)
docs/protocolo.md                       (lines 577, 1083 and 1132 only)
CLAUDE.md                               (line 53 only)
README.md                               (line 82 only)
.github/workflows/ci.yml                (line 75 only: a comment)
```

No change to:
- `packages/renderer/src`: **no rendered byte moves**;
- any golden or fixture;
- `package.json`: **no new script**, because `UPDATE_GOLDEN=1 pnpm test:golden` must stay the
  only way;
- `vitest.config.ts`, `packages/renderer/test/corpus.ts`;
- any other part of `docs/protocolo.md`.

## Invariants it touches

**`INV_5` — "Publishing produces identical output with tools on or off".** Nothing the renderer
produces changes. What changes is the guard that compares it: the golden corpus stops being
able to approve itself. **The seven goldens must stay byte-identical**, and
`git diff --stat fixtures/golden` must be empty.

`INV_1`–`INV_4` are about the document, and stay in the definition of done as a regression
check.

## Steps

### 1. `golden.test.ts` — the behaviour

**It is decided, so do not improvise.**

1. **One trigger only:** `const UPDATE = process.env["UPDATE_GOLDEN"] === "1";`. The
   `process.argv` check goes, so the undocumented path stops existing as well.
2. **A pure decision function**, local to the file:

   ```ts
   /** Write only under UPDATE_GOLDEN=1; otherwise compare, or fail if there is nothing to compare. */
   function goldenAction(update: boolean, exists: boolean): "write" | "compare" | "missing";
   ```

   - `update` true gives `"write"`, whether the file exists or not. That is the only write path.
   - `update` false and the file exists gives `"compare"`.
   - `update` false and the file missing gives `"missing"`.
3. **The message for a missing golden, verbatim**, where `path` is the file relative to the
   repository root (`fixtures/golden/<name>.html`, computed from `REPO_ROOT` in `corpus.ts`, so
   the message is the same on every machine):

   ```
   No golden file for "<name>" at <path>. A missing golden is never written by the test:
   generate it deliberately with `UPDATE_GOLDEN=1 pnpm test:golden`, then read the new
   file and the diff before committing.
   ```

   The test fails with this message. The file stays absent.
4. **A mismatch is unchanged:** `expect(html).toBe(stored)`, exactly as today.
5. **The header comment** replaces line 12's `-u` with:
   - regenerate deliberately with `UPDATE_GOLDEN=1 pnpm test:golden`, then read the diff;
   - a missing golden fails rather than being written;
   - `-u` is not supported, because Vitest does not pass flags to the workers that run this
     file (issue #8).

**Tests for the decision**, in the same file, so no new file is created. They are plain `it`s
that `vitest run golden` picks up:
- `goldenAction(false, false)` is `"missing"`;
- `goldenAction(false, true)` is `"compare"`;
- `goldenAction(true, false)` and `goldenAction(true, true)` are `"write"`;
- the missing-golden message contains the fixture name, `fixtures/golden/<name>.html` and
  `UPDATE_GOLDEN=1 pnpm test:golden`.

### 2. The documentation — exactly these replacements

`docs/protocolo.md` is the product owner's document, in Spanish, and stays in Spanish. **Three
lines change, and nothing around them.** Each line below is the complete new content of that
line:

```
577   propósito, se regenera con `UPDATE_GOLDEN=1 pnpm test:golden` y **el diff se revisa en el pull request**:
1083  | Regenerar las doradas | `UPDATE_GOLDEN=1 pnpm test:golden` |
1132  `UPDATE_GOLDEN=1 pnpm test:golden` y **revisar el diff antes de hacer commit**. Si el diff toca secciones
```

`CLAUDE.md`, `README.md` and `ci.yml` are in English. **One line each**:

```
CLAUDE.md:53    | `pnpm test:golden` | Generated HTML against the stored corpus (`UPDATE_GOLDEN=1 pnpm test:golden` regenerates) |
README.md:82    (the same row as today, with `-u` regenerates replaced by `UPDATE_GOLDEN=1 pnpm test:golden` regenerates; the rest unchanged)
ci.yml:75             # Never with UPDATE_GOLDEN=1 here. Regenerating in CI would mean the build approving its own
```

Line 76 of `ci.yml` (`# output, which is the one thing …`) stays as it is, and so does the
`- run: pnpm test:golden` step. CI must never set `UPDATE_GOLDEN`.

**Predicted `git diff --numstat`** for the documentation: `docs/protocolo.md 3 3`,
`CLAUDE.md 1 1`, `README.md 1 1`, `.github/workflows/ci.yml 1 1`. Any other count is a stop.

### 3. Probes — the guard has to be seen failing

Temporary, and undone. After them, `git status` shows only the task's own changes.

1. **Missing golden, without the variable.**
   - Move `fixtures/golden/barbershop-cover.html` to the scratch directory, then run
     `pnpm test:golden`.
   - It must **fail** with the message of step 1.3, naming `barbershop-cover`.
   - The file must **still be absent** afterwards.
2. **Missing golden, with the variable.** Run `UPDATE_GOLDEN=1 pnpm test:golden`. The file is
   recreated, and `cmp` against the moved copy is byte-identical.
3. **`-u` is gone.**
   - Change one byte of a golden, then run `pnpm test:golden -u`.
   - It must **fail**, the file must **not** be rewritten, and the changed byte must remain.
   - Then undo the edit.
4. **Before the change**, probe 1 on the current code writes the golden and passes. Run it
   once before step 1 and record the result, as the "failed before" evidence. Restore the file
   afterwards.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| `pnpm install` | completes, lockfile unchanged |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including the new `goldenAction` tests |
| `pnpm test:invariants` | exit 0, all reported by canonical name (a regression check) |
| `pnpm test:golden` | exit 0, the seven goldens unchanged |
| `git diff --stat fixtures/golden` | empty |
| `git diff --numstat` on the four documentation files | exactly as step 2 predicts |
| the grep below | **zero matches** |
| `pnpm size`, `pnpm renderer:deps` | exit 0 |
| `pre-commit run --all-files` | six hooks, all Passed |

The grep, run from the repository root, excludes `docs/tasks`:

```
git grep -n -e "golden -u" -e 'includes("-u")' -e "with -u" -e "-u\` regenerates" -- ':!docs/tasks'
```

- `docs/tasks` is excluded because the task files mention `-u` on purpose. That includes this
  file, which quotes the old text, and the executed tasks, which explain why `-u` does not
  work. They are records, not documentation of how to regenerate.
- Before this task, the grep finds exactly the 8 mentions listed under "Where it comes from".
- **After it, it must find none.**
- The new header comment of `golden.test.ts` has to be worded so it does not match either: it
  never says "golden -u" or "with -u".

- [ ] The four probes of step 3 behave as described
- [ ] New tests that failed before and pass now
- [ ] No rendered byte, golden or fixture changed
- [ ] The pull request says `Closes #8`
- [ ] No keys and no real client data

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Editing the executed task files.** `docs/tasks/theme-css-values.md` still says "generated
  with -u" (line 53) and "run `pnpm test:golden -u`" (line 198). They are the record of how
  that task was specified when it ran.
  - `image-background-panel.md`, `mobile-row-collisions.md` and `link-colour.md` already say
    that `-u` does not work, and why.
  - Rewriting finished task files would change history, not documentation.
- **A second regeneration path:** a `test:golden:update` script, a different variable, or
  accepting `UPDATE_GOLDEN=true`. The requirement is one documented way.
- **A guard that refuses `UPDATE_GOLDEN=1` when `CI` is set.** It is reasonable, but it is a
  new rule. Today `ci.yml` never sets the variable, and its comment says why.
- **Detecting orphan goldens**, meaning golden files with no fixture.
- **Richer mismatch messages** or a diff printer.
- **Issue #9**, the font fallbacks.

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **Any golden byte changing**, or any file under `packages/renderer/src` needing to change.
   This task must not move a rendered byte.
2. **A missing golden being written without `UPDATE_GOLDEN=1`**, in any probe or in any run.
3. **`UPDATE_GOLDEN=1` not regenerating**, for example because the variable does not reach the
   workers in some configuration. Bring the command and its output; do not add another
   trigger.
4. **A documentation diff that differs from step 2**, including touching the protocol beyond
   its three lines, or any of the executed task files.
5. **Any reason to add a script, a flag or a second variable**, or to set `UPDATE_GOLDEN` in
   CI.
