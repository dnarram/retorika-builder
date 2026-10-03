# 0034 — The account arrives at the end, and what it obliges

**Status:** proposed ·
**Date:** 2026-10-04 ·
**Decided by:** David, 4 October 2026, planning sprint 15 — answering who gets an account
(«todo el mundo»), how they get in («correo y contraseña **y** Google… una fusión de las opciones 2
y 3»), how much landing («una landing mínima»), whether this sprint charges («no, solo las cuentas»)
and what travels to the server first («primero los documentos»); then delegating the platform
question with a written instruction to decide it «basada en lo mejor para el proyecto… y lo mejor y
barato económicamente… sin sacrificar calidad»; then approving the plan with seven adjustments,
three of which change decisions in this file (§4, §9, §13) ·
**Accepted by:** _pending — this ADR is signed by David, not by its author_ ·
**Touches:** [ADR 0012](0012-application-stack-approved.md) (its third note, and its own release
condition, now met), [ADR 0021](0021-charging-waits-for-a-sellable-product.md) (whose accounts
consequence this releases while leaving its charging decision untouched),
[ADR 0019](0019-the-footer-offers-the-owners-details.md) (the Part 15 amendment this falsifies),
[ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) (`designTools`
moves, as that ADR said it would), [ADR 0018](0018-own-cover-photo-before-phase-2.md) (the save
indicator's honesty rule), [ADR 0008](0008-hosted-publishing-has-no-plan.md) (no hosted-publishing
entry point, which a logged-in list must not imply), [ADR 0001](0001-static-published-sites.md),
protocol Parts 14, 15, 16 and 17, `docs/document-rules.md` «What never enters the document»
(`:374-387`), the concept dossier's six screens, and the advanced dossier §8 and §10.

---

## Context

### The appointment the repository had already made

This is not a new idea arriving. Two ADRs scheduled it.

[ADR 0033](0033-reusable-content-and-the-template-that-is-one-item.md), sprint 14's, ends its
deferral list with collections shared between documents or between clients: **«That is accounts, and
the sprint after this one starts with its own ADR.»** This is that ADR.

And ADR 0012 set its own release condition eleven days ago, in its third note (`0012:19-26`):

> **A third note (25 September 2026): protocol Part 14's "guardado automático" is met in its minimal
> version, `localStorage`, not this ADR's Supabase.** … `localStorage` satisfies "automatic save"
> honestly on its own terms … and the editor's `Guardado` tick says `Guardado en este navegador`
> rather than a bare `Guardado`, **precisely so nobody reads a cross-device guarantee into it.
> Supabase and accounts remain this ADR's eventual destination, opened once the editor itself is
> finished.**

Sprint 14 closed the editor and said so pillar by pillar. **The condition is met**, by that ADR's own
words, and this one does not have to argue for the opening — only for the shape.

### What exists today, counted rather than assumed

| Fact | How it was checked |
|---|---|
| **Zero authentication or database dependencies anywhere in the repository** | `grep -l "supabase\|drizzle\|next-auth\|bcrypt\|jose" --include=package.json` → empty |
| Supabase is approved and **nothing is built on it** | ADR 0012, 23 September; the grep above |
| The only persistence is `localStorage`, and photos in `IndexedDB` | `apps/editor/src/editor/autosave.ts`; ADR 0018 |
| `/` **is the questionnaire** | `apps/editor/src/app/page.tsx` |
| The editor says `Guardado en este navegador` | `es.json:352`, and `:353` `No guardado` |
| The visible tagline promises «**Sin registro**, sin tutoriales» | `es.json:7` |
| **There is no mockup of a landing page and none of a login.** None | `docs/design/mockups/`, `prototype/` → zero hits |
| The runbook has **1 of the 4 cases** Part 17 requires | `docs/runbook.md` |

So accounts are greenfield, and the one thing already written about them in the interface is a
promise that there is **no** registration.

### The platform question, re-checked with the price in front

David delegated this rather than answering it, and asked for a decision on project and cost grounds.
**The answer is that ADR 0012 already decided it correctly, and this is the re-check, not a new
decision** — one ADR, one decision, and the decision here is accounts.

Both platforms, because neither does the other's job:

