# Docker Compose 部署指南（含飞牛 fnOS 注意事项）

本文对应仓库根目录的 `Dockerfile`、`docker-compose.yml`、`.env.docker.example`。
默认部署形态是 **app + MySQL 两个容器**，附件存本地卷、限流用进程内计数，
不依赖任何外部服务，适合在 NAS（飞牛 / 群晖 / 通用 Linux）上长期自托管。

---

## 1. 部署前准备

- 飞牛的 Docker 服务已开启（应用中心 → Docker）。
- 能通过 SSH 登录飞牛（本文命令都在 SSH 终端里执行；飞牛自带「终端」应用即可）。
- **镜像源要事先确认可用**。基础镜像（`node:22-bookworm-slim`）与 `mysql:8.0` 都要从 Docker Hub 拉，
  国内直连基本不通（`connection reset`），必须走加速。飞牛的加速在「Docker → 设置 → 镜像仓库/加速地址」，
  但**飞牛自带的 `docker.fnnas.com` 可能不可用**：它对 `library/node` 返回 `401 Unauthorized`
  且响应里没有 `WWW-Authenticate`（客户端拿不到 token），构建会直接失败在
  `load metadata for node:22-bookworm-slim`。
  为此 `.env.docker.example` 里的 `NODE_IMAGE` / `MYSQL_IMAGE` / `MINIO_IMAGE` / `NPM_REGISTRY`
  **默认就指向公共加速地址**，照着模板填 `.env` 即可构建成功；能直连 Docker Hub 或已换好飞牛加速时，
  把这几行注释掉就回到官方镜像名。若报错信息里的镜像名仍是 `docker.io/library/node`（不带加速前缀），
  说明加速没生效，按第 8 节排查。

## 2. 三步部署

```bash
# 1) 取代码（放在存储卷上，不要放在系统盘的小分区里）
cd /vol1/1000                       # 换成你自己的存储卷路径
git clone <本仓库地址> qzblog && cd qzblog

# 2) 准备环境变量
cp .env.docker.example .env
vi .env                             # 至少填 4 项，见下一节

# 3) 构建并启动
docker compose up -d --build
```

启动后访问 `http://<飞牛地址>:8080`（端口由 `.env` 的 `WEB_PORT` 决定）。

首次启动时 app 容器会先等 MySQL 就绪、自动执行数据库迁移，并在 `users` 表为空时
创建管理员账号，然后才拉起服务：

```bash
docker compose logs -f app
# [bootstrap] 数据库已就绪（第 3 次尝试）
# [bootstrap] 数据库迁移完成
# [bootstrap] users 表为空，已创建管理员账号 "admin"
#   ▲ Next.js 15.5.21
#   - Local:        http://0.0.0.0:3000
```

> 管理员账号的密码不落库：登录时用 `.env` 里的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 校验，
> 数据库里只存用户名、邮箱与角色。引导脚本只在 `users` 表**为空**时插入一行，
> 已有数据的环境（含从备份恢复的库）不会被改动。

### `.env` 必填项

| 变量 | 说明 |
|------|------|
| `SITE_URL` / `NEXTAUTH_URL` | 你实际访问博客的地址，含端口，末尾不要斜杠。**填错会导致登录后跳回错误地址** |
| `NEXTAUTH_SECRET` | 至少 32 位随机字符，生成：`openssl rand -base64 32` |
| `ADMIN_PASSWORD` | 后台登录密码，请用长且唯一的密码 |
| `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | 数据库密码。**这一组变量同时决定容器里建什么库/账号和应用怎么连库**，无需再手写 `DATABASE_URL` |

可选：`ADMIN_EMAIL`（管理员邮箱，默认 `<用户名>@localhost`）。
`ADMIN_USERNAME` 会被规范化为小写后与库中记录比对，建议直接用小写用户名。

登录入口：`http://<飞牛地址>:8080/console/login`，用户名默认 `admin`（`ADMIN_USERNAME`）。

#### 数据库配置为什么不用写连接串

应用支持两种等价写法（见 `src/lib/database-url.ts`）：

