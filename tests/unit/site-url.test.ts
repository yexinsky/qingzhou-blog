/**
 * src/lib/site-url.ts：sitemap / robots / RSS 共用的站点绝对地址解析。
 *
 * 这里钉住的核心行为是"绝不在线上把 localhost 写给爬虫"：
 * 优先级为 SITE_URL > NEXTAUTH_URL > 当前请求的 Host，只有连 Host 都拿不到
 * （例如构建期无请求上下文）才退回 localhost。
 */
import { resolveSiteUrl } from '@/lib/site-url';
import { headers } from 'next/headers';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

const mockedHeaders = headers as jest.MockedFunction<typeof headers>;

type HeaderStore = { get: (name: string) => string | null };
type HeadersResult = Awaited<ReturnType<typeof headers>>;

function mockHeaders(values: Record<string, string>): void {
  const store: HeaderStore = { get: (name) => values[name] ?? null };
  mockedHeaders.mockResolvedValue(store as unknown as HeadersResult);
}

describe('resolveSiteUrl', () => {
  const saved = {
    SITE_URL: process.env.SITE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };

  beforeEach(() => {
    delete process.env.SITE_URL;
    delete process.env.NEXTAUTH_URL;
    // 默认给一个请求上下文，个别用例会覆盖成抛错以模拟构建期。
    mockHeaders({ host: '127.0.0.1:3000' });
  });

  afterEach(() => {
    if (saved.SITE_URL === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = saved.SITE_URL;
    if (saved.NEXTAUTH_URL === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = saved.NEXTAUTH_URL;
  });

  it('prefers SITE_URL over everything else', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    process.env.NEXTAUTH_URL = 'http://internal:8080';
    mockHeaders({ host: 'attacker.example', 'x-forwarded-host': 'attacker.example' });
    expect(await resolveSiteUrl()).toBe('https://blog.example.com');
  });

  it('falls back to NEXTAUTH_URL when SITE_URL is unset', async () => {
    process.env.NEXTAUTH_URL = 'https://blog.example.com';
    expect(await resolveSiteUrl()).toBe('https://blog.example.com');
  });

  it('treats a blank or whitespace SITE_URL as unset', async () => {
    process.env.SITE_URL = '   ';
    process.env.NEXTAUTH_URL = 'https://blog.example.com';
    expect(await resolveSiteUrl()).toBe('https://blog.example.com');
  });

  it('strips trailing slashes so callers can append paths directly', async () => {
    process.env.SITE_URL = 'https://blog.example.com/';
    expect(await resolveSiteUrl()).toBe('https://blog.example.com');
  });

  it('derives the origin from the request host instead of leaking localhost', async () => {
    mockHeaders({ host: '127.0.0.1:3101' });
    expect(await resolveSiteUrl()).toBe('http://127.0.0.1:3101');
  });

  it('prefers x-forwarded-host and x-forwarded-proto behind a reverse proxy', async () => {
    mockHeaders({
      host: 'app:3000',
      'x-forwarded-host': 'blog.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(await resolveSiteUrl()).toBe('https://blog.example.com');
  });

  it('takes the first value of a comma-separated forwarded header chain', async () => {
    mockHeaders({
      'x-forwarded-host': 'blog.example.com, internal-lb',
      'x-forwarded-proto': 'https, http',
    });
    expect(await resolveSiteUrl()).toBe('https://blog.example.com');
  });

  it('defaults the scheme to http when x-forwarded-proto is absent', async () => {
    mockHeaders({ 'x-forwarded-host': 'blog.example.com' });
    expect(await resolveSiteUrl()).toBe('http://blog.example.com');
  });

  it('falls back to localhost only when there is no host to read', async () => {
    mockHeaders({});
    expect(await resolveSiteUrl()).toBe('http://localhost:3000');
  });

  it('does not throw when called outside a request scope', async () => {
    mockedHeaders.mockRejectedValue(new Error('headers() called outside a request scope'));
    expect(await resolveSiteUrl()).toBe('http://localhost:3000');
  });
});
