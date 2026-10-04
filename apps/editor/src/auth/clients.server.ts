import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Client } from "./clients.ts";
import { publicConfig } from "./env.ts";

/**
 * The server's Supabase client, for a route handler, a server action or a server component.
 *
 * It reads the request's cookies itself rather than taking them as an argument. The first version
 * of this took a hand-rolled `CookieStore` interface, which was a second definition of a type
 * Next already owns — and `tsc` refused it, because the real store's `set` is overloaded in a way
 * no simplified copy matches. Reading `cookies()` here is both shorter and the documented shape.
 *
 * Same anon key as the browser client: the policies decide, not the key.
 *
 * `setAll` is wrapped because a server *component* cannot write cookies — Next throws — and that
 * is not worth propagating: the token it wanted to refresh will be refreshed by the next request
 * that can write, and a route handler and a server action both can. This is the one place in this
 * package where swallowing is correct, and it is written down so it does not read like the silent
 * fallback the style guide forbids.
 */
export async function serverClient(): Promise<Client> {
  const { url, anonKey } = publicConfig();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // A server component. See above.
        }
      },
    },
  });
}
