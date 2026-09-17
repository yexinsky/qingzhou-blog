# QzBlog 项目文档

## 1. 技术架构概述

QzBlog 是一个面向软件开发者的个人品牌站点，采用以下技术栈：

| 类别 | 技术方案 |
|------|---------|
| 框架 | Next.js App Router (SSR + ISR, 全栈 TypeScript) |
| 后端 | Next.js API Routes (BFF 层直连数据库) |
| 样式 | Tailwind CSS |
| 数据库 | MySQL 8.0 + Drizzle ORM |
| 认证 | NextAuth.js + GitHub OAuth |
| 图片存储 | MinIO (S3 兼容对象存储) |
| 语法高亮 | Shiki (SSR 友好) |
| Markdown 渲染 | remark + rehype 生态 |
| 部署 | Docker Compose (自有服务器) |

### MySQL 约定

- 目标版本为 MySQL 8.0，存储引擎使用 InnoDB，字符集使用 `utf8mb4`
- 业务主键使用 `varchar(36)`，由 Node.js `crypto.randomUUID()` 生成
- 时间字段使用 `datetime(3)`，应用连接统一按 UTC 读写
- Drizzle 使用 `mysql-core`、`mysql2` 驱动；MySQL 不支持通用 `RETURNING`，写入后按主键或唯一键重新查询
- 当前文章搜索使用 `LIKE`；启用 `FULLTEXT` 前必须验证 `ngram parser` 的中文检索效果

## 2. 目录结构

```
QzhouBlog/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API 路由
│   │   │   ├── posts/           # 文章 API
│   │   │   ├── moments/         # 动态 API
│   │   │   ├── comments/        # 评论 API
│   │   │   ├── likes/           # 点赞 API
│   │   │   ├── auth/            # 认证 API
│   │   │   ├── tags/            # 标签 API
│   │   │   ├── series/          # 系列 API
│   │   │   ├── projects/        # 项目 API
│   │   │   ├── milestones/      # 时间线 API
│   │   │   ├── learning/        # 学习路线 API
│   │   │   └── upload/          # 文件上传 API（多文件，写入附件库）
│   │   ├── admin/               # 管理 API（/api/admin/*，页面路由已迁移至 /console）
│   │   ├── files/               # 本地磁盘附件读取出口（storage=local 时）
│   │   ├── console/             # 管理后台页面（v1.1 由 /admin 迁移，旧地址 301）
│   │   ├── posts/               # 文章详情页
│   │   ├── moments/             # 动态页
│   │   ├── about/               # 关于页（绑定 single_pages slug='about'）
│   │   ├── projects/            # 项目页
│   │   ├── timeline/            # 时间线页
│   │   ├── learning/            # 学习路线页
│   │   ├── search/              # 搜索页
│   │   ├── tags/                # 标签页
│   │   └── series/              # 系列页
│   ├── components/
│   │   ├── ui/                  # 基础 UI 组件
│   │   ├── layout/              # 布局组件
│   │   ├── article/             # 文章相关组件
│   │   ├── comments/            # 评论组件
│   │   ├── moments/             # 动态卡片组件
│   │   └── console/             # 管理后台组件（/console）
│   ├── hooks/                   # React Hooks
│   ├── lib/                     # 工具函数
│   │   ├── db.ts               # 数据库连接
│   │   ├── auth.ts              # NextAuth 配置
│   │   ├── admin-auth.ts        # /api/admin/* 公共鉴权守卫
│   │   ├── settings.ts          # 站点设置（单行自动种子）
│   │   ├── crypto.ts            # 敏感字段 AES-256-GCM 加密
│   │   ├── notify/              # SMTP 邮件 + 飞书 Webhook 双通道通知
│   │   ├── backup.ts            # 整站备份/恢复（dump + tar.gz）
│   │   ├── revisions.ts         # 文章版本快照（≤20 条滚动淘汰）
│   │   ├── markdown.ts          # Markdown 渲染管线
│   │   ├── rate-limit.ts        # 频率限制
│   │   └── storage.ts           # 附件存储双策略（本地磁盘 / S3+MinIO）
│   └── db/
│       └── schema.ts            # 数据库 Schema
├── drizzle/                     # Drizzle 迁移文件
├── docker/                      # 容器启动脚本（entrypoint.sh + bootstrap.mjs）
├── tests/                       # 测试文件
│   ├── unit/                    # 单元测试
│   ├── integration/             # 集成测试
│   └── lib/                    # 测试工具
├── public/                     # 静态资源
└── docs/                       # 项目文档
```

## 3. 数据库模型

核心数据表（详见 PRD 第 9 章）：

