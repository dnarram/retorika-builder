# The GitHub Actions workflow

> **Delegable to OpenCode.** This task touches none of `packages/schema`, `packages/renderer` or
> `packages/catalog`, so it falls outside the exclusive zones of Part 2. `vitest.config.ts` and
> `package.json` are root files, not core packages, and stay inside the delegable zone.
>
> One thing that is not delegable judgement: **the coverage thresholds are measured, never
> invented.** Run the suite, read the summary, round down. If the plan and the measurement
> disagree, the measurement wins.

## Objective

Every check in Part 8 runs where nobody can choose to skip it, and `main` has real status checks
to require.

## Where it comes from

- Protocol Part 9.2 (the CI jobs) and Part 9.1 (the local reviewer, now six hooks).
- Part 8.4: the migration guard is "un hook de pre-commit **y un job de CI**".
- ADR 0005 (exact toolchain pins) and ADR 0006 (the ratcheted coverage floor), both written
  before this code as Part 3.5 requires.

## Files that may be touched

Closed list. Nothing outside it without asking.

```
.github/workflows/ci.yml
.github/actions/setup/action.yml
coverage-thresholds.json
vitest.config.ts                      (coverage block, importing the thresholds)
package.json                          (scripts, @vitest/coverage-v8, pnpm.auditConfig)
.pre-commit-config.yaml               (the sixth hook)
scripts/coverage-ratchet.ts
scripts/audit-exceptions.ts
docs/decisions/0005-toolchain-versions.md
docs/decisions/0006-coverage-is-a-ratcheted-floor.md
docs/tasks/ci.md
docs/protocolo.md                     (Parts 9.1 and 9.2 only)
README.md
```

## Invariants it touches

None directly. It is what makes the existing five run where they cannot be skipped, and adds
two guards of the same kind: the coverage floor may not fall, and an ignored security advisory
may not be undated or unexplained.

## Steps

1. ADRs 0005 and 0006 first, then the protocol corrections. Code after the decisions.
2. Install `@vitest/coverage-v8`, configure coverage over the three core packages only,
   **measure**, and write the rounded-down floor into `coverage-thresholds.json`.
3. `scripts/coverage-ratchet.ts` and `scripts/audit-exceptions.ts`; add every new script to
   `package.json`, because no job may run a command that cannot be run locally by name.
4. The sixth pre-commit hook.
5. `.github/actions/setup/action.yml`, then `.github/workflows/ci.yml` with eight jobs.
6. README: the check names, the coverage note, the a11y-size caveat, the no-PR-no-run note.

## Two things that are easy to get wrong

**Nothing in the YAML restates a version.** Node comes from `.nvmrc`, pnpm from
`packageManager`, gitleaks from the `rev` in `.pre-commit-config.yaml`. A version written into
the workflow is a second copy, and second copies drift — this project has already watched it
happen three times with the invariant numbering.

**The `guards` job fails closed.** It resolves the diff range explicitly for both events, then
verifies both endpoints exist and share a merge base, and **exits non-zero if it cannot**. The
dangerous failure is not an error; it is a shallow clone producing an empty diff and a cheerful
"nothing to check". A guard that does not know what to compare and answers "all fine" is worse
than no guard.

## Definition of done

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green
- [ ] `pnpm test:invariants` green
- [ ] `pnpm test:coverage` green with the measured floor in place
- [ ] Each of the three guard probes: valid range passes, missing commit fails, all-zero base
      fails
- [ ] The ratchet probed against a real git ref: unchanged passes, raised passes, lowered fails
- [ ] `pnpm audit:exceptions` fails on an undated or unexplained entry
- [ ] Both YAML files parse, and every job has `timeout-minutes`
- [ ] Interface text: none in this task
- [ ] No keys and no real data in the workflow

## What the first run taught

The workflow's first run — on the push that created `main` — went six green, two red. Both
failures were **properties of the GitHub environment, not of the code**, which is why the local
dry run of every job script could not have caught either. Worth recording, because the same
class of thing will happen again.

**`guards`: a push that creates a ref reports an all-zero `before`.**
`cannot determine what to compare — no usable base commit (got '0000…')`. Failing closed was the
right instinct and stays, but the repository's own first push is the one case where there
genuinely is no earlier commit, and it must still *run* the guards rather than be skipped.
`github.event.created` tells that case apart from every other all-zero base; the range becomes
the empty tree (`git hash-object -t tree /dev/null`), with two dots rather than three, since the
empty tree shares no merge base with anything. Any other zero base still fails closed.

**`security`: `actions/setup-python` with `cache: pip` needs a file to hash.**
`No file … matched to [**/requirements.txt or **/pyproject.toml]`. This project installs
`pre-commit` directly and has neither. The cache came out, and was replaced by one on
`~/.cache/pre-commit` keyed on `.pre-commit-config.yaml` — which exists, and which caches the
part that is actually slow: pre-commit rebuilding gitleaks' Go environment every run.

**And a third thing, found while reading the failure rather than from it.** The aborted steps
printed as `Run pnpm schema:guard ""`. Nothing bad happened — the job had already stopped — but
an empty range was *silently safe for the wrong reason*: both guard scripts branched on the
truthiness of `process.argv[2]`, so a blank argument was indistinguishable from no argument and
fell back to the git index, which in CI is empty. That reports "nothing to check" and exits 0.
Fail-open, one careless edit away. Now a present-but-blank range is an explicit error in both
scripts, distinct from no argument at all.

The bootstrap fix also surfaced a latent bug it would have walked into: `coverage-ratchet.ts`
took the base with `range.split("...")[0] ?? range.split("..")[0]`, which for a two-dot range
returns the whole string — truthy, so `??` never falls through. `git show` then failed, the
failure read as "no file at the base", and the ratchet passed silently. Two-dot ranges stopped
being hypothetical the moment the bootstrap range needed one.

The lesson worth carrying: **every one of these was a guard that would have passed rather than
failed.** A guard is only worth having if its silent-success paths are as carefully considered
as its failure messages.

## Out of scope

`e2e` and Playwright — a job that cannot run anything is worse than no job, because it appears
in the branch-protection list as a check that will never report. axe-core, the contrast and
overflow checks, Lighthouse, CodeQL. Deployment, release automation, any secret in CI.
`gh repo create` and switching branch protection on: that is the user's action, and it comes
after these workflows have run once.
