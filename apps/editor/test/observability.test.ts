import { describe, expect, it } from "vitest";
import { DSN_VAR, reportingEnabled, sentryDsn } from "../src/observability/config.ts";
import { initIfConfigured, type SdkLike } from "../src/observability/init.ts";
import { resolveVersion } from "../src/observability/version.ts";

/**
 * The decision that error reporting is **off until David says yes**, proven without the SDK.
 *
 * `instrumentation.ts` and `instrumentation-client.ts` import `@sentry/nextjs`; the decision they
 * make does not, so it is tested here with a spy standing in for the SDK and the result read back
 * as the options `init` would have received.
 */

function spy(): SdkLike<object> & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    init(options) {
      calls.push(options);
    },
  };
}

describe("the DSN is optional, and absent means off", () => {
  it("is off with no variable, and off with an empty or blank one", () => {
    for (const env of [{}, { [DSN_VAR]: "" }, { [DSN_VAR]: "   " }]) {
      expect(sentryDsn(env)).toBeUndefined();
      expect(reportingEnabled(env)).toBe(false);
    }
  });

  it("is on with a DSN, trimmed", () => {
    expect(sentryDsn({ [DSN_VAR]: " https://k@o.ingest.de.sentry.io/1 " })).toBe(
      "https://k@o.ingest.de.sentry.io/1",
    );
  });

  it("does not call the SDK at all without a DSN", () => {
    // The whole of day 1's promise in one assertion: inert means `init` is never reached.
    const sdk = spy();
    expect(initIfConfigured(sdk, { env: {}, version: "abc", environment: "test" })).toBe("off");
    expect(sdk.calls).toEqual([]);
  });

  it("starts with a DSN, carrying the release, no PII, no tracing, and the scrubber", () => {
    const sdk = spy();
    const result = initIfConfigured(sdk, {
      env: { [DSN_VAR]: "https://k@o.ingest.de.sentry.io/1" },
      version: "abc1234",
      environment: "production",
    });
    expect(result).toBe("started");
    expect(sdk.calls).toHaveLength(1);
    const options = sdk.calls[0] as Record<string, unknown>;
    expect(options["dsn"]).toBe("https://k@o.ingest.de.sentry.io/1");
    expect(options["release"]).toBe("abc1234");
    expect(options["environment"]).toBe("production");
    expect(options["sendDefaultPii"]).toBe(false);
    expect(options["tracesSampleRate"]).toBe(0);
    // The scrubber is the function itself, not a copy: what the test file proves is what runs.
    expect(typeof options["beforeSend"]).toBe("function");
    const beforeSend = options["beforeSend"] as (e: { user?: unknown }) => { user?: unknown };
    expect(beforeSend({ user: { id: "x" } }).user).toBeUndefined();
  });
});

describe("the version each error carries", () => {
  it("prefers Render's commit SHA, shortened", () => {
    expect(resolveVersion({ renderCommit: "0123456789abcdef0123", gitShortHead: "local" })).toBe(
      "0123456789ab",
    );
  });

  it("falls back to the local short SHA, then to «unknown», and never throws", () => {
    expect(resolveVersion({ gitShortHead: "d552696" })).toBe("d552696");
    expect(resolveVersion({ renderCommit: "  ", gitShortHead: "" })).toBe("unknown");
    expect(resolveVersion({})).toBe("unknown");
  });
});
