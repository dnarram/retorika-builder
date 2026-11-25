/**
 * **The critical flows split across two CI jobs** (25 November 2026, sprint 41, decided by David on
 * the day's measurement: the step ran 36m58s and then 39m32s on PR #408, at the plan's 40-minute line
 * with the sprint's walks still to come).
 *
 * Vitest's own `--shard` splits **files**, and every walk lives in one file, so the split is made
 * here, by top-level `describe`: each one takes the next position and a shard runs the positions
 * whose remainder is its own. Alternating keeps the two halves even without anybody weighing walks —
 * measured on #408's run, 1182 s and 1129 s of the 2311 — and a walk added at the end of the file
 * lands in whichever half is next, so the balance does not drift towards one side.
 *
 * **The journey is one position.** The first blocks of the file share one `page` and walk it in
 * order — the questionnaire, an edit, a palette, the download, and the regressions that come back
 * to `/empezar` and find the site the first one made. Split, the later ones would open an editor
 * with no site in it. They are declared with `describe.journey` and all take position 0, so they
 * always run together, in the first shard.
 *
 * Unset — every local run, and `pnpm e2e` without the variable — every walk runs, as before.
 */

export interface Shard {
  /** 1-based, as the variable is written: `1/2` is the first of two. */
  readonly index: number;
  readonly count: number;
}

/** `RETORIKA_E2E_SHARD`, read: unset or empty is every walk; anything malformed throws, because a
 * typo here would run half the suite and call it green. */
export function parseShard(value: string | undefined): Shard | null {
  if (value === undefined || value === "") return null;
  const match = /^(\d+)\/(\d+)$/.exec(value);
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (!match || count < 1 || index < 1 || index > count) {
    throw new Error(
      `RETORIKA_E2E_SHARD must be «i/n» with 1 ≤ i ≤ n, not ${JSON.stringify(value)}`,
    );
  }
  return { index, count };
}

/** Whether the walk at `position` runs in `shard`; with no shard, every walk does. */
export function inShard(position: number, shard: Shard | null): boolean {
  return shard === null || position % shard.count === shard.index - 1;
}

type Body = () => void;

/** The part of Vitest's `describe` this file uses. */
export interface DescribeLike {
  (name: string, body: Body): void;
  skip(name: string, body: Body): void;
}

export interface ShardedDescribe {
  (name: string, body: Body): void;
  /** One of the blocks that walk the file's shared `page`: position 0, always together. */
  journey(name: string, body: Body): void;
  /** Vitest's `skipIf`, counted like any other block so the positions after it do not move. */
  skipIf(condition: boolean): (name: string, body: Body) => void;
}

/**
 * A `describe` that registers a top-level block as skipped when it belongs to another shard.
 * Skipped rather than left out, so the report of each job still lists every walk and says which
 * ones the other job ran. A nested `describe` is its parent's and passes straight through.
 */
export function shardedDescribe(base: DescribeLike, shard: Shard | null): ShardedDescribe {
  let next = 1;
  let depth = 0;

  const register = (name: string, body: Body, position: number, skip: boolean): void => {
    const nested = () => {
      depth += 1;
      try {
        body();
      } finally {
        depth -= 1;
      }
    };
    // Called on `base` rather than pulled off it: Vitest's chain reads its own `this`.
    if (skip || (depth === 0 && !inShard(position, shard))) base.skip(name, nested);
    else base(name, nested);
  };

  const describe = (name: string, body: Body): void => {
    register(name, body, depth > 0 ? -1 : next++, false);
  };
  describe.journey = (name: string, body: Body): void => register(name, body, 0, false);
  describe.skipIf =
    (condition: boolean) =>
    (name: string, body: Body): void =>
      register(name, body, depth > 0 ? -1 : next++, condition);
  return describe;
}