- **Render alone cannot.** Render has no authentication product. Email+password *and* Google would be
  hand-written: password hashing, session cookies, reset mail, an OAuth callback, session expiry.
  That is a week of security-critical code in a repository that has zero lines of it today. More
  money and more code.
- **Supabase alone cannot.** Supabase does not host a Next.js server. The protocol puts that row on
  Next.js itself (`protocolo.md:164`): «Da en un solo despliegue las páginas públicas, el editor, **la
  autenticación** y los endpoints de Stripe.»
- **And the quality argument, which is the one that actually decides.** Supabase is Postgres **with
  Row Level Security**, so «you only see your own sites» is written *in the database*. Part 15 orders
  that «**la clave de servicio de la base de datos no se usa nunca desde el navegador**»; RLS is what
  makes that rule enforceable rather than trusted. Hand-rolled, the same rule lives in TypeScript,
  where one forgotten `where ownerId = …` leaks another person's site — a failure no demo reveals.

Cost: **0 € today**, both free plans. The lock-in question the protocol already asked and answered —
Supabase «se usa como Postgres, con Drizzle encima, **para no quedar atrapado**» (`:169`) — is
honoured by keeping migrations in the repository, so only Auth is Supabase-specific and the tables
leave with a `pg_dump`.

### What the dossiers decide about *when* the account appears

This is the constraint that shapes everything, and it is not the author's preference. The concept
dossier says of the registration screen:

> «**La cuenta se crea al final, cuando ya tiene una web que no quiere perder.**»

and screen 1 is «**sin registro previo** y sin barra lateral». The dossiers win over the code, and
the code already agrees: `es.json:7` promises «Sin registro».

**So a login built as a front gate would be a different product.** This ADR keeps the gate open.

---

## The decision

### 1. Accounts are released. Charging is not.

ADR 0021 deferred charging with an argument entirely about charging — a Stripe Price object, an
invoice template, a data processing agreement, «there is no transaction to describe until there is a
product worth the amount being decided» — and then swept accounts in through a **consequence**
(`0021:45-48`), where they are named but never argued:

> - Sprint planning treats charging, accounts and payment integration as **not scheduled**, the same
>   status ADR 0008 gives hosted publishing: no reactivation event, no date.

That asymmetry is the opening, and it is worth stating plainly rather than relying on: **nothing in
ADR 0021 argues that accounts have nothing to attach to.** Everything it argues is about a
transaction. Accounts have something to attach to — a finished editor and a site somebody does not
want to lose.

So: **accounts are released and ADR 0021's charging decision stands untouched**, with its six
billing questions still unanswered. None of the six blocks an account; every one of them names a
checkout screen, a Price object, an invoice, a webhook or the terms of use. The judgement about
whether the product is «profesionalmente vendible» is not made here and is not needed here.

### 2. The account is created at the end, and the login is for coming back

Four consequences, in order of the journey:

1. **The landing is public and asks for nothing.** «Empezar» goes to the questionnaire.
2. **The anonymous journey does not change by one step.** Questionnaire → editor → `localStorage`,
   exactly as today. Nobody using the application now meets a new screen in front of it.
3. **The account is offered at the end**, when there is a site to lose: «Guarda tu web en tu cuenta».
4. **The login exists for coming back**, not for getting in.

And therefore **the tagline «Sin registro, sin tutoriales» stays true and is not withdrawn.** That
sentence is a promise, not a description of a limitation, and this ADR keeps it.

### 3. Everyone gets an account, and there are two ways in

Email+password **and** Google, both, per David's answer. Supabase Auth provides both; the protocol
already approved the mechanism in its own stack row (`:169`), «Supabase (Postgres + **Auth** +
Storage)», so this ADR chooses no new library.

The session is verified **on the server**. The database service key never reaches the browser —
Part 15, third bullet — which is also why RLS and not a route check is the enforcement point (§7).

### 4. Google stays in testing mode, and the blocker is the domain, not the policy

David asked for this to be checked on day 1 rather than assumed, and the check changed the answer.

To leave testing mode, Google requires a homepage **hosted on a verified domain you own**, which
describes the application and **may not be only a login page**, plus links to a privacy policy *and*
terms of use, plus verification of every domain involved.

