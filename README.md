# QzBlog — 个人技术博客

基于 Next.js 15（App Router）+ MySQL 8 + MinIO 的全栈个人博客系统，面向开发者个人品牌站点：写作发布、动态分享、作品展示与学习路线沉淀，内置管理后台与评论审核。

## 功能特性

**前台**

- 📝 **文章**：Markdown 写作（GFM 表格/任务列表）、代码语法高亮（highlight.js）、数学公式（KaTeX）、自动目录（TOC 锚点跳转）、阅读计数、相关文章推荐
- 🗒️ **动态**：短内容 + 配图时间线
- 💬 **评论**：访客留言（昵称 + 邮箱），提交后进入待审核队列
- 👍 **点赞 / 收藏 / 分享**：按日去重点赞、localStorage 收藏、Web Share/剪贴板分享
- 🏷️ 标签 / 分类 / 系列归档，学习路线、项目展示、时间线页面
- 🌙 明暗主题切换（无闪烁）、RSS 与 sitemap、自定义 404

**管理后台**（`/admin`，凭据登录，middleware + 服务端双重鉴权）

- 文章管理：Markdown 编辑器（工具栏 + 实时预览）、封面图、标签/系列、草稿 / 立即发布 / 定时发布、置顶、搜索与状态筛选
- 动态管理、评论审核（通过 / 拒绝 / 置顶 / 删除）、个人资料维护
- 图片上传：sharp 压缩转 WebP 后存入 S3/MinIO，桶策略公开只读
- 删除等危险操作均使用页内确认弹窗（无原生对话框）

## 技术栈

| 类别 | 方案 |
|------|------|
| 框架 | Next.js 15 (App Router, SSR/ISR) + React 18 + TypeScript |
| 样式 | Tailwind CSS（typography 排版插件） |
| 数据库 | MySQL 8.0（utf8mb4）+ Drizzle ORM |
| 认证 | NextAuth.js（管理员凭据登录；GitHub OAuth 预留） |
| 对象存储 | MinIO / S3 兼容存储（AWS SDK v3） |
| Markdown | remark + rehype 生态（GFM、KaTeX、highlight.js、sanitize） |
| 测试 | Jest + Testing Library（单元/组件测试） |

## 快速开始

### 环境要求

- Node.js ≥ 20、MySQL 8.0、MinIO（或任意 S3 兼容存储）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```ini
DATABASE_URL=mysql://user:password@localhost:3306/qzblog   # 业务数据库
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<至少 32 位随机字符串>
ADMIN_USERNAME=<管理员用户名>          # 需与 users 表中的账号一致
ADMIN_PASSWORD=<管理员密码>
MINIO_ENDPOINT=<MinIO 地址，如 192.168.5.2>
MINIO_PORT=9000
MINIO_ACCESS_KEY=<AccessKey>
MINIO_SECRET_KEY=<SecretKey>
MINIO_BUCKET=qzblog
MINIO_PUBLIC_URL=http://<host>:9000/qzblog   # 需与 CSP/next.config 白名单一致
ANONYMOUS_ID_SECRET=<32+ 位随机字符串>       # 匿名点赞标识
```

> 注意：`.env` 已被 gitignore，切勿提交真实凭据。管理员账号需预先存在于 `users` 表（登录只校验、不建号）。

### 3. 初始化数据库

```bash
npm run db:migrate     # 应用 drizzle 迁移
# 可选：写入首页示例数据
npm run db:seed:home:apply
```

### 4. 启动

```bash
npm run dev            # 开发模式 http://localhost:3000
npm run build && npm start   # 生产模式
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` / `build` / `start` | 开发 / 构建 / 生产启动 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 运行 Jest 测试 |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle 迁移生成 / 应用 / 推送 |
| `npm run db:studio` | Drizzle 数据库可视化管理 |
| `npm run db:seed:home:apply` / `db:cleanup:home:apply` | 写入 / 清理首页示例数据 |

## 目录结构

```
├── src/
│   ├── app/                # App Router 页面与 API 路由
│   │   ├── admin/          # 管理后台（文章/动态/评论/资料）
│   │   ├── (auth)/         # 登录页（独立布局）
│   │   ├── api/            # REST API（posts/moments/comments/likes/upload/...）
│   │   └── posts|moments|learning|projects|timeline/...
│   ├── components/         # UI / 布局 / 文章 / 评论 / 管理端组件
│   ├── lib/                # db、auth、markdown 渲染管线、storage、rate-limit
│   ├── db/                 # Drizzle schema
│   └── hooks/              # React Hooks
├── drizzle/                # 迁移文件
├── scripts/                # 种子数据与运维脚本
├── nginx/                  # 反向代理与 SSL 配置参考
└── tests/                  # Jest 单元/组件测试
```

## 测试

```bash
npm test        # 全量单元测试
npm run lint    # 代码风格检查
```

## Docker Compose 部署

仓库内置 `Dockerfile` 与 `docker-compose.yml`，默认启动 **app + MySQL** 两个容器：
附件存本地磁盘卷、限流用进程内计数，不依赖任何外部服务，适合在 NAS（飞牛 / 群晖）或自有服务器上长期自托管。

```bash
cp .env.docker.example .env    # 填必填项：SITE_URL/NEXTAUTH_URL、NEXTAUTH_SECRET、
                               # ADMIN_PASSWORD、MYSQL_PASSWORD、MYSQL_ROOT_PASSWORD
docker compose up -d --build   # 启动时自动等待 MySQL 就绪并执行数据库迁移
```

访问 `http://<主机地址>:8080`，后台入口 `/console/login`。
端口、数据目录、PUID/PGID 权限、HTTPS 反向代理、可选 MinIO（`--profile minio`）等配置，
以及飞牛 fnOS 的踩坑说明与故障排查表，见 [docs/DOCKER.md](./docs/DOCKER.md)。

## 部署要点

- 生产环境务必配置强随机 `NEXTAUTH_SECRET` 与 `ANONYMOUS_ID_SECRET`，并启用反向代理限流（Upstash Redis 可选，见 `.env.example`）
- 图片桶建议仅对 `uploads/*` 前缀开放匿名读取；CSP 与 `next.config.js` 的 `images.remotePatterns` 需与 `MINIO_PUBLIC_URL` 保持一致
- `nginx/` 目录提供反向代理与 SSL 配置参考；生产构建使用 `npm run build && npm start`

## 文档

- [docs/DOCKER.md](./docs/DOCKER.md)：Docker Compose 部署指南（含飞牛 NAS 注意事项）
- [CLAUDE.md](./CLAUDE.md)：架构约定与数据模型详解
- [PRD_个人博客网站.md](./PRD_个人博客网站.md)：产品需求文档

## License

[MIT](./LICENSE)
