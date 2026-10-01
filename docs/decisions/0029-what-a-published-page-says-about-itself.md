# 0029 — What a published page says about itself when it is shared

**Status:** **accepted** · **Date:** 2026-10-02 ·
**Decided by:** David, 2 October 2026, approving the sprint 12 plan — every choice below is his
answer to a question, and three of them are corrections to what development had proposed ·
**Accepted by:** **David, 2 October 2026 — not direction** ·
**Touches:** [ADR 0001](0001-static-published-sites.md) (the static, offline promise),
[ADR 0008](0008-hosted-publishing-has-no-plan.md) (why there is no origin to assume),
[ADR 0022](0022-a-page-is-born-by-converting-a-section.md) (the derive-don't-copy principle this
borrows), the backlog's «minimum SEO» row, and protocolo Part 14's Fase 2 — «lo mínimo de SEO»

> **Signed on the day after it was written, and the gap is left visible on purpose.** This file went
> up as `proposed` with the day 1 pull request, because the decisions in it were David's — he
> answered four questions while approving the sprint plan and then sent three corrections — but he
> had not read *this file*, and development does not sign on anybody's behalf. That is the same line
> sprint 10 day 2 drew («none of them is mine to sign») and sprint 11 day 3 crossed only on «Dentro,
> y la firmo yo». He read it and accepted it with the day 2 branch.
>
> **«Accepted» here means David, not direction**, the same as ADRs 0026, 0027 and 0028. It is said in
> the header rather than left to be inferred, because an accepted ADR gets cited afterwards by people
> who were not in the room. **Direction has not looked at it** — and this one spends bytes on every
> page a client downloads and leans on ADR 0001, which is direction's constraint.
>
> **Why this is one ADR and not three.** The decision is *what a published page says about itself
> when somebody shares it*. The owner's description, the origin field and the image rules are not
> three decisions — they are one decision and the two mechanisms it cannot be built without. One
> ADR, one decision.

## Context

### What a published page carries today

Measured on the corpus, not recalled: `pageToHtml` (`packages/renderer/src/html.ts`) emits exactly
four things inside `<head>` — `charset`, `viewport`, `<title>`, and the inlined `<style>`. Nothing
else. There is no `description` and no Open Graph of any kind.

So a site shared on WhatsApp or Facebook — **which is how a neighbourhood business is actually
passed around** — previews as a bare link: no summary, no image. For a product whose entire promise
is a finished site in under ten minutes, the first thing anyone does with that site is share it, and
that is the moment it looks unfinished.

The sprint 11 plan named this «el último punto de código de la fase 2». It had no ADR, and the
backlog said so: the first thing it needs is a decision about **where a description comes from**.

### Why the obvious answer is not good enough on its own

The obvious candidate is the cover's subheadline. The backlog already wrote the objection: it is
«a sentence written to be read on the page rather than in a search result». It is also `0..1` on
the cover preset — optional — so it is not even guaranteed to exist.

### The premise that did not hold, and what it changed

Development proposed gating the image tags on «the document having a `baseUrl`». **The document has
no `baseUrl`.** It is an option of `buildSite` (`packages/publisher/src/site.ts`, whose own comment
reads «Omitted for a download: a ZIP has no URL, and sitemap.xml is then not emitted»), and the
download route does not pass it (`apps/editor/src/app/api/download/route.ts`).

With hosted publishing on hold and no plan (ADR 0008), **the download is the only way a site ever
reaches anybody.** So that gate, written as proposed, would have meant `og:image` was never emitted
by this product at all — a rule that reads like a safeguard and is really an off switch. Checking it
before writing it is what produced §3.

## The decision

### 1. The description is the owner's, and it is derived rather than copied

- The document carries an optional `siteDescription`. **It starts empty** and only ever holds a
  sentence the owner wrote.
- The renderer emits `siteDescription` or, failing that, **the cover's subheadline**.
- The editor's field shows the subheadline as a **suggestion** — a placeholder — never as a value.

**Why derived and not copied, which is the correction that improves this most.** A field that is
born pre-filled with a copy of the subheadline is stale the first day somebody edits the subheadline,
and then there are two sentences and neither one governs. Deriving at the moment of publishing
cannot go stale. **This is ADR 0022's own principle** — the teaser derives from the section it
points at precisely so there is nothing to synchronise — applied to a second place.