**The free Render URL is `*.onrender.com`, which is not ours and cannot be verified, and the project
has no domain** — ADR 0008 withdrew hosted publishing with no plan and no date. So writing a privacy
notice does **not** unblock Google. The blocker is a domain nobody has bought.

**Decision: Google sign-in ships in testing mode, and the reason is written here so nobody re-derives
it.** Testing mode allows up to **100 test users** added by email address, which is exactly the
«probar la app con el menor presupuesto posible» this sprint is for.

**And the one trap in testing mode is closed by design.** Google expires refresh tokens from
unverified apps after **7 days**. It does not touch our session, because Supabase Auth issues **its
own** refresh token, independent of the provider's, and Google does not send its own unless asked.
So this is a rule for day 3, not a risk to monitor: **`access_type: offline` is never requested and
`provider_token` is never stored.** Google identifies a person at sign-in and nothing more. If
continued access to a Google API is ever wanted, that is a new decision and this paragraph is where
it starts.

### 5. What is stored, and what stays in the browser

**The documents travel; the photos stay** — David's answer, with photos scheduled for sprint 16.

That has a consequence that must be **shown and not discovered**: if the document travels and the
photos do not, **a site opened on another computer appears without its photos.** So the interface says
what is where (§10). This is the project's own rule that the interface never claims what is not true.

### 6. The document is stored whole, as `jsonb`

`document-rules.md` forbids database concerns from entering the document; the symmetry is that the
database does not take the document apart. One row per site, the document inside it, and
`schema_version` beside it so the migrations already in `packages/schema/migrations/` keep running on
read.

**And the four keys the document rejects now have a real destination.** `document-rules.md:374-387`
sends `ownerId`, `locked`, `paymentStatus` and `subscription` to «The database». This sprint creates
**`ownerId`**, because there is a verb that uses it. **`locked`, `paymentStatus` and `subscription`
are named as destinations and not created**: a column with no verb is an invalid state waiting. Locking
and the transfer of ownership are the advanced dossier's §8 and deserve their own sprint.

### 7. Row Level Security is the enforcement point, not the route handler

For the reason in the context, and because Part 15 requires it. The policies are **tested as code**:
a test authenticates as a second person and asserts the first person's site **does not exist for
them** — not readable, not writable, not listable.

### 8. A stale write is refused, not merged

The advanced dossier assumes that «**dos personas pueden abrir la misma web a la vez**», and nothing
in the repository decides what happens when both write. Two tabs of one person are enough to cause it.

**Every save carries the version it read, and the server refuses a stale write** with a message that
says what happened. Preventing the invalid state, rather than adding interface to repair it. A
collaborator role is deferred (§«What this does not decide»), but the refusal is not, because the
single-owner case already produces the conflict.

### 9. An anonymous site never overwrites, and is never overwritten

David's adjustment, and it closes a data-loss hole the plan had left open.

**If there is an anonymous site in the browser and the account already has one, neither is
overwritten.** The anonymous site is offered as a **new** site. Creating an account, or signing into
an existing one, is never an operation that can cost somebody a site they had.

### 10. What `Guardado en este navegador` becomes

ADR 0012 tied that string to the guarantee deliberately, «precisely so nobody reads a cross-device
guarantee into it». The guarantee changed, so the string changes — and it changes into something that
says **what is where**, because of §5:

- With no account: `Guardado en este navegador`, unchanged.
- With an account: the site is in the account **and the photos are only in this browser**, said in
  the indicator rather than in a help page.
- `No guardado` stays exactly as ADR 0018 requires: a tick that has not been earned is not shown.

The exact Spanish goes in `locales/es.json`, never inline in a `.ts`.

### 11. The design-tools switch moves to the account, as ADR 0025 said it would

ADR 0025 wrote the migration before there was anywhere to migrate to (`0025:74`): «**When accounts
arrive, that module is the one file that moves.**» The file is
`apps/editor/src/editor/designTools.ts`. Depth is a property of the person — «del mismo rango que el
idioma de la interfaz» — so with an account it lives in the account. **Without an account it stays in
this browser exactly as today**, because the anonymous journey does not change.

### 12. Deletion that really deletes, and its grace window is 30 days

