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
| `pnpm typecheck` | Types across the workspace |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm size` | Published page under 60 KB gzipped, zero JavaScript |
| `pnpm schema:guard` | A schema change carries its migration. Takes a diff range: `pnpm schema:guard origin/main...HEAD` |
| `pnpm renderer:deps` | No runtime dependency reaches the client's site |

`INV_4` is **provisional**: the design-tools switch does not exist yet, so only the schema's
refusal to store it is verified. See `docs/document-rules.md`.

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
