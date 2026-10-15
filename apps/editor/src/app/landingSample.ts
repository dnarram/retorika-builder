import { type Answers, EMPTY_ANSWERS, generate, VARIANTS } from "@retorika/generator";
import { render } from "@retorika/renderer";
import { flattenElements } from "@retorika/schema";
import { withPhotoUrls } from "../editor/previewDocument.ts";

/**
 * **The landing's hero is a real web, built by the thing the landing is selling.**
 *
 * David's brief for sprint 22 asked the three screens before the editor to look like a page made
 * in 2026, and asked for it «con lógica». The one illustration this product can honestly put at
 * the top of its landing is its own output: the page below is `generate()` + `render()`, the same
 * two functions the questionnaire calls, on the same sample business
 * `packages/publisher/test/lighthouse.browser.test.ts` audits — «Taberna del Puerto», the sector
 * with photographs in the bank. Nothing is drawn by hand and nothing is a mock-up, which is what
 * lets the caption say what it says.
 *
 * **Why this is a module and not a few lines inside `page.tsx`:** it has to stay on the server.
 * `@retorika/generator` and `@retorika/renderer` are the two heaviest packages in the repository
 * and neither has any business in a browser bundle — the client gets the finished string and
 * nothing else. Keeping it here also keeps `page.tsx` free of imports that would quietly become
 * client code the day somebody adds `"use client"` to it (protocol Part 15; `pnpm secrets:scope`
 * is the guard for the serious version of that mistake).
 *
 * **It reads nothing, so the landing stays prerendered.** No session, no `cookies()`, no database
 * — the one property `page.tsx`'s own docblock exists to protect, because it is what keeps the
 * Render static-site option open (`docs/tasks/arranque-en-frio.md`). `generate` is deterministic
 * by `INV_5`, so this runs once at build time and the same bytes are served to everybody.
 */

/** The composition: «Con foto grande», which is also the one the proposals recommend. */
const HERO_VARIANT = VARIANTS[1];

/**
 * The sample business, the same one two other suites already measure.
 *
 * Reused rather than invented so that there is exactly one sample site in this repository: the
 * weight budget weighs it, Lighthouse audits it, and now the landing shows it. A second set of
 * answers would be a second thing to keep plausible.
 */
const HERO_ANSWERS: Answers = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna del Puerto",
  sector: "restaurante-bar",
  services: ["Comidas", "Cenas", "Terraza"],
  address: "Muelle 3, Ronda",
  mainAction: "book",
  bookingLink: "https://reservas.example.com/taberna",
};

/**
 * The hero's page, as one self-contained HTML string ready for an `iframe srcDoc`.
 *
 * **The photographs are swapped for the route that serves them**, through the same
 * `withPhotoUrls` the editor's preview and the three proposals use. A generated document names its
 * photographs the way the ZIP will (`muestra-restaurante-bar.03.webp`), and a relative name inside
 * an `iframe srcDoc` resolves against *this* page's URL — so without the swap the hero would show
 * the one thing worse than no photograph, which is a broken one. `/api/muestras/<id>` is public and
 * immutable-cached, which is the whole reason it can serve a landing.
 *
 * The fonts need no swap: the renderer emits `url("fonts/<file>")`, which resolves against the
 * editor's own origin, where `app/fonts/[file]/route.ts` answers — the fix sprint 13 made for the
 * editor's canvas, inherited here for free.
 */
export function landingSampleHtml(): string {
  const site = generate(HERO_ANSWERS, HERO_VARIANT);

  const photoUrls = new Map<string, string>();
  for (const page of site.document.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        const value = element.value;
        if (value?.kind !== "image" || value.sample === undefined) continue;
        photoUrls.set(value.src, `/api/muestras/${value.sample}`);
      }
    }
  }

  return render(withPhotoUrls(site.document, photoUrls), "html").html;
}
