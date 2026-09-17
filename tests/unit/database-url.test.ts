/**
 * src/lib/database-url.ts：DATABASE_URL 与 MYSQL_* 两种配置方式必须等价，
 * 且解析失败时要给出可定位的错误。
 */
import { resolveDatabaseUrl } from '@/lib/database-url';

describe('resolveDatabaseUrl', () => {
  it('prefers DATABASE_URL when both styles are present', () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: 'mysql://root:pw@127.0.0.1:3306/qzblog',
        MYSQL_HOST: 'db',
        MYSQL_USER: 'qzblog',
        MYSQL_PASSWORD: 'pw',
        MYSQL_DATABASE: 'qzblog',
      }),
    ).toBe('mysql://root:pw@127.0.0.1:3306/qzblog');
  });

  it('assembles a url from the docker compose style variables', () => {
    expect(
      resolveDatabaseUrl({
        MYSQL_HOST: 'db',
        MYSQL_USER: 'qzblog',
        MYSQL_PASSWORD: 'dbpass',
        MYSQL_DATABASE: 'qzblog',
      }),
    ).toBe('mysql://qzblog:dbpass@db:3306/qzblog');
  });

  it('url-encodes credentials containing reserved characters', () => {
    const url = resolveDatabaseUrl({
      MYSQL_HOST: 'db',
      MYSQL_USER: 'a@b',
      MYSQL_PASSWORD: 'p@ss:w/rd',
      MYSQL_DATABASE: 'qzblog',
    });
    expect(url).toBe(
      `mysql://${encodeURIComponent('a@b')}:${encodeURIComponent('p@ss:w/rd')}@db:3306/qzblog`,
    );
    // 解析结果必须是合法 URL，且还原后的密码与原值一致
    expect(decodeURIComponent(new URL(url).password)).toBe('p@ss:w/rd');
  });

  it('honors MYSQL_PORT and allows a passwordless user', () => {
    expect(
      resolveDatabaseUrl({
        MYSQL_HOST: 'db',
        MYSQL_PORT: '3307',
        MYSQL_USER: 'qzblog',
        MYSQL_DATABASE: 'qzblog',
      }),
    ).toBe('mysql://qzblog@db:3307/qzblog');
  });

  it('names the missing variables instead of failing later at connect time', () => {
    expect(() => resolveDatabaseUrl({ MYSQL_USER: 'qzblog' })).toThrow(/MYSQL_HOST、MYSQL_DATABASE/);
  });

  it('explains both configuration styles when nothing is set', () => {
    expect(() => resolveDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });
});
