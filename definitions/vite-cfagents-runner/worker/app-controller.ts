import { DurableObject } from 'cloudflare:workers';
import type { SessionInfo } from './types';
import type { Env } from './core-utils';
import {
  evaluateAiRequest,
  getUtcDay,
  type AiRateLimitDecision,
} from './ai-rate-limit';

const AI_IP_USAGE_PREFIX = 'ai-rate-limit:ip:';
const AI_DAILY_USAGE_PREFIX = 'ai-rate-limit:day:';

interface StoredIpUsage {
  requestTimestamps: number[];
}

async function hashClientIp(clientIp: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(clientIp),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// 🤖 AI Extension Point: Add session management features
export class AppController extends DurableObject<Env> {
  private sessions = new Map<string, SessionInfo>();
  private loaded = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      const stored = await this.ctx.storage.get<Record<string, SessionInfo>>('sessions') || {};
      this.sessions = new Map(Object.entries(stored));
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put('sessions', Object.fromEntries(this.sessions));
  }

  /**
   * Atomically checks the per-IP sliding window and the app-wide UTC-day cap.
   * The IP is hashed before storage to avoid retaining raw client addresses.
   */
  async checkAiRateLimit(clientIp: string, now = Date.now()): Promise<AiRateLimitDecision> {
    const ipUsageKey = `${AI_IP_USAGE_PREFIX}${await hashClientIp(clientIp)}`;
    const dailyUsageKey = `${AI_DAILY_USAGE_PREFIX}${getUtcDay(now)}`;

    return this.ctx.storage.transaction(async (transaction) => {
      const [storedIpUsage, storedDailyCount] = await Promise.all([
        transaction.get<StoredIpUsage>(ipUsageKey),
        transaction.get<number>(dailyUsageKey),
      ]);
      const evaluation = evaluateAiRequest(
        storedIpUsage?.requestTimestamps ?? [],
        storedDailyCount ?? 0,
        now,
      );

      if (evaluation.decision.allowed) {
        await Promise.all([
          transaction.put<StoredIpUsage>(ipUsageKey, {
            requestTimestamps: evaluation.recentRequestTimestamps,
          }),
          transaction.put(dailyUsageKey, evaluation.dailyRequestCount),
        ]);
      }

      return evaluation.decision;
    });
  }

  async addSession(sessionId: string, title?: string): Promise<void> {
    await this.ensureLoaded();
    const now = Date.now();
    this.sessions.set(sessionId, {
      id: sessionId,
      title: title || `Chat ${new Date(now).toLocaleDateString()}`,
      createdAt: now,
      lastActive: now
    });
    await this.persist();
  }

  async removeSession(sessionId: string): Promise<boolean> {
    await this.ensureLoaded();
    const deleted = this.sessions.delete(sessionId);
    if (deleted) await this.persist();
    return deleted;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.ensureLoaded();
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
      await this.persist();
    }
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    await this.ensureLoaded();
    const session = this.sessions.get(sessionId);
    if (session) {
      session.title = title;
      await this.persist();
      return true;
    }
    return false;
  }

  async listSessions(): Promise<SessionInfo[]> {
    await this.ensureLoaded();
    return Array.from(this.sessions.values()).sort((a, b) => b.lastActive - a.lastActive);
  }

  async getSessionCount(): Promise<number> {
    await this.ensureLoaded();
    return this.sessions.size;
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    await this.ensureLoaded();
    return this.sessions.get(sessionId) || null;
  }

  async clearAllSessions(): Promise<number> {
    await this.ensureLoaded();
    const count = this.sessions.size;
    this.sessions.clear();
    await this.persist();
    return count;
  }
}
