import type { MetadataRoute } from 'next'
import { getSiteSettings } from '@/lib/settings'
import { resolveSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await resolveSiteUrl()

  // v1.1（PRD 11.10）：屏蔽搜索引擎开关 —— 开启后全站 Disallow（开发/临时闭站场景）
  const settings = await getSiteSettings()
  if (settings.blockSearchEngine) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/console', '/api', '/console/login'],
      },
    ],
    sitemap: baseUrl + '/sitemap.xml',
    host: baseUrl,
  }
}