Part 15's `:1075` is **the only clause in the whole protocol written specifically about accounts**:

> - Borrado de cuenta que borre de verdad, con una ventana de gracia razonable.

It appears in no task list, and «razonable» is quantified nowhere. **This ADR sets it at 30 days**:
long enough to undo a decision made in anger or by mistake, short enough to honour «guardarlo el
menor tiempo posible». After it, the rows are gone, and the test proves it by looking for them and
not finding them.

**And export works before deleting, and always** — §18.

### 13. The privacy notice arrives with the account; the three documents stay pegged to the first euro

Part 15 pegs «aviso legal, política de privacidad y condiciones de uso» to «**antes de cobrar el
primer euro, no después**». Accounts arrive before the first euro and **store an email**, which is
personal data. By the letter of the protocol the three documents are not due yet.

**David's decision, and it is his and not the author's: the brief privacy notice at the moment of
account creation is in this sprint's scope.** The three full legal documents stay pegged to the first
euro, where ADR 0021 and `billing-questions.md` leave them.

Note what this does **not** unblock: it does not get Google out of testing mode (§4), because that
needs a domain.

### 14. Supabase and Render are data processors, and the region is the EU

David's adjustment, and it is the clause that makes the previous one real rather than decorative.

- **The Supabase project is created in an EU region**, matching the Frankfurt that ADR 0012 already
  requires of Render so the two are not talking across Europe.
- **Supabase and Render are named here as data processors** («encargados del tratamiento») for the
  personal data an account holds, because a privacy notice that does not say who processes the data
  is not a privacy notice.
- **Accepting their data processing agreements is a direction task**, recorded here so it is tracked
  rather than assumed. No code waits on it; the notice's accuracy does.

### 15. The free plan's costs, named, and what triggers paying

The application sleeps after ~15 minutes on Render's free plan and takes about a minute to wake —
already written in ADR 0012 and in `render.yaml`. **Until today nobody had a URL to open cold. A
landing page is exactly the cold visit.**

This is not hidden. Day 5 measures both cold starts and writes the numbers down, and **the trigger for
leaving the free plan is named: when the URL is given to a real prospect.** `render.yaml` already
records that moving plan is changing one line, «no migration».

**And the reason 0 € is tolerable is not optimism:** client sites depend on nothing of ours (ADR 0001,
and ADR 0012: «Published client sites are unaffected… This is the reason a free tier is tolerable at
all»). If our application sleeps, no published site goes down.

### 16. The free plan has no backups, and this ADR does not pretend otherwise

Checked rather than assumed, because Part 16 requires «copia diaria automática **y una restauración de
prueba al mes**. Una copia que no se ha restaurado nunca no es una copia, es una esperanza.»

**The Supabase free plan has zero days of backup retention.** Automated daily backups begin on the Pro
plan (~25 $/month). The free project is also **paused after one week of inactivity** — frozen, not
erased, with a one-year window to restore it, and that is itself a runbook case.

**So Part 16 is not satisfied by the free plan, and saying so is the decision.** Day 6 **proposes** a
scheduled backup, encrypted and held in the EU, and **does not run it until David approves it** — his
adjustment, and the right shape, because a backup is a copy of personal data and where it lives is
his call and not the author's.

### 17. The audit log Part 17 requires, with only what can actually happen yet

Part 17: «Registro de las operaciones que importan: publicación, pago, transferencia de propiedad,
desbloqueo. **Quién, cuándo y sobre qué web.**»

Of those four, exactly one can happen this sprint: since ADR 0008, «publicar» **means delivering the
files**, which is the download. So the table is created with the four reserved, and this sprint writes
two kinds of row — **the download, and the account's lifecycle** (created, deleted). The download is
logged **when there is a session and never by requiring one**, which §18 explains.

### 18. Export always works, and it beats everything else in this file

Part 16's three technical rules, and its tiebreak: «Si alguna vez una decisión técnica choca con una
de estas tres, gana la regla.» The first is «**La exportación siempre funciona**, incluso con la
cuenta caducada o en disputa».

**So `/api/download` may never require a session.** Not for logging, not for a quota, not for
convenience. Day 7 asserts it, and if anything in this ADR ever collides with it, this ADR loses.

