# 0054 — A published site carries its own icon

**Status:** proposed · **Date:** 2026-10-26 · **Decided by: David, 26 October 2026**, approving the
sprint 28 plan — «favicon dentro, acotado, con ADR» — with one adjustment of his own: letters and
digits by Unicode property, and a disc with no letter when the name has none · **Recorded by
development, which does not sign** · **Relates to:** [ADR 0001](0001-static-published-sites.md) (the
page opens from a disk with no server), [ADR 0029](0029-what-a-published-page-says-about-itself.md)
(the head's other tags, and the rule that a tag naming a bundle file is emitted only inside a
bundle), [ADR 0041](0041-the-proposals-start-neutral-and-the-palette-is-chosen-afterwards.md) (the palettes the colours
come from) · **Touches:** `packages/renderer` (one `<link>` in the head of a bundled page, and the
icon's text) and `packages/publisher` (one file at the bundle's root). **The golden corpus does not
move** — see §4.

## Context

A downloaded site had no icon. Every browser that opened one asked for `/favicon.ico`, the bundle
had none, and the visitor's tab showed the browser's blank page. Lighthouse counted the 404 as a
console error: **best practices 96** on all three compositions since it was first measured on
sprint 18 day 2, and the backlog's Lighthouse row named the favicon as the whole of the missing four
points. `docs/tasks/publisher.md` had put favicons in «phase 2» with the rest of the SEO-adjacent
head; ADR 0029 built the rest and left this.

The brand's own favicon (`apps/editor/public/`) is Retorika's and is the editor's; it never belongs
in a client's site ([ADR 0015](0015-interface-tokens-are-not-the-sites.md)'s boundary). A client's site has no logo the renderer can draw yet — the
questionnaire captures one only to choose a palette, and keeps nothing of it. So the icon has to be
made of what every document already has: a name and a theme.

## Decision

**§1 — The letter.** The first code point of the business name that is a letter or a digit by
Unicode property (`\p{L}`, `\p{N}`), after NFC, uppercased in Spanish and cut to one code point.
«¡Hola!» is H, «"La Tasca"» is L, «#1 Pizzas» is 1, «Ñandú» is Ñ, «ß» is S. A name with no letter or
digit gets **the disc alone** — never a placeholder glyph, which would be a letter the business does
not have. `faviconLetter` in `packages/renderer/src/favicon.ts`; the unit test holds every example
above.

**§2 — The colours.** The letter in `color.surface` on a disc of `color.primary`: the button's own
pair, one of the five `CONTRAST_PAIRS` that `packages/tokens` proves at 4.5:1 or more in every
palette. A logo chooses among those palettes and never invents one, so there is no theme this
product publishes in which the letter does not read. The renderer's test asserts the pair is in the
proved list, so moving either side of it is caught there and not in a tab.

**§3 — The font, said honestly.** The letter is drawn in `system-ui, sans-serif` — the visitor's own
system face, not the site's heading font. A favicon is loaded as an image, and an image cannot fetch
web fonts; drawing the site's face would mean outlining the glyph, which needs a font parser in the
renderer, and the renderer's dependency allowlist exists to refuse exactly that. So a site set in a
serif shows a sans letter in its tab. It is the honest version, not a defect waiting for a fix.

**§4 — One file, one link, and only inside a bundle.** `buildSite` writes `favicon.svg`
(`image/svg+xml`) at the bundle's root, once, and every page carries one
`<link rel="icon" type="image/svg+xml" href="favicon.svg">` right after its `<title>`. Every page
lives at the root (`index.html`, `<slug>.html`, an entry's `<slug>.html`), so one relative link holds
for all of them, served or opened from a disk. The name is `FAVICON_PATH`, exported once and read by
both sides, so the link and the file cannot disagree.

The link is emitted **only when the page has a `pagePath`** — the rule ADR 0029 set for `og:url`. With
no `pagePath` there is no bundle and no file: the editor's live preview, the landing's sample, and
the golden corpus. A link there would name a file that does not exist against whatever origin the
page was opened from. **This is why the golden corpus does not move**, where the plan expected it to
move once: the corpus renders without a bundle. What the goldens would have shown is covered instead
by `publisher/test/site.test.ts`, which builds every fixture and asserts the file, its bytes, its type
and exactly one link per page.

**§5 — Not in the manifest.** The manifest is what `apps/serve` needs, and serve resolves any path in
the bundle; the icon needs nothing from it, so it is not listed there.

**§6 — The double-click test learns that a `<link>` loads.** `publisher/test/double-click.test.ts`
draws its line between what a page loads (must be a file in the bundle) and where it navigates (may
leave). A `<link href>` is a load, so it is now read as one; sabotaged — the file renamed in the
bundle — it names every page whose icon «names no file in the bundle».

## Measured (26 October 2026)

- Lighthouse, mobile preset, the three compositions and a page drawn per entry: **best practices 100**
  on all four, where it was 96; performance 100 / 99 / 99 / 100, accessibility and SEO 100.
  `lighthouse.browser.test.ts` now asserts best practices at full marks. Sabotaged with the file
  renamed, it is 96 again and the test fails naming the composition.
- The icon is **258 bytes** with a letter and 114 without; every page gains one line. `pnpm size` passes unchanged.

## What this does not decide

- **Safari.** Whether Safari draws an SVG favicon is not established here: published sources from
  2021 to 2026 disagree, and nobody has opened a downloaded site in Safari on a device. If it does
  not, a Safari visitor sees what every visitor saw before this ADR. The next step, if David's iPhone
  says so, is a PNG beside the SVG, which needs a rasteriser at build time.
- **The owner's logo as the icon.** The document keeps no logo. That arrives with a logo the
  document stores, and a PNG path for it.
- **`apple-touch-icon`, a dark-mode variant, `manifest.webmanifest`.** None was asked for.

## Consequences

- Every downloaded ZIP carries one more file and every page one more line. The sprint 28 close's ZIP
  diff must differ from the sprint 27 one by exactly that.
- A theme change or a renamed business changes `favicon.svg`'s bytes, which is what an icon made of
  them should do; nothing else moves with it.
