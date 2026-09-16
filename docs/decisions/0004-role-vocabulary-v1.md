# 0004 — Role vocabulary v1: nine roles and one container

**Status:** accepted · **Date:** 2026-09-16

## Context

The technical annex fixes a closed vocabulary of seven roles: *titular, subtítulo, cuerpo,
imagen, botón, lista, campo*.

The catalog the concept dossier describes does not fit inside it:

- "Horario y ubicación" needs a **map**, and a map is neither an image nor a field.
- The advanced dossier §11 describes **custom code blocks** that the simple view shows as an
  opaque labelled box — an element with no role in the vocabulary.
- Embedded video and third-party widgets have the same shape as custom code.
- `lista` is listed alongside the others, but it is not a peer: it contains elements rather than
  holding a value.

Extending a closed vocabulary after documents exist is a schema migration over client data. Right
now there is not one saved document in the world.

## Decision

**Extend the vocabulary now, to nine roles plus one container.**

`heading`, `subheading`, `body`, `image`, `embed`, `button`, `link`, `field`, `map` — and `list`
as the container.

- **`list` is a repeater**, not a peer role: `{ items: [{ id, elements: [...] }] }`. The preset
  declares which roles each item carries and how many items are allowed. It is designed as the
  same piece the Phase-3 collections will use, so forty services are forty items against one
  template rather than forty hand-built pages.
- **`embed` is the opaque box**: custom code, third-party widgets, embedded video. The simple
  view shows it labelled and not editable there. It is what template extraction strips, and it
  is off by default in the renderer.
- **Icons are not a role.** They are a selectable property of the preset or the variant.
- **`map` publishes as a static image plus a link** to the maps application. An interactive map
  is optional and counts against the JavaScript budget of ADR 0001.

### The asymmetry, which is the real decision

Adding a role is backward-compatible and bumps the **minor** version. Removing or renaming one
breaks and bumps the **major** version. So **"closed" means closed for this schema version**, not
closed forever.

This is worth writing down because the fear of a closed list is what produces defensive
hoarding — a vocabulary padded with roles nobody needs, just in case. If growing the list is
cheap and shrinking it is expensive, the right instinct is to keep it small and add when a real
section demands it.

## Consequences

- `SCHEMA_VERSION` is semver rather than an integer, so the asymmetry is expressible.
- The same rule applies to the token namespace, which is closed for the same reason: with an open
  namespace a typo is a dead style reference discovered on a client's published site; closed, it
  is a validation error at write time. Rule 6 is not checkable otherwise.
- The migration guard demands a migration and a round-trip test from the second schema version
  onward. The initial state — only `0001-initial` present — is handled explicitly, or the guard
  would block the very commit that introduces it.

## Amends

Rule 2 of the technical annex of the advanced dossier.
