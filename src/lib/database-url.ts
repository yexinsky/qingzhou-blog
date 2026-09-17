/**
 * 解析数据库连接串。
 *
 * 两种等价的配置方式，优先级从高到低：
 *   1. `DATABASE_URL`：完整连接串，本机开发与手工配置常用；
 *   2. `MYSQL_HOST` + `MYSQL_USER` + `MYSQL_PASSWORD` + `MYSQL_DATABASE`：
 *      与 docker-compose 里 MySQL 容器使用同一组变量，密码只写一处；
 *      用户名与密码会自动 URL 编码，不必手写 `%40` 这类转义。
 *
 * 解析失败时抛出可定位的错误，避免 mysql2 抛出难以理解的连接异常。
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (url) return url;

  const host = env.MYSQL_HOST?.trim();
  const user = env.MYSQL_USER?.trim();
  const database = env.MYSQL_DATABASE?.trim();
  const password = env.MYSQL_PASSWORD ?? '';
  const port = env.MYSQL_PORT?.trim() || '3306';

  const missing = [
    host ? null : 'MYSQL_HOST',
    user ? null : 'MYSQL_USER',
    database ? null : 'MYSQL_DATABASE',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `[db] 数据库配置不完整：缺少 ${missing.join('、')}。` +
        '请设置 DATABASE_URL（完整连接串），或补齐 MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE。',
    );
  }

  const credentials =
    password === ''
      ? encodeURIComponent(user!)
      : `${encodeURIComponent(user!)}:${encodeURIComponent(password)}`;
  return `mysql://${credentials}@${host}:${port}/${database}`;
}
