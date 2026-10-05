import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A page that redirects on the server must never be prerenderable, and this is the guard.
 *
 * **The trap, met on 5 October 2026.** Adding a server-side session gate to `/cuenta` and
 * `/mis-webs` — `if (!(await currentViewer())) redirect("/entrar")` — looked right, typechecked,
 * and broke both screens completely. At build time no `NEXT_PUBLIC_SUPABASE_*` is set, so
 * `currentViewer()` returned null, the `redirect` ran **during prerendering**, and Next baked the
 * answer into the output: `.next/server/app/cuenta.meta` came out as
 * `{"status": 307, "location": "/entrar", "x-nextjs-prerender": "1"}`. In production that is a
 * permanent redirect served to everybody, signed in or not.
 *
 * Nothing in `tsc`, `biome` or the test suite had anything to say about it; it was found by reading
 * the build output. So the rule is asserted here instead of remembered: **if a page calls
 * `redirect`, it declares `force-dynamic`.**
 *
 * Checked by reading the sources rather than by building, because a build is far too slow to put
 * in front of every commit — and the mistake is visible in the source, which is where it is cheap
 * to catch.
 */

const APP = join(import.meta.dirname, "..", "src", "app");

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFiles(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

describe("every page that redirects on the server", () => {
  it("declares force-dynamic, so the redirect is not baked into the build", () => {
    const offenders: string[] = [];
    for (const file of pageFiles(APP)) {
      const source = readFileSync(file, "utf8");
      // `redirect(` from next/navigation, called in the page itself rather than imported for a
      // client component's use — a page that does not import it cannot have called it.
      const redirects = /from "next\/navigation"/.test(source) && /\bredirect\(/.test(source);
      if (redirects && !/export const dynamic = "force-dynamic"/.test(source)) {
        offenders.push(file.slice(file.indexOf("apps/editor")));
      }
    }
    expect(
      offenders,
      "these pages redirect on the server and could be prerendered into an unconditional redirect",
    ).toEqual([]);
  });

  it("finds the pages it is supposed to be checking", () => {
    // A guard that silently matches nothing passes for ever. This is the assertion that the
    // directory walk and the pattern still agree with how this app is laid out.
    const gated = pageFiles(APP).filter((file) =>
      /export const dynamic = "force-dynamic"/.test(readFileSync(file, "utf8")),
    );
    expect(gated.length, "no page declares force-dynamic — has the gate been removed?").toBe(3);
  });
});
