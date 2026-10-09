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

**And in sprint 13 it became usable with a mouse, which it had not been.** Six of the toolbar's
controls — both measurement dropdowns, the three exact-pixel fields and the colour picker — had been
drawn and unusable since sprint 9: a `preventDefault` on the whole bar cancelled the gesture that
*is* the control, so a dropdown never opened and digits typed into a size field landed in the
headline. Nothing caught it because every test drove those controls programmatically. The bar also
gained an element's typeface, chosen between the two faces the ZIP already ships
([ADR 0032](docs/decisions/0032-typography-per-element-with-the-faces-that-travel.md)), and the two
approved screens that had shipped half-built or not at all were settled — mockup 11's in-canvas
notice built, mockup 06's progress screen refused as a measured fiction.

**A defect older and quieter than any of those was found by measuring it**: the preview was fully
drawn but completely inert for the first ~65 ms of every load, because the chrome attaches on the
frame's `load` and `load` waits for eight font requests nothing answers. A click or a keystroke in
that window was **lost, not delayed**. It had been surfacing for two sprints as an intermittent CI
failure with no mechanism; sprint 13 day 7 has the measurement, the fix and three deterministic
tests.

## The editor, pillar by pillar (4 October 2026, closing sprint 14)

**This section exists so that the sprint after this one does not have to come back and work it out.**
The protocol's Fase 3 defines «modo estudio completo» as five things; four are decided and the fifth
is not started. Where something is deferred, the ADR that defers it is named, because «not built» and
«decided against, with a reason» are different states and only the second needs no further thought.

| Pillar | State | Under |
|---|---|---|
| Grid and placement | **complete** | sprint 8, [ADR 0025](docs/decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) |
| Style system | **complete**, five properties, the fifth with no exact value | [ADR 0026](docs/decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md), [ADR 0032](docs/decisions/0032-typography-per-element-with-the-faces-that-travel.md) |
| Per-device control | **complete for mobile; tablet deferred** to phase 3 | [ADR 0030](docs/decisions/0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md) |
| Reusable content | **complete** in the shape that ADR decides | [ADR 0033](docs/decisions/0033-reusable-content-and-the-template-that-is-one-item.md) |
| Interactions | **not started**: tabs, accordions, carousels, modals, scroll animations, conditional forms. Zero code, and it needs its own ADR | forms already deferred by [ADR 0020](docs/decisions/0020-contact-stays-links-only-for-phase-1.md) |

