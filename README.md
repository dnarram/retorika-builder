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

**Phase 0, the walking skeleton, is closed** (2026-09-22), under the criterion as amended by
[ADR 0007](docs/decisions/0007-hosted-publishing-on-hold.md): a one-section site generated,
downloaded as a ZIP that opens by double-clicking, and the same files served unchanged by a
generic static server, with the invariants green in CI. Publishing on a Retorika domain has
no plan ([ADR 0008](docs/decisions/0008-hosted-publishing-has-no-plan.md)): `apps/serve` stays
built, tested and dormant.

**Phase 1 is under way, and the generation path works end to end.** The catalog has **nine
sections a page can hold** — Portada, Qué hago, Horario y ubicación, Opiniones, Precios, Fotos de
trabajos, Equipo, Contacto y reservas, and the footer — plus an avance, which exists only as the
reference a converted page leaves behind and is never offered in the menu. `apps/editor` is a real
Next.js application, deployed and growing daily: the five questions with their error states, three
real generated variants with a live preview of each, click-to-edit text that carries into the ZIP,
and the download itself, built in memory and never written to Render's ephemeral disk.
`packages/generator` turns the five answers into a valid `RetorikaDocument`, drawing its text from
`packages/copybank`'s reviewed per-sector bank
([ADR 0009](docs/decisions/0009-generated-texts-from-a-reviewed-bank.md)).

> **This paragraph said «four sections» until the sprint 12 closeout**, which was true when it was
> written and stopped being true in sprint 7, when «Quién soy / El equipo» made the catalogue nine
> of nine. Corrected here rather than deleted, because it is the third time this file has been
> found describing a product two sprints younger than itself — after `INV_4` and after the `e2e`
> job — and the pattern is worth more than any one correction.

Building the editor before the protocol's usability-prototype gate concluded was a deliberate,
CEO-directed exception, not an oversight —
[ADR 0017](docs/decisions/0017-editor-starts-before-the-sessions-conclude.md) records why, and
what it costs. **Three sessions ran, and there will be no more**
([ADR 0031](docs/decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md),
2 October 2026): usability is David's to judge, and phase 1's acceptance criterion is now his
written judgement rather than a stranger timed and observed. That ADR names what the change costs,
including three questions nobody inside the team can answer.

**The editor chrome this list used to call unbuilt is built.** The floating toolbar landed in
sprint 9 and gained bold and italic in sprint 10; undo, reorder and duplicate landed in sprint 2,
and undo gained its keyboard shortcut in sprint 12; the properties panel — `Campos de esta sección`
— landed in sprint 3 and reached inside a list's lines in sprint 12.

