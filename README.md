# Retorika Builder

Professional websites for small businesses in under ten minutes, without coding and without
designing.

The user answers five short questions and gets a complete site back — sections suited to their
trade, plausible text, coherent photos — and from there they only change what they do not like.
The premise of the product is that **the user does not build a website, they correct one**.

The same tool serves two audiences with the same editor: a shop owner building their own site,
and the Retorika team building client sites and handing them over.

**The published site is static HTML and CSS.** No runtime framework, no dependency on any API
of ours: a downloaded site works when you open it by double-clicking it. That constraint is what
makes the download promise, the single price and the near-zero cost per site possible at once.
See [ADR 0001](docs/decisions/0001-static-published-sites.md).

## Status

Phase 0, the walking skeleton: the document model, the renderer and one catalog section, with
the test harness that makes the document's rules verifiable. **There is no editor and no
interface yet.**

## Getting started

Node and pnpm are pinned, and the pin is enforced rather than advisory (`engine-strict`).

```sh
brew install git gh fnm uv pre-commit gitleaks jq
fnm install 24.21.0
fnm default 24.21.0
```

`fnm default` is not optional. `fnm use` affects only the current session, so without a default
a brand-new Terminal has **no Node on PATH at all** — and since Homebrew's node is deliberately
not installed, there is no fallback.

Then activate fnm for every shell. The line goes in **`~/.zshenv`**, with an absolute path:

```sh
echo '[ -x /opt/homebrew/bin/fnm ] && eval "$(/opt/homebrew/bin/fnm env --use-on-cd --shell zsh)"' >> ~/.zshenv
```

Both details matter:

- **`~/.zshenv`**, because zsh reads it on *every* invocation, including the non-interactive
  shell git uses to run hooks. `~/.zshrc` covers only interactive shells and `~/.zprofile` only
  login shells, so either would leave the pin inactive exactly where it counts.
- **The absolute path**, because `~/.zshenv` is read *before* `~/.zprofile`, where `brew shellenv`
  lives. At that moment a bare `fnm` is not yet on PATH, the `eval` fails with
  `command not found: fnm`, and no Node is added.

pnpm comes from corepack, not Homebrew: the Homebrew binary is standalone and ignores the
`packageManager` field, which would defeat the pin.

```sh
corepack enable pnpm
pnpm install
pre-commit install
```

Check it from a non-interactive shell — the one the hooks use — rather than from the prompt,
where it can look right and be wrong:

```sh
zsh -c 'node -v; pnpm -v'   # v24.21.0 / 12.4.2
```

Node 24 "Krypton" is the active LTS line. Node 26 is Current and does not enter LTS until
October.

> **Commit from the Terminal, not from your editor's source-control panel.** macOS desktop
> applications do not read the shell's configuration files, so there the hooks would run without
> the pinned Node.

## Running the tests

