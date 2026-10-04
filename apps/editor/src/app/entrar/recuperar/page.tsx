import { Suspense } from "react";
import { authConfigured } from "@/auth/env.ts";
import { ResetRequestForm } from "@/auth/forms.tsx";
import es from "@/locales/es.json" with { type: "json" };

export const metadata = { title: es["auth.reset.title"] };

/**
 * Whether sign-in can work is decided on the server and handed down as a boolean, so the browser
 * never needs to look at configuration to find out. The screen renders either way — a form
 * nobody can submit is still readable and tabbable, which is what the e2e suite walks with no
 * Supabase project configured — and says so plainly rather than failing on a missing variable.
 */
export default function Page() {
  return (
    <Suspense>
      <ResetRequestForm configured={authConfigured()} />
    </Suspense>
  );
}
