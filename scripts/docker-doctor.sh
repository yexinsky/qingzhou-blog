#!/bin/sh
# QzBlog 部署自检：把排查所需的信息一次性收集成一份报告，可直接贴回求助。
# 用法：在 docker-compose.yml 所在目录执行  sh scripts/docker-doctor.sh > doctor.txt
# 报告中所有密码/密钥都会打码，但仍建议自己扫一眼再外发。
set -u

cd "$(dirname "$0")/.." 2>/dev/null || true

DATA_DIR=$(grep -E '^DATA_DIR=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d '\r' || true)
[ -z "${DATA_DIR:-}" ] && DATA_DIR=./data
MYSQL_IMG=$(grep -E '^MYSQL_IMAGE=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d '\r' || true)
[ -z "${MYSQL_IMG:-}" ] && MYSQL_IMG=mysql:8.0

echo "=== 0) 当前生效的文件版本 ==="
echo "工作目录: $(pwd)"
echo "compose 文件: $(ls -l docker-compose.yml 2>/dev/null | awk '{print $6,$7,$8,$9}')"
echo "--- compose 里的依赖条件（新版应为 service_started）---"
grep -n "condition:" docker-compose.yml 2>/dev/null || echo "(未找到 condition，可能是旧版文件)"
echo "--- Dockerfile 是否支持镜像加速（新版应有 NODE_IMAGE）---"
grep -n "NODE_IMAGE" Dockerfile 2>/dev/null | head -3 || echo "(未找到 NODE_IMAGE，可能是旧版文件)"
echo "--- git 版本 ---"
git rev-parse --short HEAD 2>/dev/null || echo "(不是 git 仓库，按文件拷贝部署)"

echo
echo "=== 1) 版本与架构 ==="
docker --version 2>&1
docker compose version 2>&1
echo "宿主架构: $(uname -m)    Docker 架构: $(docker info --format '{{.Architecture}}' 2>/dev/null)"

echo
echo "=== 2) 容器状态 ==="
docker compose ps -a 2>&1

echo
echo "=== 3) db 日志（最后 80 行）==="
docker compose logs db --tail 80 2>&1

echo
echo "=== 4) app 日志（最后 40 行）==="
docker compose logs app --tail 40 2>&1

echo
echo "=== 5) 镜像架构（与宿主不一致会直接起不来）==="
docker image inspect "$MYSQL_IMG" --format "数据库镜像 $MYSQL_IMG → {{.Os}}/{{.Architecture}}" 2>&1
docker image inspect qzblog:latest --format "应用镜像 qzblog:latest → {{.Os}}/{{.Architecture}}" 2>&1

echo
echo "=== 6) MySQL 镜像能否执行 ==="
docker run --rm --entrypoint mysqld "$MYSQL_IMG" --version 2>&1 | tail -3

echo
echo "=== 7) 磁盘与内存 ==="
df -h . 2>&1
echo "--- 内存（MB）---"
free -m 2>/dev/null | head -3 || echo "(无 free 命令)"

echo
echo "=== 8) 数据目录 ==="
echo "DATA_DIR=$DATA_DIR"
ls -lna "$DATA_DIR" 2>&1 | head -10
echo "--- $DATA_DIR/mysql ---"
ls -lna "$DATA_DIR/mysql" 2>&1 | head -10

echo
echo "=== 9) 生效配置（敏感值已打码）==="
docker compose config 2>&1 \
  | sed -E 's/(PASSWORD|SECRET|TOKEN|ACCESS_KEY|_KEY|KEY_ID)([^:]*):[[:space:]]*.*/\1\2: ***已打码***/Ig' \
  | head -80

echo
echo "=== 报告结束 ==="