```ini
# 写法一：完整连接串（本机开发常用）
DATABASE_URL=mysql://qzblog:密码@localhost:3306/qzblog

# 写法二：分项变量（Docker Compose 用这套），密码只写一处，特殊字符无需转义
MYSQL_HOST=db            # compose 自动设为服务名 db，不用你填
MYSQL_DATABASE=qzblog
MYSQL_USER=qzblog
MYSQL_PASSWORD=密码
```

容器里用的是写法二：`.env` 里的 `MYSQL_*` 既用于初始化 MySQL 容器，也由应用直接读取
（compose 会把 `MYSQL_HOST` 设为 `db`），因此不存在"env 里写 URL、compose 却要密码"
的割裂。如果更习惯连接串，在 `docker-compose.yml` 的 app 服务里补一行 `DATABASE_URL`
即可，应用会优先使用它（注意自己做 URL 编码）。

#### 同一份目录里已有开发用 `.env` 时

`.env` 是 compose 默认读取的文件名，而开发用的 `.env` 里 `SITE_URL`/`NEXTAUTH_URL` 指向
`localhost`，直接拿来启动容器会导致登录后跳回错误地址。推荐把容器用的配置单独放一份：

```bash
cp .env.docker.example .env.docker    # 填容器专用的地址与密码
docker compose --env-file .env.docker up -d --build
```

> 忘记填必填项时，`docker compose up` 会直接报错并指出缺哪个变量，不会带着空密钥启动。

## 3. 飞牛 fnOS 上容易踩的点

### 3.1 端口占用

- 飞牛自己的 Web 管理界面默认占用 **8000 / 8001**，请不要把 `WEB_PORT` 设成这两个。
- 其它容器常占用 3000 / 9000 / 8080 / 8090 等；冲突时改 `.env` 的 `WEB_PORT` 一条即可
  （容器内部固定监听 3000，只有宿主机映射端口变化）。
- **MySQL 不映射到宿主机**（符合 PRD 5.5 的要求），只有 app 容器能连；
  所以不会有 3306 冲突。需要用客户端连库时，在 `docker-compose.yml` 里
  把 `db` 的 `ports` 注释取消，并确认只在内网开放。

### 3.2 数据放在哪、权限怎么处理

| 数据 | 位置 | 权限 |
|------|------|------|
| 数据库文件 | 宿主 `DATA_DIR/mysql`（默认 `./data/mysql`） | MySQL 镜像自己以 root 修正属主，不用管 |
| 附件上传 | 命名卷 `qzblog_uploads` | 卷首次使用时由 Docker 从镜像复制属主，天然可写，不用管 |
| 站点备份包 | 命名卷 `qzblog_backups` | 同上 |
| MinIO 对象（可选） | 命名卷 `qzblog_minio` | 同上 |

- `DATA_DIR` **必须放在存储卷上**，例如 `DATA_DIR=/vol1/1000/qzblog`。默认的 `./data`
  会落在源码目录里，若源码在系统盘，长期写库会撑爆系统分区。
- 不要把 `DATA_DIR` 指向 SMB/NFS 网络共享或 exFAT/NTFS 外置盘：InnoDB 依赖文件锁与
  POSIX 权限，这类位置上常见启动失败或数据损坏。飞牛内部存储卷（ext4/btrfs）没有这个问题。
- 命名卷实际位置可用 `docker volume inspect qzblog_uploads`（`Mountpoint` 字段）查看，
  名字前缀是项目名（即 compose 文件所在目录名）。想在文件管理器里直接看到附件，
  可以把 `docker-compose.yml` 里 app 的两行命名卷换成注释中的绑定挂载，但要额外满足：
  路径属主必须与 `PUID:PGID` 一致，否则上传图片会 500、创建备份会失败
  （日志里是 `EACCES: permission denied`）：

  ```bash
  ls -ln /vol1/1000/qzblog/uploads      # 第三、四列是 uid/gid
  sudo chown -R 1000:1000 /vol1/1000/qzblog/uploads /vol1/1000/qzblog/backups
  ```

### 3.3 构建速度与拉取源

镜像在 NAS 上首次构建需要装依赖，CPU 较弱的机型可能要几分钟到十几分钟，属正常现象。
构建过程有两个源可以换：

- 基础镜像：在 `.env` 里用 `NODE_IMAGE` / `MYSQL_IMAGE` / `MINIO_IMAGE` 指定带加速前缀的镜像名。
- npm 依赖：在 `.env` 里设 `NPM_REGISTRY=https://registry.npmmirror.com`
  （实测国内 `registry.npmjs.org` 响应常在 10 秒以上，`npm ci` 会非常慢甚至超时）。