**Not yet built:** accounts and persistence (the browser tab is the only copy until it downloads),
payment ([ADR 0021](docs/decisions/0021-charging-waits-for-a-sellable-product.md)), the photo bank's
images ([ADR 0011](docs/decisions/0011-sample-photos-per-sector.md)) — the machinery shipped in
sprint 6 and the eleven sector files hold zero photographs — and a tablet breakpoint, which
[ADR 0030](docs/decisions/0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md) defers to
phase 3 rather than leaving half-present. The remaining sectors' text is **done**: all ten launch
sectors have their own bank since sprint 8.

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
| `pnpm test:golden` | Generated HTML against the stored corpus — the diff that reveals a style change altering every published site. `UPDATE_GOLDEN=1 pnpm test:golden` regenerates, and the diff must be read |
| `pnpm test:coverage` | The same suite with the coverage floor applied |
| `pnpm typecheck` | Types across the workspace |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm size` | Published page under 60 KB gzipped and the whole bundle under 80 KB, zero JavaScript |
| `pnpm fonts:generate` | Regenerates the shipped font bytes from `@fontsource`; needed only after bumping a pinned version |
| `pnpm schema:guard` | A schema change carries its migration. Takes a diff range: `pnpm schema:guard origin/main...HEAD` |
| `pnpm renderer:deps` | No runtime dependency reaches the client's site |
| `pnpm site:sample <fixture> [out-dir]` | Builds a fixture as a real site plus its ZIP (default `.scratch/site` and `.scratch/site.zip`), so the double-click check is something you can actually do |
| `pnpm coverage:ratchet` | The coverage floor has not been lowered. Takes the same diff range |
| `pnpm audit:exceptions` | Every ignored advisory carries a date and a reason |
| `pnpm security:audit` | `pnpm audit`, blocking at moderate |
| `pnpm security:secrets` | gitleaks, at the version pinned in `.pre-commit-config.yaml` |

`INV_4` **is no longer provisional**, and `PROVISIONAL_INVARIANTS` is empty. It was provisional
while the design-tools switch did not exist and only the schema's refusal to store it could be
checked; the switch shipped in sprint 8 and ADR 0025 §3 is where that gate was crossed, so the
invariant is now proved against a real control being flipped. See `docs/document-rules.md`.

> This paragraph said the opposite for two sprints after it stopped being true — the same way the
> note about `test:a11y` and `e2e` not existing did, which `CLAUDE.md` already records once. Found
> on the sprint 10 closeout by reading the file against the code rather than against memory.

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

These are the ten check names, exactly as GitHub reports them. Branch protection matches the
bare job name; the pull request page displays them as `CI / lint`.

| Check | What it runs |
|---|---|
| `lint` | `pnpm lint` |
| `types` | `pnpm typecheck` |
| `editor-build` | `pnpm build:editor` — `apps/editor`'s own build and its Next.js type check, which `types` does not reach |
| `unit` | `pnpm test:coverage` |
| `invariants` | `pnpm test:invariants` |
| `golden` | `pnpm test:golden` |
| `a11y-size` | `pnpm size`, `pnpm test:a11y` |
| `e2e` | `pnpm e2e` — the critical flows against a real `next dev`. **Pull requests only**, per protocol Part 9.2 |
| `security` | `pnpm audit:exceptions`, `pnpm security:audit`, `pnpm security:secrets` |
| `guards` | `pnpm schema:guard`, `pnpm renderer:deps`, `pnpm coverage:ratchet`, all on an explicit diff range |

**`a11y-size` checks the rendered page in a real Chromium**, for every preset × variant ×
palette × type pair: the weight budget, axe with zero serious/critical violations and zero
contrast findings (a contrast axe could not measure counts as a finding), and no horizontal
overflow at 320, 768 or 1280 pixels. `pnpm test:a11y` runs the same thing locally; it needs
`pnpm exec playwright install --with-deps chromium` once, and `pnpm test` never needs a browser.

**`e2e` runs the critical flows against a real running application**, which nothing else here does:
a live Next server, a questionnaire's React state, click-to-edit committing through a real `fetch`,
and `/api/download` answering with a real ZIP. It is limited to pull requests because Actions
minutes are finite, and it needs its own Chromium the same way `a11y-size` does.

> **This paragraph used to say «There is no `e2e` job».** That was true when it was written —
> Playwright was installed for the accessibility harness's two assertions and nothing else, and the
> note existed so an empty job would not sit in the branch-protection list reporting nothing. The
> job arrived in sprint 3 with the flows it exists to exercise, and the sentence stayed behind. It
> is corrected here rather than deleted, because the reasoning it carried is still the right
> reasoning: a job that cannot run anything is worse than no job.

**The protocol names five critical flows and four exist.** The fifth, *pago de prueba y
publicación*, waits on ADR 0008 — hosted publishing is on hold with no plan, so there is no payment
flow and no publish target to test against. `apps/editor/e2e/critical-flows.e2e.test.ts` says so in
its own header, so the count cannot drift unnoticed.

Branch protection on `main` is switched on **after** these workflows have run at least once — a
check does not appear in the protection list until it has reported. The order is: push the
branch, open the pull request, wait for the ten jobs, then configure protection.

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
| `packages/tokens` | Token system and Retorika's own theme | **here** |
| `packages/publisher` | Packages the site: HTML, CSS, images, sitemap, ZIP | **here** |
| `apps/serve` | Worker serving published sites from R2 — built and tested, not deployed | dormant, no plan ([ADR 0008](docs/decisions/0008-hosted-publishing-has-no-plan.md)) |
| `.github/workflows` | The CI jobs of Part 9.2 | **here** |
| `apps/editor` | Next.js: the five-question flow, three generated variants, click-to-edit text, the ZIP download | **here** |
| `packages/generator` | The five answers → a valid `RetorikaDocument`. Not in the protocol's Part 3.4 tree — a deliberate addition, product logic that needs invariant tests, so it lives in a package rather than inside the app | **here** |
| `packages/copybank` | The reviewed, per-sector text bank the generator draws from ([ADR 0009](docs/decisions/0009-generated-texts-from-a-reviewed-bank.md)) | **here** |
| `packages/photobank` | The per-sector sample-photo bank ([ADR 0011](docs/decisions/0011-sample-photos-per-sector.md)). **The machinery is here and the bank is empty** — eleven sector files, zero images, because a photograph needs a licence checked and a person's approval rather than code. Until the first one lands, a generated site opens on the catalog's grey marker | **here** |
| `packages/templates` | Template extraction and application | 3 |
| `.claude/skills`, `.claude/commands` | Specialist checklists and project commands | as needed |

## Documentation

- `docs/dossiers/` — the two approved dossiers. Source of truth for the product.
- `docs/document-rules.md` — the document model: seven rules, roles, tokens, the four style
  properties, the two marks, the three breakpoint adjustments, and the invariants.
- `docs/decisions/` — ADRs. Where one amends a dossier, it says so.
- `docs/design/` — the phase 1 screens, and the review that checks them against the ADRs.
- `docs/tasks/` — task plans, written before implementing.
- `docs/protocolo.md` — the development protocol (in Spanish).

