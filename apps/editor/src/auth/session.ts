import { serverClient } from "./clients.server.ts";
import type { Client } from "./clients.ts";
import { authConfigured } from "./env.ts";

/**
 * Who is asking, decided on the server.
 *
 * **`getUser` and never `getSession`.** `getSession` reads the cookie and believes it; `getUser`
 * asks the auth server to verify the token's signature. A cookie is something the browser sends,
 * which means it is something a browser can edit, so the first is a claim and the second is a
 * fact. Everything that decides what somebody may see uses this one.
 *
 * Null rather than a throw when there is no session, because "nobody is signed in" is the
 * ordinary state of this application: ADR 0034 §2 keeps the whole questionnaire anonymous and
 * offers the account at the end.
 */
export interface Viewer {
  id: string;
  email: string | undefined;
}

export async function currentViewer(): Promise<Viewer | null> {
  if (!authConfigured()) return null;
  return viewerFrom(await serverClient());
}

/** The same question of a client that already exists — which is what makes it testable. */
export async function viewerFrom(client: Client): Promise<Viewer | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}
