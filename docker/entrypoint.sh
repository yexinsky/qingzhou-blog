#!/bin/sh
# 容器入口：先确保数据库结构与管理员账号就绪，再把 PID 1 交给应用进程。
set -e

cd /app

if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  # 引导脚本放在 tools/ 下，才能解析到那里为它准备的 mysql2/drizzle-orm 依赖树
  node tools/bootstrap.mjs
fi

# exec 让 node 成为 PID 1，docker stop 发送的 SIGTERM 能直接送达应用。
exec "$@"
