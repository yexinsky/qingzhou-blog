/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

// 图片白名单来源 = MinIO 的内网/回环地址 + 当前部署实际使用的公开地址。
// 部署地址要么写在 S3_PUBLIC_URL / MINIO_PUBLIC_URL 里，要么用 EXTRA_IMAGE_HOSTS
// 追加（逗号分隔）。CSP 的 img-src 与 images.remotePatterns 共用这份列表，
// 换部署地址时两者不会失配。
function storageImageOrigins() {
  const origins = new Set(['http://192.168.1.100:9000', 'http://localhost:9000']);
  const candidates = [
    process.env.S3_PUBLIC_URL,
    process.env.MINIO_PUBLIC_URL,
    ...(process.env.EXTRA_IMAGE_HOSTS || '').split(','),
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // 非 URL 的字面值（例如 "cdn.example.com"）直接按 origin 无法解析，跳过
    }
  }
  return [...origins];
}

const imageOrigins = storageImageOrigins();

// HTTPS 专属响应头（HSTS + upgrade-insecure-requests）默认跟随生产环境开关。
// 以明文 HTTP 部署在内网 IP 上时必须关闭：upgrade-insecure-requests 会把同源静态
// 资源也改写成 https://，而该地址并没有 HTTPS 监听，页面会直接丢样式与脚本。
// 由 Docker 构建参数 ENFORCE_HTTPS 控制（见 docker-compose.yml）。
const enforceHttps = process.env.ENFORCE_HTTPS
  ? process.env.ENFORCE_HTTPS.trim().toLowerCase() !== 'false'
  : isProduction;

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js currently requires inline styles; unsafe-eval is development-only for source maps/HMR.
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://avatars.githubusercontent.com ${imageOrigins.join(' ')}`,
  "font-src 'self' data:",
  "connect-src 'self'" + (isProduction ? '' : ' ws: wss:'),
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(enforceHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(enforceHttps
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig = {
  // 容器镜像使用 standalone 产物：只携带运行时真正用到的依赖，镜像体积与启动开销都更小。
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      ...imageOrigins.map((origin) => {
        const url = new URL(origin);
        return {
          protocol: url.protocol.replace(':', ''),
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
        };
      }),
    ],
    unoptimized: true,
  },
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  // sharp 通过动态 require 加载平台二进制（@img/*），文件追踪器可能漏掉，显式带上，
  // 否则上传接口会在运行时崩。
  // 注意不要在里补 mysql2 / drizzle-orm：Next 已把它们打进服务端 chunk，强行复制包目录
  // 只会得到"包在但传递依赖缺失"的假象（曾因缺 sql-escaper 导致容器启动失败）；
  // 容器内引导脚本需要的依赖树由 Dockerfile 用 npm 单独装到 /app/tools。
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@img/**/*'],
  },
  async redirects() {
    return [
      // v1.1 后台路由迁移（PRD 11.1）：旧 /admin/** 地址 301 永久重定向至 /console/**
      // 注意：permanent: true 返回 308，PRD 明确要求 301，故用 statusCode
      { source: '/admin', destination: '/console', statusCode: 301 },
      { source: '/admin/:path*', destination: '/console/:path*', statusCode: 301 },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
