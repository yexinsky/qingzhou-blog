import { headers } from 'next/headers'

/**
 * 站点对外的绝对地址，供 sitemap / robots / RSS 这类公开产物使用。
 *
 * 优先级：SITE_URL > NEXTAUTH_URL > 当前请求的 Host。
 *
 * 最后一档刻意用请求 Host 而不是硬编码 localhost：这三个产物会被爬虫与
 * RSS 订阅者长期记住，线上漏配 SITE_URL 时若写出去 localhost，收录结果就
 * 全错了。用访客实际访问的 Host 至少是可达的地址，同时服务端日志里会留下
 * 缺配置的迹象（地址与该域名不一致）。
 */
export async function resolveSiteUrl(): Promise<string> {
  // 纯空白（例如 .env 里写成 `SITE_URL=` 或一串空格）按未配置处理，继续往下一档找 ——
  // 与 public-links.ts 对空白值的判定保持一致，否则空白 SITE_URL 会越过
  // NEXTAUTH_URL 直接落到请求 Host。
  const configured = firstNonBlank(process.env.SITE_URL, process.env.NEXTAUTH_URL)
  if (configured) return stripTrailingSlash(configured)

  const origin = await requestOrigin()
  return origin ?? 'http://localhost:3000'
}

function firstNonBlank(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

async function requestOrigin(): Promise<string | null> {
  try {
    const store = await headers()
    // 反向代理后面 Host 常被改写成容器地址，优先取代理透传的原始值。
    const host = firstValue(store.get('x-forwarded-host')) ?? firstValue(store.get('host'))
    if (!host) return null
    const proto = firstValue(store.get('x-forwarded-proto')) ?? 'http'
    return `${proto}://${host}`
  } catch {
    // 不在请求上下文中求值（例如构建期预渲染）——交由调用方的默认值兜底。
    return null
  }
}

function firstValue(raw: string | null): string | null {
  const value = raw?.split(',')[0]?.trim()
  return value ? value : null
}
