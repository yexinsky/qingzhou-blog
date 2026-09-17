#!/usr/bin/env node
// 容器启动引导：等待数据库 → 执行迁移 → 确保存在可登录的管理员账号。
//
// 迁移与 `npm run db:migrate`（drizzle-kit）使用同一个 drizzle-orm 迁移器、同一张
// __drizzle_migrations 表：本地开发已经迁移过的库不会重复执行，反之亦然。
// 迁移所需依赖由 next.config.js 的 outputFileTracingIncludes 打进镜像。
//
// 管理员账号：登录逻辑只校验、不建号（src/lib/auth.ts），而迁移文件里没有种子数据，
// 因此全新数据库原本无人可登录。这里仅在 users 表为空时按 ADMIN_USERNAME 建一条
// admin 记录，已有数据的环境一律不碰。
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';

const MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER?.trim() || 'drizzle';
const WAIT_TIMEOUT_MS = Number(process.env.DB_WAIT_TIMEOUT_MS || 120_000);
const RETRY_INTERVAL_MS = 2_000;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('[bootstrap] 缺少环境变量 DATABASE_URL，无法连接数据库');
  process.exit(1);
}

function describe(error) {
  const code = error?.code ? `${error.code} ` : '';
  return `${code}${error?.message ?? error}`;
}

async function waitForDatabase() {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  for (let attempt = 1; ; attempt += 1) {
    let connection;
    try {
      connection = await mysql.createConnection({ uri: databaseUrl, connectTimeout: 5_000 });
      await connection.query('SELECT 1');
      await connection.end();
      if (attempt > 1) console.log(`[bootstrap] 数据库已就绪（第 ${attempt} 次尝试）`);
      return;
    } catch (error) {
      if (connection) await connection.end().catch(() => {});
      if (Date.now() >= deadline) {
        console.error(`[bootstrap] 等待数据库超时（${WAIT_TIMEOUT_MS} ms）：${describe(error)}`);
        console.error('[bootstrap] 请确认 db 服务已启动并通过健康检查，且 DATABASE_URL 指向它。');
        process.exit(1);
      }
      console.log(`[bootstrap] 数据库尚未就绪（${describe(error)}），${RETRY_INTERVAL_MS / 1000} 秒后重试…`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
}

async function ensureAdminUser(connection) {
  // 与 src/lib/auth.ts 的 normalizeUsername 保持一致：登录时用户名按小写比对
  const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  if (!username) {
    console.warn('[bootstrap] 未设置 ADMIN_USERNAME，跳过管理员账号引导');
    return;
  }

  const [rows] = await connection.query('SELECT COUNT(*) AS count FROM `users`');
  const existing = Number(rows?.[0]?.count ?? 0);
  if (existing > 0) {
    console.log(`[bootstrap] users 表已有 ${existing} 条记录，跳过管理员账号引导`);
    return;
  }

  const email = (process.env.ADMIN_EMAIL || '').trim() || `${username}@localhost`;
  await connection.execute(
    'INSERT INTO `users` (`id`, `username`, `email`, `role`) VALUES (?, ?, ?, ?)',
    [randomUUID(), username, email, 'admin'],
  );
  console.log(`[bootstrap] users 表为空，已创建管理员账号 "${username}"`);
}

await waitForDatabase();

// multipleStatements：迁移文件按 --> statement-breakpoint 切分，个别版本可能把多条
// DDL 放在同一段里，打开后不会因为多语句而失败。
const connection = await mysql.createConnection({
  uri: databaseUrl,
  multipleStatements: true,
  charset: 'utf8mb4',
  timezone: 'Z',
});

try {
  await migrate(drizzle(connection), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log('[bootstrap] 数据库迁移完成');
  await ensureAdminUser(connection);
} catch (error) {
  console.error(`[bootstrap] 启动引导失败：${describe(error)}`);
  console.error('[bootstrap] 应用不会启动，避免在结构不完整的库上运行。');
  process.exitCode = 1;
} finally {
  await connection.end().catch(() => {});
}