- **users** - 博主用户表
- **posts** - 文章表（含 content_md/content_html 双字段；v1.1 增 category_id、visibility、allow_comment，status 含 recycled 回收站）
- **categories** - 分类表（v1.1，文章单分类归属）
- **attachments / attachment_groups** - 附件库与分组表（v1.1）
- **tags** - 标签表
- **post_tags** - 文章标签关联表
- **series** - 系列表
- **series_posts** - 系列文章关联表
- **comments** - 评论表（支持 2 层嵌套；v1.1 泛化 target_type/target_id 支持文章与动态）
- **moments** - 动态表（v1.1 增 content_md、images 多图）
- **post_likes** - 文章点赞表
- **moment_likes** - 动态点赞表
- **projects** - 项目展示表
- **milestones** - 里程碑时间线表
- **page_views** - 访问统计表
- **learning_routes** - 学习路线表
- **learning_nodes** - 学习路线节点表（支持多级结构）
- **skills** - 技能栈表（含分类、熟练度）
- **social_links** - 社交链接表
- **work_experience** - 工作经历表
- **site_settings** - 站点设置表（单行设计，含评论策略/SEO/SMTP/飞书/备份保留数）
- **post_revisions** - 文章版本快照表（v1.1，每篇 ≤20 条）
- **single_pages** - 自定义页面表（v1.1，about 等单页）
- **backups** - 备份记录表（v1.1）

## 4. API 路由设计

### 公开 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/posts | 获取文章列表 |
| GET | /api/posts/[slug] | 获取单篇文章 |
| GET | /api/moments | 获取动态列表 |
| GET | /api/comments?postId= | 获取评论列表 |
| POST | /api/likes | 点赞/取消点赞 |
| GET | /api/tags | 获取标签列表 |
| GET | /api/series | 获取系列列表 |
| GET | /api/projects | 获取项目列表 |
| GET | /api/milestones | 获取时间线 |
| GET | /api/learning | 获取学习路线列表 |
| GET | /api/learning/[slug] | 获取学习路线详情 |
| GET | /api/skills | 获取技能栈列表 |
| GET | /api/social-links | 获取社交链接列表 |

### 管理 API (需认证)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/posts | 创建文章 |
| PUT | /api/posts/[slug] | 更新文章 |
| DELETE | /api/posts/[slug] | 删除文章 |
| POST | /api/posts/[id]/draft | 保存草稿 |
| POST | /api/moments | 发布动态 |
| PUT | /api/moments/[id] | 更新动态 |
| DELETE | /api/moments/[id] | 删除动态 |
| PUT | /api/comments/[id] | 审核评论 |
| POST | /api/upload | 上传图片 |
| POST | /api/learning | 创建学习路线 |
| PUT | /api/learning/[id] | 更新学习路线 |
| DELETE | /api/learning/[id] | 删除学习路线 |
| POST | /api/learning/[id]/nodes | 添加学习节点 |
| PUT | /api/learning/nodes/[id] | 更新学习节点 |
| DELETE | /api/learning/nodes/[id] | 删除学习节点 |
| POST | /api/skills | 添加技能 |
| PUT | /api/skills/[id] | 更新技能 |
| DELETE | /api/skills/[id] | 删除技能 |
| POST | /api/social-links | 添加社交链接 |
| PUT | /api/social-links/[id] | 更新社交链接 |
| DELETE | /api/social-links/[id] | 删除社交链接 |
| POST | /api/work-experience | 添加工作经历 |
| PUT | /api/work-experience/[id] | 更新工作经历 |
| DELETE | /api/work-experience/[id] | 删除工作经历 |
| PUT | /api/settings | 更新站点设置 |

## 5. 安全策略

