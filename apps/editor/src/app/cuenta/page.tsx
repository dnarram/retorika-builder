import { redirect } from "next/navigation";
import { AccountPage } from "@/account/AccountPage.tsx";
import { currentViewer } from "@/auth/session.ts";
import es from "@/locales/es.json" with { type: "json" };

export const metadata = { title: es["account.page.title"] };

/**
 * **Never prerendered, and this line is load-bearing.**
 *
 * Without it Next prerenders this page at build time, where no `NEXT_PUBLIC_SUPABASE_*` is set —
 * so `currentViewer()` returns null, the `redirect` below runs **during the build**, and the
 * output is a baked 307 to `/entrar` served to everybody for ever, signed in or not. That is not a
 * theory: the first attempt at this gate produced exactly that, and
 * `.next/server/app/cuenta.meta` said `"status": 307, "x-nextjs-prerender": "1"` in as many words.
 *
 * A page that decides what to show from who is asking must be rendered when somebody asks.
 */
export const dynamic = "force-dynamic";

/**
 * **The session is checked here, on the server, before any of this renders.**
 *
 * It used to be checked only inside the client component, which meant the HTML went out first and
 * the redirect happened once JavaScript had loaded and asked — so for a moment a visitor with no
 * session saw the shell of a screen that is not theirs, and on `/cuenta` that shell contains
 * «Borrar mi cuenta». `auth/session.ts` was written for exactly this and **nothing had ever called
 * it**, found auditing the project on 5 October 2026.
 *
 * `currentViewer` uses `getUser`, which verifies the token against the auth server rather than
 * believing a cookie. The client component keeps its own check: this one is the gate on arrival,
 * that one notices a session that expires while somebody is still on the page.
 *
 * Reading the session makes this route dynamic, which is what it should always have been — a page
 * whose contents depend on who is asking has no business being prerendered. The landing stays
 * static and untouched (`docs/tasks/arranque-en-frio.md`).
 */
export default async function Page() {
  if (!(await currentViewer())) redirect("/entrar");
  return <AccountPage />;
}
