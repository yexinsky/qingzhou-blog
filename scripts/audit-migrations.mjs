#!/usr/bin/env node
// 校验 drizzle 迁移链能否"从零重放"。
//
// 背景：迁移文件若被手工改过（或在已应用的库里补过语句），可能出现同一条语句
// 在不同迁移文件里重复——例如 0000 建表时就带上了 CHECK 约束，0001 又 ADD 一次。
// 这类问题在"逐步增量迁移出来"的开发库上完全看不出来，只有全新部署（空库从 0000
// 依次执行）才会失败，而那时报错发生在容器启动阶段，排查成本很高。
//
// 用法：node scripts/audit-migrations.mjs
// 退出码：0 = 可重放；1 = 发现冲突（会列出文件与第几条语句）。
import fs from 'node:fs';
import path from 'node:path';

const BT = String.fromCharCode(96); // 反引号，避免在正则里转义
const MIGRATIONS_DIR = process.argv[2] || 'drizzle';

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();
if (files.length === 0) {
  console.error('未找到迁移文件：' + MIGRATIONS_DIR + '/*.sql');
  process.exit(1);
}

const tables = new Map(); // 表名 -> { columns:Set, indexes:Set }
const constraints = new Set(); // CHECK / FK / UNIQUE 约束名（MySQL 中按库唯一）
const conflicts = [];

const name = '([a-zA-Z0-9_]+)';
const re = {
  createTable: new RegExp('^CREATE TABLE ' + BT + name + BT),
  alterTable: new RegExp('^ALTER TABLE ' + BT + name + BT + ' ([\\s\\S]*)$'),
  addColumn: new RegExp('^ADD ' + BT + name + BT),
  addConstraint: new RegExp('^ADD CONSTRAINT ' + BT + name + BT),
  dropColumn: new RegExp('^DROP COLUMN ' + BT + name + BT),
  dropConstraint: new RegExp('^DROP CONSTRAINT ' + BT + name + BT),
  createIndex: new RegExp('^CREATE INDEX ' + BT + name + BT + ' ON ' + BT + name + BT),
  dropIndex: new RegExp('^DROP INDEX ' + BT + name + BT + ' ON ' + BT + name + BT),
  columnLine: new RegExp('^' + BT + name + BT + ' '),
  constraintLine: new RegExp('^CONSTRAINT ' + BT + name + BT),
  dropTable: new RegExp('^DROP TABLE (?:IF EXISTS )?' + BT + name + BT),
};

const table = (t) => {
  if (!tables.has(t)) tables.set(t, { columns: new Set(), indexes: new Set() });
  return tables.get(t);
};

for (const file of files) {
  const statements = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').split('--> statement-breakpoint');
  statements.forEach((raw, index) => {
    const stmt = raw.trim().replace(/;+$/, '');
    if (!stmt) return;
    const where = file + ' 第 ' + (index + 1) + ' 条';
    const conflict = (msg) => conflicts.push(msg + '  @ ' + where);

    const mCreate = re.createTable.exec(stmt);
    if (mCreate) {
      if (tables.has(mCreate[1])) conflict('重复建表 ' + mCreate[1]);
      const t = table(mCreate[1]);
      for (const line of stmt.slice(stmt.indexOf('(') + 1).split('\n')) {
        const l = line.trim().replace(/,$/, '');
        const col = re.columnLine.exec(l);
        if (col) t.columns.add(col[1]);
        const con = re.constraintLine.exec(l);
        if (con) {
          if (constraints.has(con[1])) conflict('重复约束 ' + con[1]);
          constraints.add(con[1]);
        }
      }
      return;
    }

    const mIndex = re.createIndex.exec(stmt);
    if (mIndex) {
      const t = tables.get(mIndex[2]);
      if (!t) return conflict('在未知表上建索引 ' + mIndex[2]);
      if (t.indexes.has(mIndex[1])) conflict('重复索引 ' + mIndex[1] + ' on ' + mIndex[2]);
      t.indexes.add(mIndex[1]);
      return;
    }

    const mIndexDrop = re.dropIndex.exec(stmt);
    if (mIndexDrop) {
      tables.get(mIndexDrop[2])?.indexes.delete(mIndexDrop[1]);
      return;
    }

    const mTableDrop = re.dropTable.exec(stmt);
    if (mTableDrop) {
      tables.delete(mTableDrop[1]);
      return;
    }

    const mAlter = re.alterTable.exec(stmt);
    if (mAlter) {
      const t = tables.get(mAlter[1]);
      if (!t) return conflict('ALTER 未知表 ' + mAlter[1]);
      const body = mAlter[2];
      const col = re.addColumn.exec(body);
      if (col) {
        if (t.columns.has(col[1])) conflict('重复加列 ' + mAlter[1] + '.' + col[1]);
        t.columns.add(col[1]);
        return;
      }
      const con = re.addConstraint.exec(body);
      if (con) {
        if (constraints.has(con[1])) conflict('重复约束 ' + con[1]);
        constraints.add(con[1]);
        return;
      }
      const dropCol = re.dropColumn.exec(body);
      if (dropCol) {
        t.columns.delete(dropCol[1]);
        return;
      }
      const dropCon = re.dropConstraint.exec(body);
      if (dropCon) {
        constraints.delete(dropCon[1]);
        return;
      }
      return; // MODIFY / RENAME 等无需检查
    }

    // 数据回填等 DML 不参与结构冲突检查
    if (!/^(UPDATE|INSERT|DELETE|SET|--|\/\*)/.test(stmt)) conflict('未识别语句：' + stmt.slice(0, 60).replace(/\n/g, ' '));
  });
}

console.log('扫描迁移文件 ' + files.length + ' 个：' + files.join('、'));
console.log('累计建表 ' + tables.size + ' 张，约束 ' + constraints.size + ' 个');
if (conflicts.length === 0) {
  console.log('迁移链可从零重放 ✓');
  process.exit(0);
}
console.error('发现 ' + conflicts.length + ' 处重放冲突（全新数据库会依次失败）：');
for (const c of conflicts) console.error('  ✗ ' + c);
process.exit(1);
