import { createHash, createHmac } from 'crypto';
import { isIP } from 'net';
import type { NextRequest, NextResponse } from 'next/server';

type RateLimitResult = { success: boolean; remaining: number; reset: number };
export type RateLimiter = { limit(identifier: string): Promise<RateLimitResult> };

interface MemoryEntry { count: number; resetTime: number }
class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, MemoryEntry>();
  private callsSinceSweep = 0;
  constructor(private readonly max: number, private readonly windowMs: number, private readonly prefix: string) {}
  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    if (++this.callsSinceSweep >= 256) {
      for (const [k, v] of this.store) if (now >= v.resetTime) this.store.delete(k);
      this.callsSinceSweep = 0;
    }
    const entry = this.store.get(key);
    if (!entry || now >= entry.resetTime) {
      const resetTime = now + this.windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { success: true, remaining: this.max - 1, reset: resetTime };
    }
    if (entry.count >= this.max) return { success: false, remaining: 0, reset: entry.resetTime };
    entry.count += 1;
    return { success: true, remaining: this.max - entry.count, reset: entry.resetTime };
  }
}

const WINDOW_RE = /^(\d+)\s*(ms|s|m|h|d)$/;
function parseWindowToMs(window: string): number {
  const match = WINDOW_RE.exec(window);
  if (!match) throw new Error(`[rate-limit] invalid window string: ${window}`);
  const value = Number(match[1]);
  return value * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 0);
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const hasRedisConfig = Boolean(redisUrl && redisToken);
const isProduction = process.env.NODE_ENV === 'production';
// 自托管单实例部署（Docker Compose）可显式选择进程内限流：RATE_LIMIT_BACKEND=memory。
// 默认仍要求生产环境使用共享 Redis，避免多实例部署在无感知的情况下丢掉跨实例限流。
const allowMemoryBackend = (process.env.RATE_LIMIT_BACKEND || '').trim().toLowerCase() === 'memory';
if (isProduction && allowMemoryBackend) {
  console.warn('[rate-limit] RATE_LIMIT_BACKEND=memory：计数保存在单进程内存中，重启即清零，仅在单实例部署下使用。');
}

type UpstashModules = {
  Redis: new (config: { url: string; token: string }) => unknown;
  Ratelimit: new (config: { redis: unknown; limiter: unknown; analytics: boolean; prefix: string }) => RateLimiter;
};
let upstashModulesPromise: Promise<UpstashModules> | null = null;
async function loadUpstashModules(): Promise<UpstashModules> {
  if (!upstashModulesPromise) {
    upstashModulesPromise = Promise.all([import('@upstash/redis'), import('@upstash/ratelimit')]).then(([redis, rate]) => ({
      Redis: redis.Redis as unknown as UpstashModules['Redis'],
      Ratelimit: rate.Ratelimit as unknown as UpstashModules['Ratelimit'],
    }));
  }
  return upstashModulesPromise;
}

function unavailableLimiter(prefix: string): RateLimiter {
  return { async limit() { throw new Error(`[rate-limit] ${prefix}: Redis rate limiting is required in production`); } };
}
function createRatelimiter(limit: number, window: `${number} ${'ms'|'s'|'m'|'h'|'d'}`, prefix: string): RateLimiter {
  if (!hasRedisConfig) {
    if (isProduction && !allowMemoryBackend) return unavailableLimiter(prefix);
    return new MemoryRateLimiter(limit, parseWindowToMs(window), prefix);
  }
  let real: RateLimiter | null = null;
  return { async limit(identifier: string) {
    if (!real) {
      try {
        const modules = await loadUpstashModules();
        const redis = new modules.Redis({ url: redisUrl!, token: redisToken! });
        real = new modules.Ratelimit({
          redis,
          limiter: (modules.Ratelimit as unknown as { slidingWindow: (count: number, window: string) => unknown }).slidingWindow(limit, window),
          analytics: true,
          prefix,
        });
      } catch (error) {
        if (isProduction && !allowMemoryBackend) throw new Error(`[rate-limit] ${prefix}: Redis initialization failed`, { cause: error });
        console.warn(`[rate-limit] ${prefix}: Redis 初始化失败，降级为进程内限流`, error);
        // 降级后缓存在 real 上，后续请求不再重试 Redis。
        real = new MemoryRateLimiter(limit, parseWindowToMs(window), prefix);
      }
    }
    try { return await real.limit(identifier); }
    catch (error) {
      if (!allowMemoryBackend) {
        if (isProduction) throw new Error(`[rate-limit] ${prefix}: Redis request failed`, { cause: error });
        throw error;
      }
      console.warn(`[rate-limit] ${prefix}: Redis 请求失败，降级为进程内限流`, error);
      real = new MemoryRateLimiter(limit, parseWindowToMs(window), prefix);
      return real.limit(identifier);
    }
  }};
}