1. **认证**: NextAuth.js + GitHub OAuth，JWT 双 Token 机制
2. **授权**: Middleware 拦截 /console/* 页面路由（v1.1 由 /admin 迁移）；API 路由在各自 handler 内校验（公共守卫 lib/admin-auth.ts）
3. **XSS 防护**: rehype-sanitize 过滤，白名单语法
4. **SQL 注入**: Drizzle ORM 参数化查询
5. **频率限制**: 评论/点赞 10次/min，登录 5次/min
6. **文件上传**: 白名单校验 + magic number + 5MB 限制 + UUID 重命名
7. **安全响应头**: CSP、X-Frame-Options、X-Content-Type-Options

## 6. 性能优化

- Next.js SSR + ISR 混合策略
- 图片懒加载
- 代码块按需语法高亮
- 全站搜索 MySQL LIKE / FULLTEXT（≤500ms）
- 首页 FCP ≤ 1.5s，文章页加载 ≤ 2s

## 7. 代码规范

### TypeScript
- 使用严格模式
- 组件使用 Function Component + Hooks
- 类型定义优先于 any

### 样式
- Tailwind CSS 工具类
- 遵循 PRD 设计规范（颜色、间距、圆角）
- 支持暗色模式

### API
- Zod 输入验证
- 统一错误响应格式
- 分页支持

## 8. 快捷键体系

| 快捷键 | 作用域 | 功能 |
|--------|--------|------|
| / | 全站 | 聚焦搜索框 |
| ? | 全站 | 显示快捷键帮助 |
| t | 全站 | 切换主题 |
| Ctrl+S | 编辑器 | 保存草稿 |
| Ctrl+Shift+P | 编辑器 | 发布文章 |
| Ctrl+B/I/K | 编辑器 | 加粗/斜体/链接 |

## 9. 环境变量

参考 .env.example:
- DATABASE_URL - MySQL 连接串；也可改用 MYSQL_HOST/MYSQL_PORT/MYSQL_DATABASE/MYSQL_USER/
  MYSQL_PASSWORD 分项配置（Docker Compose 走这套，见 src/lib/database-url.ts，
  docker/bootstrap.mjs 内有同步的解析逻辑）
- NEXTAUTH_URL - 认证回调地址
- GITHUB_ID / GITHUB_SECRET - GitHub OAuth
- MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY - 对象存储
- RATE_LIMIT_BACKEND - 设为 `memory` 时允许生产环境使用进程内限流（单实例自托管）；
  未设置且没有 Upstash 配置时，所有被限流的接口（含登录）会返回 503
- ENFORCE_HTTPS - 构建期开关，控制 HSTS 与 `upgrade-insecure-requests` 响应头；
  明文 HTTP 部署必须为 false，改动后需重新构建镜像

## 10. 容器化与部署（Docker Compose）

镜像与编排文件：`Dockerfile`（多阶段构建，产出 Next.js standalone）、`docker-compose.yml`
（app + MySQL，MinIO 为可选 profile）、`.env.docker.example`、`docs/DOCKER.md`（含飞牛 NAS 说明）。

改代码时必须遵守的约束：

1. **任何读取数据库的页面/布局都要声明 `export const dynamic = 'force-dynamic'`**（或使用
   `searchParams`/`cookies()` 等动态 API）。否则 `next build` 会在构建期连库预渲染，
   导致镜像构建必须挂数据库，且内容被冻结进镜像。
2. `next.config.js` 的 `outputFileTracingIncludes` 需要保留 `drizzle-orm`、`mysql2`、`@img`：
   前两者被 Next 打散进服务端 chunk，standalone 的 node_modules 不含它们，而容器启动时的
   引导脚本（`docker/bootstrap.mjs`）要以普通模块方式导入；`@img` 是 sharp 的平台二进制。
3. 容器内迁移与 `npm run db:migrate` 使用同一个 drizzle-orm 迁移器、同一张
   `__drizzle_migrations` 表，幂等且不重复执行。
4. 登录只校验不建号（`src/lib/auth.ts`），迁移文件不含种子数据，因此引导脚本在 users 表
   为空时按 `ADMIN_USERNAME`（小写）建一条 admin 记录；表非空时不做任何改动。
5. 数据库连接支持 `DATABASE_URL` 与 `MYSQL_*` 两种写法（`src/lib/database-url.ts`，前者优先）。
   容器走 `MYSQL_*`，因此该文件与 `docker/bootstrap.mjs` 里的同名解析逻辑必须同步修改。
6. 应用与数据库的页面/布局在无数据库配置时也要能构建：`src/lib/db.ts` 在
   `NEXT_PHASE=phase-production-build` 与测试环境下容忍缺配置，运行期缺配置则直接抛错。
7. 附件与备份使用命名卷（`qzblog_uploads` / `qzblog_backups`），属主由 Docker 从镜像继承，
   无需人工 chown；改用绑定挂载（compose 注释里有写法）时才需要 `PUID:PGID` 与目录属主一致。
8. 基础镜像、数据库镜像与 npm 源可用 `NODE_IMAGE` / `MYSQL_IMAGE` / `MINIO_IMAGE` / `NPM_REGISTRY`
   覆盖（国内镜像加速场景），默认值保持官方源，不要写死成加速地址。
9. `ENFORCE_HTTPS`、`S3_PUBLIC_URL`、`EXTRA_IMAGE_HOSTS` 是**构建期**变量，改动后必须重建镜像。
10. 仓库内 `.sh` / `Dockerfile` / `docker-compose.yml` 必须保持 LF（见 `.gitattributes`），
   带 CRLF 的 shell 脚本会让容器以 `/bin/sh^M: bad interpreter` 启动失败。



