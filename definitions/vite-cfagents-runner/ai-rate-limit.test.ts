// eslint-disable-next-line import/no-unresolved -- Bun provides this test module.
import { describe, expect, it } from "bun:test";

import {
  evaluateAiRequest,
  getUtcDay,
  type AiRateLimits,
} from "./worker/ai-rate-limit";

const TEST_LIMITS: AiRateLimits = {
  windowMs: 60_000,
  maxRequestsPerWindow: 2,
  dailyRequestLimit: 3,
};

describe("AI request limiter", () => {
  it("allows requests below both limits and removes expired window entries", () => {
    const now = Date.UTC(2026, 6, 20, 12, 0, 0);
    const evaluation = evaluateAiRequest(
      [now - 60_001, now - 10_000],
      1,
      now,
      TEST_LIMITS,
    );

    expect(evaluation.decision).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(evaluation.recentRequestTimestamps).toEqual([now - 10_000, now]);
    expect(evaluation.dailyRequestCount).toBe(2);
  });

  it("returns a retry time when the per-IP sliding window is full", () => {
    const now = Date.UTC(2026, 6, 20, 12, 0, 30);
    const evaluation = evaluateAiRequest(
      [now - 30_000, now - 1_000],
      2,
      now,
      TEST_LIMITS,
    );

    expect(evaluation.decision).toEqual({
      allowed: false,
      reason: "per_ip_rate_limit",
      retryAfterSeconds: 30,
    });
    expect(evaluation.dailyRequestCount).toBe(2);
  });

  it("blocks at the UTC-day cap without growing per-IP storage", () => {
    const now = Date.UTC(2026, 6, 20, 23, 59, 30);
    const evaluation = evaluateAiRequest([], 3, now, TEST_LIMITS);

    expect(evaluation.decision).toEqual({
      allowed: false,
      reason: "daily_budget_exceeded",
      retryAfterSeconds: 30,
    });
    expect(evaluation.recentRequestTimestamps).toEqual([]);
    expect(evaluation.dailyRequestCount).toBe(3);
    expect(getUtcDay(now)).toBe("2026-07-20");
  });

  it("supports disabling the daily cap with zero", () => {
    const now = Date.UTC(2026, 6, 20, 12, 0, 0);
    const evaluation = evaluateAiRequest([], 10_000, now, {
      ...TEST_LIMITS,
      dailyRequestLimit: 0,
    });

    expect(evaluation.decision.allowed).toBe(true);
    expect(evaluation.dailyRequestCount).toBe(10_001);
  });
});
