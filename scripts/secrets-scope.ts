import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * The server/browser line, checked rather than trusted (protocol Part 15).
 *
 * «**La clave de servicio de la base de datos no se usa nunca desde el navegador.**» That is a
 * rule about a boundary nobody can see in a diff: in Next, a module becomes client code because
 * something marked `"use client"` imports it, possibly four files away, and the bundler says
 * nothing. So this walks the import graph the way `renderer-deps` guards ADR 0001's allowlist —
 * the same idea, one directory over.
 *
 * Three things fail the build:
 *
 *   1. A `"use client"` module that can reach, through any chain of local imports, a module that
 *      reads a secret environment variable or talks to the database directly.
 *   2. A `NEXT_PUBLIC_`-prefixed variable whose name says it is a secret. The prefix is what sends
 *      a value to the browser, so `NEXT_PUBLIC_..._SECRET` is a contradiction, and a typo there
 *      would ship a key to every visitor.
 *   3. A value in `.env.example`. Part 15 asks for «los nombres de las variables y sin un solo
 *      valor», and that file is the one secrets file that is deliberately committed.
 */

const ROOT = resolve(import.meta.dirname, "..");
const EDITOR_SRC = join(ROOT, "apps", "editor", "src");

/** Reading any of these means a module is server-only, whatever else it does. */
const SERVER_ONLY_ENV = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCESS_KEY_ID",
];

/** Packages that have no business in a browser bundle at all. */
const SERVER_ONLY_IMPORTS = ["@retorika/db", "postgres", "node:fs", "node:path", "next/headers"];

/** A `NEXT_PUBLIC_` name containing one of these is a mistake, not a choice. */
const SECRET_WORDS = ["SECRET", "SERVICE_ROLE", "PRIVATE", "PASSWORD", "CREDENTIAL"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

interface Module {
  path: string;
  text: string;
  isClient: boolean;
  /** Why this module is server-only, if it is. */
  serverReason: string | undefined;
  /** Resolved paths of its local imports. */
  imports: string[];
}

/** `./x.ts`, `../y/z.tsx` and `@/a/b.ts` — the three forms this app actually uses. */
function resolveLocal(from: string, specifier: string): string | undefined {
  let candidate: string | undefined;
  if (specifier.startsWith("@/")) candidate = join(EDITOR_SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) candidate = resolve(dirname(from), specifier);
  if (!candidate) return undefined;
  for (const guess of [candidate, `${candidate}.ts`, `${candidate}.tsx`]) {
    try {
      if (statSync(guess).isFile()) return guess;
    } catch {
      // Not this spelling; try the next.
    }
  }
  return undefined;
}

const modules = new Map<string, Module>();
for (const path of sourceFiles(EDITOR_SRC)) {
  const text = readFileSync(path, "utf8");
  const imports: string[] = [];
  for (const match of text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (!specifier) continue;
    const resolved = resolveLocal(path, specifier);
    if (resolved) imports.push(resolved);
  }

  // A module is server-only if it reads a secret, or imports something that cannot run in a
  // browser. `serviceRoleKey()`'s own `typeof window` guard is a runtime net; this is the one
  // that fires before anything is deployed.
  //
  // **It looks for a read, not for a mention**, and the difference is not pedantic: the first
  // version matched the bare name anywhere in the file and flagged `account/sites.ts`, whose only
  // crime was a comment explaining why it does *not* use `DATABASE_URL`. A gate that cannot be
  // reasoned about in prose is a gate people route around, so it now requires the name to appear
  // as an actual `process.env` access.
  const env = SERVER_ONLY_ENV.find((name) => {
    // Read through a literal: `process.env.X` or `process.env["X"]`.
    const quoted = "[\"'`]";
    const literal = new RegExp(
      `process\\.env(?:\\[\\s*${quoted}${name}${quoted}\\s*\\]|\\.${name}\\b)`,
    ).test(text);
    // Read through a constant: `process.env[SERVICE_KEY_VAR]`. Needed because that is exactly how
    // `auth/env.server.ts` reads the service key — and tightening this check the obvious way
    // stopped detecting it, which would have left the one module the gate exists for unguarded.
    const indirect = /process\.env\s*\[\s*[A-Za-z_$]/.test(text) && text.includes(name);
    return literal || indirect;
  });

  const pkg = SERVER_ONLY_IMPORTS.find((name) =>
    new RegExp(`from\\s*["']${name.replace("/", "\\/")}["']`).test(text),
  );

  modules.set(path, {
    path,
    text,
    isClient: /^\s*["']use client["']/m.test(text),
    serverReason: env ? `reads ${env}` : pkg ? `imports ${pkg}` : undefined,
    imports,
  });
}

const problems: string[] = [];

// 1. Can any client module reach a server-only one?
for (const entry of modules.values()) {
  if (!entry.isClient) continue;
  const seen = new Set<string>();
  const queue = [...entry.imports];
  const chain = new Map<string, string>();
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    const module = modules.get(next);
    if (!module) continue;
    if (module.serverReason) {
      const path: string[] = [relative(ROOT, next)];
      let cursor = next;
      while (chain.has(cursor)) {
        cursor = chain.get(cursor) as string;
        path.unshift(relative(ROOT, cursor));
      }
      problems.push(
        `${relative(ROOT, entry.path)} is "use client" and reaches a server-only module ` +
          `(${module.serverReason}):\n    ${[relative(ROOT, entry.path), ...path].join("\n      → ")}`,
      );
      break;
    }
    for (const dependency of module.imports) {
      if (!seen.has(dependency)) {
        chain.set(dependency, next);
        queue.push(dependency);
      }
    }
  }
}

// 2. A NEXT_PUBLIC_ name that claims to be a secret.
for (const entry of modules.values()) {
  for (const match of entry.text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    const name = match[0];
    if (SECRET_WORDS.some((word) => name.includes(word))) {
      problems.push(
        `${relative(ROOT, entry.path)} names ${name}. The NEXT_PUBLIC_ prefix sends a value to ` +
          `every visitor's browser, so a secret must never carry it (Part 15).`,
      );
    }
  }
}

// 3. A value in .env.example.
const examplePath = join(ROOT, ".env.example");
for (const [index, line] of readFileSync(examplePath, "utf8").split("\n").entries()) {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) continue;
  const [, value = ""] = trimmed.split(/=(.*)/s);
  if (value.trim() !== "") {
    problems.push(
      `.env.example:${index + 1} has a value. Part 15 asks for the names and «sin un solo valor».`,
    );
  }
}

if (problems.length > 0) {
  console.error("secrets-scope: the server/browser line is crossed.\n");
  for (const problem of problems) console.error(`  ${problem}\n`);
  process.exit(1);
}

const clients = [...modules.values()].filter((m) => m.isClient).length;
const servers = [...modules.values()].filter((m) => m.serverReason).length;
console.log(
  `secrets-scope: ok (${modules.size} modules, ${clients} client, ${servers} server-only, ` +
    `no crossing).`,
);
