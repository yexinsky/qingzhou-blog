import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import tar from 'tar-fs';
import mysql from 'mysql2/promise';
import { db, schema } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { getSiteSettings } from '@/lib/settings';
import { resolveStorageDriver, resolveStorageConfig, LOCAL_STORAGE_ROOT } from '@/lib/storage';
import { resolveDatabaseUrl } from '@/lib/database-url';
import { fireNotify } from '@/lib/notify';

export const BACKUP_ROOT = path.join(process.cwd(), 'backups');

type S3Like = import('@aws-sdk/client-s3').S3Client;

async function getS3Client(): Promise<{ client: S3Like; bucket: string } | null> {
  const config = resolveStorageConfig();
  if (!config.endpoint && !config.accessKeyId) return null;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: config.accessKeyId && config.secretAccessKey ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } : undefined,
    forcePathStyle: config.forcePathStyle,
  });
  return { client, bucket: config.bucketName };
}

/** 生成全库 SQL dump（DDL + INSERT），供恢复时整库重放 */
export async function dumpDatabase(): Promise<string> {
  // charset/timezone 与 src/lib/db.ts 保持一致：dump 内联 UTF-8 内容与 UTC 时间戳，
  // 连接字符集或时区不一致会让 4 字节字符、datetime 值在恢复后发生偏移
  const connection = await mysql.createConnection({
    uri: resolveDatabaseUrl(),
    charset: 'utf8mb4',
    timezone: 'Z',
  });
  const statements: string[] = [
    '-- QzBlog full backup',
    `-- generated at ${new Date().toISOString()}`,
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
  ];

  try {
    const [tablesResult] = await connection.query<mysql.RowDataPacket[]>('SHOW TABLES');
    const tables = tablesResult.map((row) => Object.values(row)[0] as string);

    for (const table of tables) {
      const escapedTable = `\`${table}\``;
      const [createResult] = await connection.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE ${escapedTable}`);
      const createSql = (createResult[0] as { 'Create Table': string } | undefined)?.['Create Table'];
      statements.push(`DROP TABLE IF EXISTS ${escapedTable};`);
      if (createSql) statements.push(`${createSql};`);

      const [rows] = await connection.query(`SELECT * FROM ${escapedTable}`);
      for (const row of rows as Record<string, unknown>[]) {
        const columns = Object.keys(row).map((column) => `\`${column}\``).join(', ');
        const values = Object.values(row).map((value) => escapeSqlValue(value)).join(', ');
        statements.push(`INSERT INTO ${escapedTable} (${columns}) VALUES (${values});`);
      }
    }
  } finally {
    await connection.end();
  }

  statements.push('SET FOREIGN_KEY_CHECKS = 1;');
  return statements.join('\n') + '\n';
}

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString().slice(0, 23).replace('T', ' ')}'`;
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n')}'`;
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n')}'`;
}

/** 将附件写入打包目录：local 复制磁盘目录，S3/MinIO 下载对象到 uploads/ 前缀 */
export async function stageAttachments(stageDir: string): Promise<{ storage: string; fileCount: number }> {
  const uploadsStage = path.join(stageDir, 'uploads');
  await fsp.mkdir(uploadsStage, { recursive: true });
  const driver = resolveStorageDriver();

  if (driver === 'local') {
    if (!fs.existsSync(LOCAL_STORAGE_ROOT)) return { storage: 'local', fileCount: 0 };
    let fileCount = 0;
    const copyRecursive = async (source: string, target: string) => {
      for (const entry of await fsp.readdir(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
          await fsp.mkdir(targetPath, { recursive: true });
          await copyRecursive(sourcePath, targetPath);
        } else {
          await fsp.copyFile(sourcePath, targetPath);
          fileCount += 1;
        }
      }
    };
    await copyRecursive(LOCAL_STORAGE_ROOT, uploadsStage);
    return { storage: 'local', fileCount };
  }

  const s3 = await getS3Client();
  if (!s3) return { storage: 's3', fileCount: 0 };
  const { ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');
  let fileCount = 0;
  let continuationToken: string | undefined;
  do {
    const listResult = await s3.client.send(new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: 'uploads/', MaxKeys: 1000, ContinuationToken: continuationToken }));
    for (const object of listResult.Contents ?? []) {
      const key = object.Key!;
      if (key.includes('..')) continue;
      const targetPath = path.join(uploadsStage, key.slice('uploads/'.length));
      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      const objectResult = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
      const bytes = await objectResult.Body?.transformToByteArray();
      if (bytes) {
        await fsp.writeFile(targetPath, bytes);
        fileCount += 1;
      }
    }
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);
  return { storage: 's3', fileCount };
}