不想在 NAS 上构建，可以在 PC 上构建后传过去：

```bash
# PC 上（与 NAS 同架构，飞牛为 x86_64）
docker build -t qzblog:latest .
docker save qzblog:latest | gzip > qzblog.tar.gz
# 传到 NAS 后
gunzip -c qzblog.tar.gz | docker load
docker compose up -d          # 不必再加 --build，直接使用已加载的镜像
```

### 3.4 用飞牛的 Docker 图形界面部署

飞牛的「Compose 项目」可以直接粘贴 `docker-compose.yml` 内容，但要注意两点：

- 项目目录就是 `DATA_DIR=./data` 的相对基准目录，建议在 `.env` 里把 `DATA_DIR`
  写成存储卷的绝对路径，避免数据落在不期望的位置。
- 图形界面里修改 `.env` 不方便，建议先在 SSH 里把 `.env` 准备好再启动项目。

## 4. 日常运维

```bash
docker compose ps                 # 查看状态（app 应为 healthy）
docker compose logs -f app        # 跟踪应用日志
docker compose logs app | grep bootstrap   # 看迁移与管理员账号引导结果
docker compose restart app        # 重启应用
docker compose down               # 停止并删除容器（数据保留在 DATA_DIR 与命名卷中）
docker compose up -d --build      # 更新代码后重建（会自动跑增量迁移）
```

### 升级流程

```bash
git pull                 # 或替换源码文件
docker compose up -d --build
```

启动时的自动迁移是**增量且幂等**的：已执行过的迁移不会重跑（记录在库里的
`__drizzle_migrations` 表）。若想手动跳过迁移，在 `.env` 里设 `RUN_MIGRATIONS=false`。

### 备份

`docker compose down` **不会**删除数据（数据库在 `DATA_DIR/mysql`，附件与备份在命名卷里），
但备份仍建议做两份：

1. **站点内置备份**（最省事）：后台「备份」页生成整站备份（数据库 dump + 附件打包），
   可一键下载到本地，产物同时也落在 `qzblog_backups` 卷里。
2. **离线快照**：停机后分别打包数据库目录与两个命名卷：

   ```bash
   docker compose stop
   tar czf qzblog-db-$(date +%F).tar.gz -C /vol1/1000/qzblog/mysql .
   docker run --rm -v qzblog_uploads:/data -v "$PWD":/backup alpine \
     tar czf /backup/qzblog-uploads-$(date +%F).tar.gz -C /data .
   docker compose start
   ```

   不要在 MySQL 运行时直接复制 `mysql/` 目录，可能拿到不一致的库文件。
   用命名卷时卷名前缀是项目名（目录名），可用 `docker volume ls` 确认实际名称。

## 5. HTTPS 与反向代理

默认按**明文 HTTP**部署（内网直连），此时 `ENFORCE_HTTPS=false` 是必须的：
置为 `true` 时响应头会带 `upgrade-insecure-requests`，浏览器会把同源静态资源也
改写成 `https://`，而该地址没有 HTTPS 监听，页面会直接丢样式和脚本。