**And what is refused rather than pending**, so nobody reopens it by accident: «tipografías propias»
and a third shipped pair (ADR 0028 and ADR 0032 §2, which makes a typed family *unexpressible* rather
than merely unoffered); alignment and per-element move/duplicate/delete (ADR 0026's own "what this
refuses", and ADR 0032 — deleting an element collides with document rule 3); guides that snap and
entry animations (phase 3 of the concept dossier); and the template gallery (§9).

**Three things about reusable content are deliberately not built**, each named in ADR 0033: a page per
entry and the menu that would follow it, collections shared between documents — that is accounts —
and a bound leaf outside a list.

**Not yet built:** accounts and persistence (the browser tab is the only copy until it downloads),
payment ([ADR 0021](docs/decisions/0021-charging-waits-for-a-sellable-product.md)), the photo bank's
images for ten of the eleven sectors ([ADR 0011](docs/decisions/0011-sample-photos-per-sector.md)) —
the machinery shipped in sprint 6, and `restaurante-bar` has held the first nine approved photographs
since 8 October 2026 — and a tablet breakpoint, which
[ADR 0030](docs/decisions/0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md) defers to
phase 3 rather than leaving half-present. The remaining sectors' text is **done**: all ten launch
sectors have their own bank since sprint 8.

## The account, piece by piece (4 October 2026, closing sprint 15)

The same declaration the editor got when sprint 14 closed, for the same reason: so the next sprint
reads this instead of working it out. Decided by
[ADR 0034](docs/decisions/0034-the-account-arrives-at-the-end.md), **accepted by David on
5 October 2026**.

**The shape of it, which is not the obvious one.** The account is created **at the end**, when there
is a web worth keeping, because that is what the concept dossier says: «La cuenta se crea al final,
cuando ya tiene una web que no quiere perder.» The landing asks for nothing, the five questions ask
for nothing, and the login exists for **coming back**. «Sin registro» is still true.

| Piece | State | With which ADR |
|---|---|---|
| Landing at `/` | **built**, minimal, and prerendered — it reads nothing, so it could move to a Render static site unchanged | ADR 0034 §2, §20 |
| The five questions | **unchanged**, moved to `/empezar`. No account anywhere in them | ADR 0034 §2 |
| Email + password | **built**: sign in, sign up at the end, reset mail | ADR 0034 §3 |
| Google sign-in | **built, in testing mode** — 100 test users. Leaving it needs a homepage on a domain we own, and `*.onrender.com` is not ours. **Not verified end to end by development**: it needs David's credentials | ADR 0034 §4 |
| Saving a site | **built**, and it only ever adds. There is no `upsert` in the module at all | ADR 0034 §9 |
| Coming back | **built**: `/mis-webs` lists, `/mis-webs/[id]` opens | ADR 0034 §2 |
| «Solo ves tus propias webs» | **built in the database**, as row-level security, and tested as policies against a real Postgres | ADR 0034 §7 |
| A stale write | **refused**, never merged and never silently won | ADR 0034 §8 |
| Account deletion | **built**, with a 30-day window, and proven by going to look for the rows. The sweep that ends accounts is `pnpm accounts:purge` and **nothing schedules it yet** — runbook §6 | ADR 0034 §12, protocol Part 15 |
| Account provisioning | **built**, as a trigger on `auth.users` (migration `0002`). It was missing entirely until 5 October 2026, which made the two rows above claims rather than behaviour | ADR 0034 §12 |
| The export | **built**, and it works with a deletion already pending | protocol Part 16, rule 1 |
| Privacy notice | **built**, at the moment the account is created | ADR 0034 §13 |
| The audit log | **built**, with two of Part 17's four operations possible | ADR 0034 §17 |
| Photos on the server | **not built, and said out loud** in the dialog and in the list: the document travels, the photographs stay in the browser | ADR 0034 §5 — sprint 16 |
| Locking, ownership transfer, collaborators | **not built.** Three of the five keys the document refuses are still only destinations | advanced dossier §8; ADR 0034 §6 |
| Charging | **not built, and not this sprint's to release** | ADR 0021, untouched |
| Private areas with login | **not this login.** Phase 4, on the client's own site, with its own pricing model | ADR 0001, advanced dossier §10 |

**What the next sprint should not have to re-derive:**

- **Both platforms are needed and neither replaces the other.** Supabase does not host a Next.js
  server; Render has no authentication product. Row-level security is the reason the choice is
  right rather than merely cheap. 0 € today; the first upgrade worth paying for is Render's paid
  instance, which is one line of `render.yaml`.
- **Drizzle is not in the stack yet**, and that is a judgement rather than an oversight — see the
  sprint-15 day-6 pull request. The protocol names it; whether it goes in on principle is
  direction's call.
- **Three things are waiting on David and are written down**:
  [`docs/tasks/copias.md`](docs/tasks/copias.md) (the free plan has no backups),
  [`docs/tasks/arranque-en-frio.md`](docs/tasks/arranque-en-frio.md) (two measurements and whether
  to split the landing), and
  [`docs/tasks/el-recorrido-de-la-cuenta.md`](docs/tasks/el-recorrido-de-la-cuenta.md) (the
  thirteen-step walk that needs a real project).

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
| `packages/photobank` | The per-sector sample-photo bank ([ADR 0011](docs/decisions/0011-sample-photos-per-sector.md)). **The machinery is here, and one sector is in it**: `restaurante-bar` has held nine approved photographs since 8 October 2026 (PR #197), and the other ten sector files still hold zero, because a photograph needs a licence checked and a person's approval rather than code. A generated site of a sector without photographs opens on the catalog's grey marker. Since [ADR 0035](docs/decisions/0035-the-bank-has-a-floor-and-the-nine-are-regenerated.md) a photograph also has a floor — 1344 × 896, the full-width cover at a 1440 px window — and **the nine are to be regenerated at 1600 × 1072**: they stay published, exempt by id, and the exemption expires on 31 October 2026, after which the package's own tests fail while any record is still under the floor | **here** |
| `packages/db` | The application's database: accounts, sites and the audit log, with the row-level security policies that decide who sees what. **SQL migrations are the source of truth**, because the policies are the half that matters and a generator that emitted tables but not policies would leave them hand-written anyway ([ADR 0034](docs/decisions/0034-the-account-arrives-at-the-end.md)) | **here** |
| `packages/templates` | Template extraction and application | 3 |
| `.claude/skills`, `.claude/commands` | Specialist checklists and project commands | as needed |

## Documentation

- `docs/dossiers/` — the two approved dossiers. Source of truth for the product.
- `docs/document-rules.md` — the document model: seven rules, roles, tokens, the five style
  properties, the two marks, the three breakpoint adjustments, and the invariants.
- `docs/decisions/` — ADRs. Where one amends a dossier, it says so.
- `docs/design/` — the phase 1 screens, and the review that checks them against the ADRs.
- `docs/tasks/` — task plans, written before implementing.
- `docs/protocolo.md` — the development protocol (in Spanish).

