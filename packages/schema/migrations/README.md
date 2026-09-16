# Migrations

One file per schema version, named `NNNN-slug.ts`, exporting `{ version, description, up }`
and optionally `down`.

`scripts/schema-guard.ts` fails a commit that changes `packages/schema/src` without adding a
file here and a round-trip test between the previous version and the new one. The rule is not
bureaucracy: it is what lets a site saved today still open in two years.

**The initial state is handled explicitly.** While `0001-initial.ts` is the only file here
there is no previous version to round-trip against, so the guard is satisfied by that file
existing plus a test validating the corpus against the current version. From the second version
onward it demands both.

Per ADR 0004, adding a role or a token key is additive and bumps the **minor** version;
removing or renaming one breaks and bumps the **major**.
