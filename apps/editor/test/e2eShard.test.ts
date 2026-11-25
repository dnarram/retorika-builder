import { describe, expect, it } from "vitest";
import { type DescribeLike, inShard, parseShard, shardedDescribe } from "../e2e/shard.ts";

/** A `describe` that records what was registered, run or skipped, and runs every body. */
function recorder() {
  const seen: string[] = [];
  const base = ((name: string, body: () => void) => {
    seen.push(`run ${name}`);
    body();
  }) as DescribeLike;
  base.skip = (name: string, body: () => void) => {
    seen.push(`skip ${name}`);
    body();
  };
  return { base, seen };
}

describe("parseShard", () => {
  it("reads «i/n», and unset or empty is every walk", () => {
    expect(parseShard("1/2")).toEqual({ index: 1, count: 2 });
    expect(parseShard("2/2")).toEqual({ index: 2, count: 2 });
    expect(parseShard(undefined)).toBeNull();
    expect(parseShard("")).toBeNull();
  });

  it("throws on anything else, rather than running half the suite and calling it green", () => {
    for (const bad of ["0/2", "3/2", "1/0", "2", "1-2", " 1/2", "a/b"]) {
      expect(() => parseShard(bad), bad).toThrow(/RETORIKA_E2E_SHARD/);
    }
  });
});

describe("inShard", () => {
  it("alternates positions between two shards, and runs everything with none", () => {
    const one = { index: 1, count: 2 };
    const two = { index: 2, count: 2 };
    expect([0, 1, 2, 3, 4].map((p) => inShard(p, one))).toEqual([true, false, true, false, true]);
    expect([0, 1, 2, 3, 4].map((p) => inShard(p, two))).toEqual([false, true, false, true, false]);
    expect([0, 1, 2].every((p) => inShard(p, null))).toBe(true);
  });
});

describe("shardedDescribe", () => {
  /** The file's shape in miniature: two journey blocks, then four walks, one with a nested block. */
  function file(shard: ReturnType<typeof parseShard>) {
    const { base, seen } = recorder();
    const d = shardedDescribe(base, shard);
    d.journey("flow 1", () => {});
    d.journey("flow 2", () => {});
    d("A", () => {});
    d("B", () => {
      d("B inside", () => {});
    });
    d.skipIf(true)("C", () => {});
    d("D", () => {});
    return seen;
  }

  it("keeps the journey together in the first shard and alternates the rest from there", () => {
    // Written out rather than derived: the journey is position 0, A 1, B 2, C 3, D 4.
    expect(file(parseShard("1/2"))).toEqual([
      "run flow 1",
      "run flow 2",
      "skip A",
      "run B",
      "run B inside",
      "skip C",
      "run D",
    ]);
    expect(file(parseShard("2/2"))).toEqual([
      "skip flow 1",
      "skip flow 2",
      "run A",
      "skip B",
      "run B inside",
      "skip C",
      "skip D",
    ]);
  });

  it("runs every walk with no shard, and still honours skipIf", () => {
    expect(file(null)).toEqual([
      "run flow 1",
      "run flow 2",
      "run A",
      "run B",
      "run B inside",
      "skip C",
      "run D",
    ]);
  });

  it("runs every walk exactly once across the two shards", () => {
    const ran = (seen: string[]) =>
      seen.filter((line) => line.startsWith("run ") && !line.includes("inside"));
    const one = ran(file(parseShard("1/2")));
    const two = ran(file(parseShard("2/2")));
    expect([...one, ...two].sort()).toEqual(
      ["run A", "run B", "run D", "run flow 1", "run flow 2"].sort(),
    );
  });
});