### 19. Phase 4's «áreas privadas con login» is not this login

Written because the word is the same and a future reader will conflate them.

Phase 4 is a private area **on the client's own website**, with «datos personales de los clientes de
nuestro cliente» (advanced dossier §10) — and ADR 0001 explains why it is a different thing
altogether: «**A login is not a file, so such a site cannot be downloaded and must live with us.**»

A Retorika account is launch-product infrastructure: «**La web pertenece a una cuenta**» (advanced
dossier §8), «la cuenta profesional es gratis en el lanzamiento». **Phase 4 is not opened here**, and
its «antes de escribir una línea de esta fase, un ADR» does not gate this sprint.

### 20. There is no mockup, so this ADR is the specification

`protocolo.md:971` makes the mockups the interface specification — «Las maquetas son la especificación
de la interfaz: la maquetación, los textos en castellano, los colores y los gestos ya están
decididos» — and **there is no mockup of a landing page and none of a login.**

No mockup is invented and none is back-dated. **For these two screens, this ADR and the sprint's
pull requests are the specification**, Spanish copy included, the way `docs/design/REVIEW.md` records
an ADR overruling the design. If a mockup is ever drawn, it inherits from here.

---

## What this does not decide

- **Charging.** ADR 0021 stands, with its six billing questions unanswered.
- **Who declares the product «profesionalmente vendible».** ADR 0021 says direction; ADR 0031 moved the
  sibling judgement to David without saying whether this one moved. It is a one-line decision and it is
  not this one.
- **Locking and the transfer of ownership** — advanced dossier §8, six concrete promises, deferred by
  name in ADR 0025 and deferred again here. It needs its own sprint.
- **The collaborator role**, and anything with two people on one site beyond refusing a stale write.
- **Photos on the server** — sprint 16. This sprint says so in the interface.
- **Collections shared between documents**, which ADR 0033 sent here. The account now exists to hang
  them on; the feature is not built this sprint.
- **Private areas with login** — phase 4, a different login, its own pricing model.
- **Transactional mail beyond password reset.** Resend is the protocol's row for «accesos de cliente,
  facturas y avisos»; Supabase's own mail covers reset on the free plan, with a send limit, and Resend
  waits for a reason to exist.

---

## Consequences

- **ADR 0012's third note is discharged** and its destination reached. The `Guardado en este
  navegador` string it protected changes, by §10, and the ADR that protected it says why.
- **ADR 0021 is amended, not superseded**: its accounts consequence is released, its charging decision
  stands. The backlog row that points at it splits in two.
- **ADR 0019's Part 15 amendment is falsified and re-written.** «A published site may carry its own
  owner's identifying details, put there by the owner, and **Retorika stores none of them**»
  (`0019:85`) stops being true the moment an account holds an email. The closing pull request replaces
  that sentence with what becomes true, rather than leaving the contradiction implicit.
- **Part 15 gains the account clauses** it only half has: the privacy notice's timing (§13), the
  processors and the region (§14), and the 30-day grace window that `:1075` demanded and never
  quantified (§12).
- **Part 16 is recorded as unmet by the free plan** (§16), with a proposal and not a pretence.
- **Part 17's audit log exists** for the first time, with two of its four operations possible (§17).
- **The runbook grows past one case of four.** «El editor no guarda» becomes a real failure now that
  there is a server that can fail; «una migración a medias» arrives with the project's first database
  migration; and a paused free project is a third.
- **`document-rules.md:374-387` stops pointing at a database that does not exist.** One of its five
  keys becomes a column, three stay destinations, and `designTools` moves to the account exactly as
  ADR 0025 predicted (§11).
- **Nothing in `packages/` changes**, as ADR 0012 promised: the renderer, schema, catalog and publisher
  run anywhere. **The golden corpus does not move**, and day 7 asserts the ZIP is unchanged.
- **`.env.example` is added** — names and not one value — which Part 15 requires and the repository does
  not have today. No key passes through the chat: David pastes them into Render and Supabase.
- **Google ships in testing mode with a 100-user cap** (§4), and leaving it is blocked on buying a
  domain, which is a direction decision this ADR does not make.