It also means nobody has to understand what a meta description is in order to get one.

**And the chain can end empty.** The cover's `subheadline` is `0..1`. No `siteDescription` and no
subheadline means **no `description` tag at all**, which is correct: an empty description is worse
than none, and inventing a sentence from the business name would be the product writing copy nobody
reviewed.

### 2. `description` and `og:title` always. `og:image` and `og:url` only with an origin

`og:title` needs nothing the page does not already have. `og:image` and `og:url` need an **absolute**
URL — WhatsApp and every other scraper reject a relative one — and a ZIP does not know what domain it
will be opened under. So they are gated, and §3 is what opens the gate.

### 3. The origin is a field of the owner's, with five conditions

Not an option of the build: a field in the document, which is the only way a *downloaded* site can
carry one.

| Condition | |
|---|---|
| **Optional** | Empty is not an error and blocks nothing. No gate, no warning dialog, no refusal to download |
| **One line of help** | «Si ya sabes la dirección de tu web, escríbela y al compartirla saldrá con foto; si la cambias, vuelve a descargar» |
| **`https://` only** | `midominio.es` and `www.midominio.es` are **normalised** to `https://…` and **the result is shown**, so the owner sees what will be published. A path is rejected; `http://` is rejected |
| **`og:image` is the real path** | The origin plus the cover photo's actual path in the ZIP, with a test that the file **is in the bundle** |
| **A weight warning** | See §5 |

**Why the schema gets its own origin check instead of reusing the publisher's.** `assertOrigin` in
`packages/publisher/src/site.ts` accepts `http:` as well as `https:`, which this field must not; and
schema may not import publisher — that would reverse the dependency arrow the whole package rests on.
So there are two checks with two purposes, and it is written here rather than left for somebody to
find in three months and assume was an oversight.

### 4. `og:image` has three more refusals, and they are not three separate cases

Beyond needing an origin, the cover image must be a **bitmap that travels in the ZIP**:

- **Never a `data:` URI.** There is no path to make absolute. A `data:` image is inline in the HTML
  text, not a file.
- **Never an SVG.** Scrapers reject it; a preview card that renders nothing is worse than a link
  with no card.
- **Never the grey marker.** Publishing an empty placeholder as the shop window of a business is
  worse than publishing no image.

**And a measurement worth writing down: the three are not disjoint.** The marker
(`packages/catalog/src/placeholder-image.ts`) is a `data:` URI whose payload is an SVG, so it is
already excluded twice by the first two rules. It still gets a test of its own, because the rule
that protects it today is incidental: if the marker ever becomes a real file at a path — which the
photo bank filling up could easily make tempting — the first two rules stop covering it and only a
test named after it would notice.

### 5. The weight warning

If the cover photo is heavy for a preview — **orientatively more than 300 KB** — the domain field
says so in one line, and **blocks nothing.**

That is this product's standing rule rather than a new one: the placeholder text warns, and a dead
link blocks the download. A heavy photograph makes a slow preview card, not a broken site.

## What this does not decide

- **Nothing about hosted publishing.** ADR 0008 stands. `buildSite`'s own `baseUrl` is what a
  sitemap needs and this field is **not** that and does not become it: one is where the site will
  live, the other is where this build is being served from. Conflating them would put a sitemap in a
  ZIP.
- **Nothing about structured data, `keywords`, or anything else in `<head>`.** The minimum is the
  minimum.
- **Nothing about a preview image that is not the cover photo.** Choosing a different one is a field
  and a decision this does not take.

## Consequences

- **Every published page's `<head>` changes, so the golden corpus regenerates** — fifteen files in
  one diff, which is exactly the case the corpus exists for.
- Each page gains a few hundred bytes. The budget is 60 KB gzipped and the corpus sits at 1.6–2.5 KB,
  so there is room; `pnpm size` confirms rather than assumes it.
- **An owner with no domain gets a description and no preview image**, and the field is what tells
  them why. That is the honest half of §2: the product does not pretend to a capability that needs
  something it was not given.
