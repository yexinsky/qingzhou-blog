# QzBlog 生产镜像：多阶段构建，最终只保留 Next.js standalone 产物。
#
# 构建期不需要数据库：所有读库页面都按运行时渲染（见各 page.tsx 的 force-dynamic），
# 因此 `docker build` 可以在任何机器上离线完成，不会把数据冻结进镜像。
#
# 依赖 glibc（bookworm）而非 Alpine：附件处理用到的 sharp 只提供 glibc 预编译二进制。
#
# 基础镜像可整体替换（NODE_IMAGE）：国内网络直连 Docker Hub 常失败，飞牛自带的镜像加速
# 也可能不可用（返回 401 且不给 token 端点），此时在 .env 里把它换成可用的加速前缀，例如
#   NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- 依赖安装 ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# 国内网络拉 npm 依赖慢/超时时，把 NPM_REGISTRY 换成镜像源（如 https://registry.npmmirror.com）
ARG NPM_REGISTRY=https://registry.npmjs.org
# 镜像构建需要 devDependencies（typescript / tailwind / eslint），故不加 --omit=dev
RUN npm ci --registry "${NPM_REGISTRY}"

# ---------- 应用构建 ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 仓库里没有 public/ 目录，先建出来，之后用户往仓库加静态资源时会被自动带上
RUN mkdir -p public
# 以下是构建期生效的配置，改完必须重新构建镜像（docker compose up -d --build）：
#   ENFORCE_HTTPS    HTTPS 专属响应头开关，明文 HTTP 部署必须为 false
#   S3_PUBLIC_URL    图片白名单来源（CSP img-src）
#   EXTRA_IMAGE_HOSTS 额外图片白名单，逗号分隔
ARG ENFORCE_HTTPS=false
ARG S3_PUBLIC_URL=""
ARG EXTRA_IMAGE_HOSTS=""
ENV ENFORCE_HTTPS=${ENFORCE_HTTPS} \
    S3_PUBLIC_URL=${S3_PUBLIC_URL} \
    EXTRA_IMAGE_HOSTS=${EXTRA_IMAGE_HOSTS}
RUN npm run build

# ---------- 运行时 ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

# HOSTNAME 必须显式指定：Docker 默认把它设成容器 ID，standalone 的 server.js 会
# 拿它当监听地址，可能出现 EADDRNOTAVAIL 或端口映射失效。
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 产物已包含运行所需的 node_modules（含 sharp 与 @img 平台二进制、
# 供启动迁移使用的 drizzle-orm / mysql2）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 迁移文件与启动脚本：容器启动时先迁移再拉起应用
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --chown=nextjs:nodejs docker/ ./docker/
# 两处兜底：
#   1. 行尾：脚本若被 Windows 编辑器存成 CRLF，/bin/sh 会以 "bad interpreter: /bin/sh^M" 启动失败
#   2. .env*：Next 会把项目里的 .env 一并带进 standalone 产物，构建上下文虽已由
#      .dockerignore 排除，这里再兜一层，确保开发环境密钥不会进镜像
RUN sed -i 's/\r$//' docker/entrypoint.sh \
    && chmod +x docker/entrypoint.sh \
    && mkdir -p uploads backups \
    && chown -R nextjs:nodejs uploads backups \
    && rm -f .env .env.local .env.development .env.production .env.test

# 默认以非 root 运行；compose 会用 PUID/PGID 覆盖成宿主数据目录的属主
USER nextjs

EXPOSE 3000

# /console/login 不需要数据库，适合作为存活性探针
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/console/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "server.js"]