要上 HTTPS / 域名，在前面加一层反向代理（飞牛自带反向代理功能时可直接用，也可另起 nginx）：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;              # 必须由代理覆写
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# PRD 5.5 建议：后台入口额外加一层访问控制
location /console {
    allow 192.168.0.0/16;
    deny all;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

配套改动：

1. `.env` 里 `SITE_URL` / `NEXTAUTH_URL` 改成对外域名（`https://blog.example.com`）。
2. `.env` 里 `TRUSTED_PROXY_IP_HEADER=x-real-ip`——**只有在代理确实覆写了该头时才填**，
   否则客户端可以伪造它绕过限流；直连时留空。
3. 用上 HTTPS 后把 `ENFORCE_HTTPS=true`，并重新构建镜像：`docker compose up -d --build`
   （该开关在构建期写入响应头，改完必须重建）。

## 6. 附件存储切换到 MinIO（可选）

默认附件存本地卷（`qzblog_uploads`，经 `/api/files/*` 同源提供）。要改用 MinIO：

1. `.env` 填 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`，并把
   `ATTACHMENTS_STORAGE` 改为 `s3`、`S3_PUBLIC_URL=http://<飞牛地址>:9000/qzblog`
   （`S3_ENDPOINT` 用容器内地址 `http://minio:9000`，`S3_ACCESS_KEY_ID/SECRET` 与
   MinIO 的 root 账号一致）。
2. 启动：`docker compose --profile minio up -d --build`
3. 建桶并设为公开只读（应用不会自己设 ACL）。用 MinIO 控制台
   （`http://<飞牛地址>:9001`）创建 `qzblog` 桶，并把访问策略设为可匿名读取；
   或在该容器内有 `mc` 命令时：

   ```bash
   docker compose --profile minio exec minio mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
   docker compose --profile minio exec minio mc mb --ignore-existing local/qzblog
   docker compose --profile minio exec minio mc anonymous set download local/qzblog
   ```

若用**其它地址**访问图片（例如换成域名、或 MinIO 不在本机），要把该来源加进
`EXTRA_IMAGE_HOSTS`（逗号分隔，填 origin 如 `http://192.168.5.2:9000`）并重新构建，
否则会被 CSP 的 `img-src` 拦掉。`S3_PUBLIC_URL` 会自动进入白名单，无需重复填。

## 7. 多副本 / 跨实例限流（可选）

默认 `RATE_LIMIT_BACKEND=memory`：限流计数保存在应用进程内存中，重启清零，
**仅适用于单实例部署**（限流对评论、点赞、登录、以及公开 API 都生效）。

要让多个副本共享计数，填 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
（[Upstash](https://upstash.com/) 的 Redis REST 接口，或自建的 Upstash 兼容网关），
此时 `RATE_LIMIT_BACKEND` 失效、自动走 Redis。

> 注意：上游设计里生产环境若既没有 Redis 配置、又不允许内存限流，会让所有被限流的
> 接口返回 503（包括登录）。因此**不要**在单实例部署时把 `RATE_LIMIT_BACKEND` 删掉。

## 8. 故障排查

| 症状 | 原因与处理 |
|------|-----------|
| 构建报 `401 Unauthorized` / `failed to resolve source metadata for docker.io/library/node` | 镜像加速不可用：飞牛自带的 `docker.fnnas.com` 会返回 **不带 `WWW-Authenticate`** 的 401，客户端取不到 token。`.env.docker.example` 默认已指向 `docker.m.daocloud.io`，但**若报错信息里的镜像名仍是 `docker.io/library/node`**（而不是加速前缀），说明加速地址没生效——先用 `docker compose config \| grep -E "NODE_IMAGE\|image:"` 确认 compose 读到的取值，再检查：① 改的是 compose 文件同目录的 `.env` 吗；② 是否漏了 `docker compose build --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim` 这一步的 `--build`。更彻底的做法是把飞牛「Docker → 设置 → 镜像仓库/加速地址」换成可用加速（如 `https://docker.m.daocloud.io`），之后三行 `*_IMAGE` 都可以注释掉。实测 2026-09：`docker.m.daocloud.io`、`docker.1ms.run` 可用，`hub.rat.dev`（302）、`docker.xuanyuan.me`（403）不能当 registry 用 |
| 构建中 `npm ci` 极慢或超时 | 默认 npm 源在部分网络下响应 10 秒以上：在 `.env` 里设 `NPM_REGISTRY=https://registry.npmmirror.com` |
| up 时出现 `app Pulling` 与 `connection reset by peer`，随后继续构建 | 正常现象：应用镜像是本地构建的，compose 只是先尝试拉取同名远程镜像，失败即转入构建，可忽略 |
| 构建日志里 `WARNING: current commit information was not captured by the build` | 正常现象：`.dockerignore` 排除了 `.git`，BuildKit 拿不到提交信息做元数据，可忽略 |
| `docker compose up` 报缺少某个变量 | `.env` 未填写必填项，按提示补齐后再执行 |
| app 容器反复重启，日志停在「等待数据库超时」 | `db` 没起来：看 `docker compose logs db`；常见原因是数据目录权限或磁盘满 |
| 登录后跳回奇怪地址 / 登录失败 | 先确认 `SITE_URL`、`NEXTAUTH_URL` 与实际访问地址一致，改完 `docker compose up -d` |
| 改了 `ADMIN_USERNAME` 后登录失败 | 数据库 `users` 表里没有这个用户名（引导脚本只在表为空时建号）。用 SQL 插入对应 username 的 admin 记录，或改回原用户名 |
| 忘记后台密码 | 密码不在库里，直接改 `.env` 的 `ADMIN_PASSWORD` 后 `docker compose up -d` 即可 |
| 页面能打开但没有样式、控制台报 https 相关错误 | `ENFORCE_HTTPS=true` 但用 http 访问：改回 `false` 后 `--build` 重建 |
| 上传图片 500、备份失败 | 仅在改用绑定挂载存放附件时出现：目录属主与容器运行用户不一致，执行 `chown -R 1000:1000 <目录>`（见 3.2） |
| 图片不显示（MinIO） | 桶策略未设为公开读取，或地址不在 CSP 白名单（填 `EXTRA_IMAGE_HOSTS` 后重建） |
| MinIO 启动失败 / 报权限错误 | 看 `docker compose --profile minio logs minio`；数据卷属主不对时可 `docker compose --profile minio down` 后删除 `qzblog_minio` 卷重建（卷内没有需要保留的数据时才这么做） |
| 接口返回 503 `RATE_LIMIT_UNAVAILABLE` | 限流后端不可用：确认 `RATE_LIMIT_BACKEND=memory` 或 Upstash 配置正确 |
| 评论区/点赞出现 429 | 触发限流阈值（评论 10 次/分、点赞 10 次/分、全局 100 次/分）。直连部署未设 `TRUSTED_PROXY_IP_HEADER` 时，所有访客共用一个计数桶，访问量大时容易命中；配上反向代理并按 5.2 设置该变量可恢复按 IP 计数 |
| 端口被占用（`bind: address already in use`） | 改 `.env` 的 `WEB_PORT`（避开飞牛自带的 8000/8001） |

## 9. 本方案的实现约束（改代码时注意）

- **新增读数据库的页面/布局必须声明 `export const dynamic = 'force-dynamic'`**（或使用
  `searchParams`/`cookies` 等动态 API）。否则 `next build` 会在构建期连库并预渲染，
  导致镜像构建必须挂数据库、且内容被冻结进镜像。
- 容器内引导脚本（`docker/bootstrap.mjs`）与 `npm run db:migrate` 用的是**同一个
  drizzle-orm 迁移器**、同一张 `__drizzle_migrations` 表，本地迁移过的库不会重复执行。
  它依赖的 `drizzle-orm`、`mysql2` 通过 `next.config.js` 的 `outputFileTracingIncludes`
  打进镜像（Next 默认会把这两个包打散到服务端 chunk 里，standalone 的 node_modules
  不会有它们）。
- 数据库连接支持 `DATABASE_URL` 与 `MYSQL_*` 两种写法（优先级见
  `src/lib/database-url.ts`）。容器里走 `MYSQL_*`，因此 **`src/lib/database-url.ts` 与
  `docker/bootstrap.mjs` 里的同名解析逻辑必须同步修改**（后者无法 import 前者）。
- `ENFORCE_HTTPS`、`S3_PUBLIC_URL`、`EXTRA_IMAGE_HOSTS` 是**构建期**变量，改动后必须
  重新构建镜像。
- 应用以非 root 运行；`uploads/`、`backups/` 是持久化卷，容器内路径 `/app/uploads`、
  `/app/backups`。

## 10. 验证范围说明

本方案已在开发机上验证：**完全不提供数据库配置时 `next build` 仍能构建成功**（构建期容忍缺配置，
运行期缺配置则直接抛出明确错误）、standalone 产物齐备（含 sharp 的 `@img` 平台二进制与迁移所需的
drizzle-orm / mysql2）、**只给 MYSQL_* 分项变量时应用能启动并正常响应**（`/console/login` 返回 200）、
迁移与引导脚本能正确解析 `drizzle/` 下的全部迁移并按预期重试等待数据库、compose 文件 YAML 与变量插值
有效（只填必填项时无报错）。

**未**在本机验证：容器镜像实际的构建与运行（开发机没有 Docker 环境，也没有可用的
MySQL 实例），因此首次在飞牛上部署时请对照第 8 节的排查表。
