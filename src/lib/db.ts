import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../db/schema';
import { resolveDatabaseUrl } from './database-url';

// `next build` 会为收集路由数据导入本模块，构建期没有数据库配置也必须能构建完成；
// 单元测试同样会在无数据库配置下导入。这两种环境下只记录原因，把失败留给首次查询，
// 运行期（开发/生产服务器）则直接抛出，尽早暴露部署配置缺失。
const tolerateMissingDatabaseConfig =
  process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'test';

function databaseUri(): string | undefined {
  try {
    return resolveDatabaseUrl();
  } catch (error) {
    if (!tolerateMissingDatabaseConfig) throw error;
    console.error(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

const queryClient = mysql.createPool({
  uri: databaseUri(),
  connectionLimit: 10,
  enableKeepAlive: true,
  timezone: 'Z',
  charset: 'utf8mb4',
});

queryClient.on('connection', (connection) => {
  void connection.query("SET time_zone = '+00:00'");
});

export const db = drizzle(queryClient, { schema, mode: 'default' });

export { schema };
export type Database = typeof db;