| Command | What it guards |
|---|---|
| `pnpm test` | Everything |
| `pnpm test:invariants` | The five invariants: the document rules hold under generated input |
| `pnpm test:golden` | Generated HTML against the stored corpus — the diff that reveals a style change altering every published site. `-u` regenerates, and the diff must be read |
| `pnpm test:coverage` | The same suite with the coverage floor applied |
| `pnpm typecheck` | Types across the workspace |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm size` | Published page under 60 KB gzipped, zero JavaScript |
| `pnpm schema:guard` | A schema change carries its migration. Takes a diff range: `pnpm schema:guard origin/main...HEAD` |
| `pnpm renderer:deps` | No runtime dependency reaches the client's site |
| `pnpm coverage:ratchet` | The coverage floor has not been lowered. Takes the same diff range |
| `pnpm audit:exceptions` | Every ignored advisory carries a date and a reason |
| `pnpm security:audit` | `pnpm audit`, blocking at moderate |
| `pnpm security:secrets` | gitleaks, at the version pinned in `.pre-commit-config.yaml` |

`INV_4` is **provisional**: the design-tools switch does not exist yet, so only the schema's
refusal to store it is verified. See `docs/document-rules.md`.

### Coverage is a floor, not a target

The thresholds in `coverage-thresholds.json` exist to catch regressions, and nothing more.
**The quality guarantee of this project is the invariants** — a hundred per cent coverage with
an invariant broken would be worth nothing, and chasing the last few points buys tests written
to satisfy a counter.

The floor only ever goes up. Raising it needs no ceremony; **lowering it requires an ADR**, and
`pnpm coverage:ratchet` fails the commit and the build if a number goes down. See
[ADR 0006](docs/decisions/0006-coverage-is-a-ratcheted-floor.md).

### Security advisories and their exceptions

`pnpm security:audit` blocks. The escape hatch is `pnpm.auditConfig.ignoreCves` in
`package.json`, and every entry must carry a note in `exceptionNotes` with the date it was added
and one line of why — `pnpm audit:exceptions` fails otherwise.

**An exception is temporary by definition.** There is no expiry automation on purpose: a job
that turns red on a date is just another automatic blockage. The way to review them is to look
at their dates.

Static analysis in the `security` job of Part 9.2 is Biome, which already runs as `lint`. CodeQL
is not enabled: it needs GitHub Advanced Security on a private repository.

## Continuous integration

`.github/workflows/ci.yml` runs on **pull requests to `main` and pushes to `main`**. Node, pnpm
and gitleaks versions are read from `.nvmrc`, `packageManager` and `.pre-commit-config.yaml`, so
CI and your laptop cannot drift. Every job runs a named script from the table above — nothing is
written only in the YAML.

> **Until a pull request exists, a push to a branch runs nothing.** This is deliberate: with an
> open PR, the `pull_request` trigger already covers every push to that branch, and adding a
> branch `push` trigger would only double the bill.

These are the eight check names, exactly as GitHub reports them. Branch protection matches the
bare job name; the pull request page displays them as `CI / lint`.

| Check | What it runs |
|---|---|
| `lint` | `pnpm lint` |
| `types` | `pnpm typecheck` |
| `unit` | `pnpm test:coverage` |
| `invariants` | `pnpm test:invariants` |
| `golden` | `pnpm test:golden` |
| `a11y-size` | `pnpm size` |
| `security` | `pnpm audit:exceptions`, `pnpm security:audit`, `pnpm security:secrets` |
| `guards` | `pnpm schema:guard`, `pnpm renderer:deps`, `pnpm coverage:ratchet`, all on an explicit diff range |

**`a11y-size` currently checks the weight budget only.** axe-core, the contrast check and the
320/768/1280 overflow checks arrive with the publish task, so read its green tick as "under
60 KB gzipped with zero JavaScript" and nothing more.

**There is no `e2e` job.** Playwright arrives with the flows it is meant to test. A job that
cannot run anything is worse than no job: it shows up in the branch-protection list as a check
that will never report.

Branch protection on `main` is switched on **after** these workflows have run at least once — a
check does not appear in the protection list until it has reported. The order is: push the
branch, open the pull request, wait for the eight jobs, then configure protection.

## Repository layout

The tree of Part 3.4 of the protocol, with the phase each part arrives in. Nothing is created
as an empty placeholder.

| Path | What it is | Phase |
|---|---|---|
| `packages/schema` | Document model, version and migrations (Zod) | **here** |
| `packages/renderer` | document → DOM \| document → HTML+CSS | **here** |
| `packages/catalog` | Section presets: slots, cardinality, variants | **here** |
| `scripts/` | The guard scripts the hooks and CI run | **here** |
| `fixtures/` | The golden corpus, its assets and stored output | **here** |
| `packages/tokens` | Token system and Retorika's own theme | 0 |
| `packages/publisher` | Packages the site: HTML, CSS, images, sitemap, ZIP | 0 |
| `apps/serve` | Worker serving published sites from R2 | 0 |
| `.github/workflows` | The CI jobs of Part 9.2 | 0 |
| `apps/editor` | Next.js: public pages, editor, API, Stripe | 1 |
| `packages/templates` | Template extraction and application | 3 |
| `.claude/skills`, `.claude/commands` | Specialist checklists and project commands | as needed |

## Documentation

- `docs/dossiers/` — the two approved dossiers. Source of truth for the product.
- `docs/document-rules.md` — the document model: seven rules, roles, tokens, invariants.
- `docs/decisions/` — ADRs. Where one amends a dossier, it says so.
- `docs/tasks/` — task plans, written before implementing.
- `docs/protocolo.md` — the development protocol (in Spanish).
