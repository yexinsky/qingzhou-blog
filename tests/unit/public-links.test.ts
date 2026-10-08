/**
 * src/lib/public-links.ts：页脚与「关于我」页面的社交入口。
 *
 * 关键约束有两个，都在这里钉住：
 *  1. 未配置的项必须完全不产生条目（线上站点不允许出现占位链接）。
 *  2. 空白字符串等同于未配置 —— 否则 `NEXT_PUBLIC_GITHUB_URL=` 这种
 *     "留空但仍写了等号" 的写法会渲染出一个 href 为空的可点击图标。
 *
 * 注意：实现里必须写成 process.env.NEXT_PUBLIC_XXX 的字面量形式，Next 的
 * 替换是静态文本匹配，改成 process.env[name] 会在打包时匹配不上，表现为
 * "配了也永远不显示"。因此这里的测试直接改 process.env 再调用，而不是给
 * 函数传 env 参数。
 */
import { getPublicLinks } from '@/lib/public-links';

const KEYS = [
  'NEXT_PUBLIC_GITHUB_URL',
  'NEXT_PUBLIC_TWITTER_URL',
  'NEXT_PUBLIC_CONTACT_EMAIL',
] as const;

describe('getPublicLinks', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('returns nothing when no variable is configured', () => {
    expect(getPublicLinks()).toEqual([]);
  });

  it('treats blank and whitespace-only values as unconfigured', () => {
    process.env.NEXT_PUBLIC_GITHUB_URL = '';
    process.env.NEXT_PUBLIC_TWITTER_URL = '   ';
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = '';
    expect(getPublicLinks()).toEqual([]);
  });

  it('renders only the configured entries', () => {
    process.env.NEXT_PUBLIC_GITHUB_URL = 'https://github.com/qzhou';
    expect(getPublicLinks()).toEqual([
      { href: 'https://github.com/qzhou', label: 'GitHub', kind: 'github' },
    ]);
  });

  it('builds a mailto link for the contact address', () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = 'hi@example.com';
    expect(getPublicLinks()).toEqual([
      { href: 'mailto:hi@example.com', label: '邮箱', kind: 'email' },
    ]);
  });

  it('trims surrounding whitespace', () => {
    process.env.NEXT_PUBLIC_GITHUB_URL = '  https://github.com/qzhou  ';
    expect(getPublicLinks()[0].href).toBe('https://github.com/qzhou');
  });

  it('keeps labels unique so they are safe as React keys', () => {
    process.env.NEXT_PUBLIC_GITHUB_URL = 'https://github.com/qzhou';
    process.env.NEXT_PUBLIC_TWITTER_URL = 'https://twitter.com/qzhou';
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = 'hi@example.com';

    const links = getPublicLinks();
    expect(links.map((l) => l.kind)).toEqual(['github', 'twitter', 'email']);
    expect(new Set(links.map((l) => l.label)).size).toBe(links.length);
  });
});