/** 从备份目录恢复附件：local 直接覆盖，S3 重新上传 */
export async function restoreAttachments(stageDir: string): Promise<void> {
  const uploadsStage = path.join(stageDir, 'uploads');
  if (!fs.existsSync(uploadsStage)) return;
  const driver = resolveStorageDriver();

  if (driver === 'local') {
    await fsp.mkdir(LOCAL_STORAGE_ROOT, { recursive: true });
    const copyRecursive = async (source: string, target: string) => {
      for (const entry of await fsp.readdir(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
          await fsp.mkdir(targetPath, { recursive: true });
          await copyRecursive(sourcePath, targetPath);
        } else {
          await fsp.copyFile(sourcePath, targetPath);
        }
      }
    };
    await copyRecursive(uploadsStage, LOCAL_STORAGE_ROOT);
    return;
  }

  const s3 = await getS3Client();
  if (!s3) return;
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const walk = async (dir: string, prefix = '') => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const key = `uploads/${prefix}${entry.name}`;
      if (entry.isDirectory()) {
        await walk(fullPath, `${prefix}${entry.name}/`);
      } else {
        const body = await fsp.readFile(fullPath);
        await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: guessContentType(entry.name) }));
      }
    }
  };
  await walk(uploadsStage);
}

function guessContentType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  const map: Record<string, string> = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };
  return map[extension] ?? 'application/octet-stream';
}

/** 打包 tar.gz：目录 → gzip 流 → 备份文件 */
export async function packDirectoryToTarGz(sourceDir: string, targetFile: string): Promise<void> {
  await fsp.mkdir(path.dirname(targetFile), { recursive: true });
  await pipeline(tar.pack(sourceDir), zlib.createGzip(), fs.createWriteStream(targetFile));
}

/** 解包 tar.gz：备份文件 → gunzip → 目标目录 */
export async function extractTarGzToDirectory(sourceFile: string, targetDir: string): Promise<void> {
  await fsp.mkdir(targetDir, { recursive: true });
  await pipeline(fs.createReadStream(sourceFile), zlib.createGunzip(), tar.extract(targetDir));
}

/** 整站备份：数据库 dump + 附件打包为 tar.gz，写入 backups/ 并登记（PRD 11.11） */
export async function createBackup(note?: string): Promise<{ id: string; filename: string; size: number }> {
  const backupId = randomUUID();
  const filename = `qzblog-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
  const filePath = path.join(BACKUP_ROOT, filename);

  const [record] = await db.insert(schema.backups).values({ id: backupId, filename, status: 'running', note: note ?? null }).$returningId();

  const stageDir = path.join(BACKUP_ROOT, `stage-${backupId}`);
  try {
    await fsp.mkdir(stageDir, { recursive: true });
    const dump = await dumpDatabase();
    await fsp.writeFile(path.join(stageDir, 'data.sql'), dump, 'utf8');
    const attachments = await stageAttachments(stageDir);
    await fsp.writeFile(path.join(stageDir, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), storage: attachments.storage, attachmentFiles: attachments.fileCount }, null, 2), 'utf8');

    await packDirectoryToTarGz(stageDir, filePath);
    const stat = await fsp.stat(filePath);

    await db.update(schema.backups).set({ status: 'success', size: stat.size }).where(eq(schema.backups.id, record.id));
    await enforceRetentionPolicy();
    fireNotify('backup.completed', { title: '备份完成', summary: `整站备份 **${filename}** 已生成（${(stat.size / 1024 / 1024).toFixed(2)} MB）` });
    return { id: record.id, filename, size: stat.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'backup failed';
    console.error('Backup failed:', message);
    await db.update(schema.backups).set({ status: 'failed', note: message.slice(0, 255) }).where(eq(schema.backups.id, record.id)).catch(() => undefined);
    await fsp.rm(filePath, { force: true }).catch(() => undefined);
    fireNotify('backup.failed', { title: '备份失败', summary: `备份创建失败：${message.slice(0, 120)}` });
    throw error;
  } finally {
    await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** 保留策略：最多保留 N 份（默认 5），超限滚动淘汰最旧（PRD 11.11） */
export async function enforceRetentionPolicy(): Promise<number> {
  const settings = await getSiteSettings();
  const keepCount = Math.max(1, settings.backupKeepCount ?? 5);

  const records = await db.query.backups.findMany({
    where: eq(schema.backups.status, 'success'),
    orderBy: [asc(schema.backups.createdAt)],
  });

  let removed = 0;
  for (const record of records.slice(0, Math.max(0, records.length - keepCount))) {
    await fsp.rm(path.join(BACKUP_ROOT, record.filename), { force: true }).catch(() => undefined);
    await db.delete(schema.backups).where(eq(schema.backups.id, record.id));
    removed += 1;
  }
  return removed;
}

/** 整站恢复：解包 → 数据库重放 → 附件写回；恢复前自动先做当前状态备份（PRD 11.11） */
export async function restoreFromBackup(archiveFile: string): Promise<{ restored: boolean }> {
  const stageDir = path.join(BACKUP_ROOT, `restore-${randomUUID()}`);
  try {
    // 恢复前自动先做当前状态备份（危险操作保护）
    await createBackup('恢复前自动备份');

    await extractTarGzToDirectory(archiveFile, stageDir);
    const dumpPath = path.join(stageDir, 'data.sql');
    if (!fs.existsSync(dumpPath)) throw new Error('备份包中缺少 data.sql');

    const dump = await fsp.readFile(dumpPath, 'utf8');
    const connection = await mysql.createConnection({
      uri: resolveDatabaseUrl(),
      multipleStatements: true,
      charset: 'utf8mb4',
      timezone: 'Z',
    });
    try {
      await connection.query(dump);
    } finally {
      await connection.end();
    }

    await restoreAttachments(stageDir);
    return { restored: true };
  } finally {
    await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
