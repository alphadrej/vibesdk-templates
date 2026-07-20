export const AI_RATE_LIMIT_WINDOW_MS = 60_000;
export const AI_RATE_LIMIT_MAX_REQUESTS = 20;
// Set to 0 to disable the per-app UTC-day request budget.
export const AI_DAILY_REQUEST_LIMIT = 500;

export interface AiRateLimits {
  windowMs: number;
  maxRequestsPerWindow: number;
  dailyRequestLimit: number;
}

export type AiRateLimitReason = "per_ip_rate_limit" | "daily_budget_exceeded";

export interface AiRateLimitDecision {
  allowed: boolean;
  reason?: AiRateLimitReason;
  retryAfterSeconds: number;
}

export interface AiRateLimitEvaluation {
  decision: AiRateLimitDecision;
  recentRequestTimestamps: number[];
  dailyRequestCount: number;
}

export const DEFAULT_AI_RATE_LIMITS: AiRateLimits = {
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  maxRequestsPerWindow: AI_RATE_LIMIT_MAX_REQUESTS,
  dailyRequestLimit: AI_DAILY_REQUEST_LIMIT,
};

export function getUtcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(now: number): number {
  const date = new Date(now);
  const nextDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((nextDay - now) / 1_000));
}

/** Applies an exact sliding-window limit and reserves one daily request on success. */
export function evaluateAiRequest(
  requestTimestamps: number[],
  dailyRequestCount: number,
  now: number,
  limits: AiRateLimits = DEFAULT_AI_RATE_LIMITS,
): AiRateLimitEvaluation {
  const windowStart = now - limits.windowMs;
  const recentRequestTimestamps = requestTimestamps
    .filter((timestamp) => timestamp > windowStart)
    .sort((a, b) => a - b);

  if (limits.dailyRequestLimit > 0 && dailyRequestCount >= limits.dailyRequestLimit) {
    return {
      decision: {
        allowed: false,
        reason: "daily_budget_exceeded",
        retryAfterSeconds: secondsUntilNextUtcDay(now),
      },
      recentRequestTimestamps,
      dailyRequestCount,
    };
  }

  if (recentRequestTimestamps.length >= limits.maxRequestsPerWindow) {
    const retryAt = recentRequestTimestamps[0] + limits.windowMs;
    return {
      decision: {
        allowed: false,
        reason: "per_ip_rate_limit",
        retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1_000)),
      },
      recentRequestTimestamps,
      dailyRequestCount,
    };
  }

  recentRequestTimestamps.push(now);

  return {
    decision: {
      allowed: true,
      retryAfterSeconds: 0,
    },
    recentRequestTimestamps,
    dailyRequestCount: dailyRequestCount + 1,
  };
}