export const commentRatelimit = createRatelimiter(10, '1 m', 'ratelimit:comment');
export const loginRatelimit = createRatelimiter(5, '1 m', 'ratelimit:login');
export const globalRatelimit = createRatelimiter(100, '1 m', 'ratelimit:global');
export const momentRatelimit = createRatelimiter(5, '1 m', 'ratelimit:moment');
export const likeRatelimit = createRatelimiter(10, '1 m', 'ratelimit:like');
export function getRateLimiterBackend(): 'upstash'|'memory'|'unavailable' {
  if (hasRedisConfig) return 'upstash';
  return isProduction && !allowMemoryBackend ? 'unavailable' : 'memory';
}

function normalizeIp(value: string | null): string | null {
  if (!value) return null;
  let ip = value.trim();
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']'));
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return isIP(ip) ? ip.toLowerCase() : null;
}
function trustedProxyHeaders(): Set<string> {
  return new Set((process.env.TRUSTED_PROXY_IP_HEADER || '').split(',').map(v => v.trim().toLowerCase()).filter(v => ['x-forwarded-for','x-real-ip','cf-connecting-ip'].includes(v)));
}
/** Proxy headers are ignored by default. Configure TRUSTED_PROXY_IP_HEADER only when the edge proxy overwrites that header. */
export function getClientIP(request: NextRequest): string {
  const allowed = trustedProxyHeaders();
  for (const header of ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']) {
    if (!allowed.has(header)) continue;
    const raw = request.headers.get(header);
    const candidate = header === 'x-forwarded-for' ? raw?.split(',')[0] ?? null : raw;
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }
  // NextRequest does not expose the TCP peer in every runtime. A stable fallback prevents attacker-controlled header spoofing.
  return 'unknown-client';
}

export function createAnonymousClientId(request: NextRequest): string {
  const secret = process.env.ANONYMOUS_ID_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (isProduction) throw new Error('[privacy] ANONYMOUS_ID_SECRET (>=32 chars) is required in production');
    return createHash('sha256').update(`dev-only:${getClientIP(request)}`).digest('hex');
  }
  const ua = request.headers.get('user-agent')?.slice(0, 512) || 'unknown-agent';
  return createHmac('sha256', secret).update(`${getClientIP(request)}\n${ua}`).digest('hex');
}

export async function checkRatelimit(request: NextRequest, limiter: RateLimiter, identifier?: string): Promise<RateLimitResult> {
  return limiter.limit(identifier || getClientIP(request));
}
export function createRatelimitHeaders(result: RateLimitResult): Record<string,string> {
  return { 'X-RateLimit-Remaining': String(result.remaining), 'X-RateLimit-Reset': String(result.reset) };
}
const RATE_LIMIT_BODY = '{"error":"Too many requests. Please try again later.","code":"RATE_LIMIT_EXCEEDED"}';
export function createRatelimitResponse(): NextResponse {
  return new Response(RATE_LIMIT_BODY, { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '60' } }) as unknown as NextResponse;
}
export function withRatelimit(limiter: RateLimiter, identifierExtractor?: (req: NextRequest) => string) {
  return async function(request: NextRequest): Promise<{success:boolean; response?:NextResponse}> {
    try {
      const result = await checkRatelimit(request, limiter, identifierExtractor?.(request));
      if (!result.success) {
        const response = createRatelimitResponse();
        for (const [k,v] of Object.entries(createRatelimitHeaders(result))) response.headers.set(k,v);
        return { success:false, response };
      }
      return { success:true };
    } catch (error) {
      console.error('[rate-limit] limiter unavailable:', error);
      const response = new Response('{"error":"Service temporarily unavailable","code":"RATE_LIMIT_UNAVAILABLE"}', { status:503, headers:{'Content-Type':'application/json; charset=utf-8','Retry-After':'60'} }) as unknown as NextResponse;
      return { success:false, response };
    }
  };
}

