import type { MetadataRoute } from 'next'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getSiteSettings } from '@/lib/settings'
import { resolveSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

type SitemapEntry = MetadataRoute.Sitemap[number]

function safeDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d
}

// 工具：把异步查询包成「失败则降级为空」的形态，避免单条查询错误拖垮整个 sitemap。
async function safeFindMany<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.warn(
      '[sitemap] dynamic segment query failed, falling back to static only:',
      error instanceof Error ? error.message : error
    )
    return fallback
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await resolveSiteUrl()
  const now = new Date()

  // v1.1（PRD 11.10）：屏蔽搜索引擎时 sitemap 返回空
  const settings = await getSiteSettings().catch(() => null)
  if (settings?.blockSearchEngine) {
    return []
  }

  const staticRoutes: SitemapEntry[] = [
    '',
    '/posts',
    '/tags',
    '/categories',
    '/moments',
    '/learning',
    '/projects',
    '/timeline',
    '/about',
  ].map((path) => ({
    url: baseUrl + path,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }))

  // ---- 动态段：每条单独 try/catch，单条失败不影响其他条目，也不影响静态条目 ----
  const posts = await safeFindMany(
    () =>
      db.query.posts.findMany({
        where: eq(schema.posts.status, 'published'),
        columns: { slug: true, updatedAt: true, publishedAt: true, createdAt: true },
        orderBy: [desc(schema.posts.publishedAt)],
      }),
    [] as { slug: string; updatedAt: Date | null; publishedAt: Date | null; createdAt: Date }[]
  )

  const postRoutes: SitemapEntry[] = posts.map((p) => ({
    url: baseUrl + '/posts/' + p.slug,
    lastModified: safeDate(p.updatedAt, safeDate(p.publishedAt, p.createdAt ?? now)),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const tags = await safeFindMany(
    () =>
      db.query.tags.findMany({
        columns: { slug: true, createdAt: true },
      }),
    [] as { slug: string; createdAt: Date }[]
  )
  const tagRoutes: SitemapEntry[] = tags.map((t) => ({
    url: baseUrl + '/tags/' + t.slug,
    lastModified: safeDate(t.createdAt, now),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }))

  const paths = await safeFindMany(
    () =>
      db.query.learningPaths.findMany({
        columns: { slug: true, updatedAt: true, createdAt: true },
      }),
    [] as { slug: string; updatedAt: Date | null; createdAt: Date }[]
  )
  const learningRoutes: SitemapEntry[] = paths.map((lp) => ({
    url: baseUrl + '/learning/' + lp.slug,
    lastModified: safeDate(lp.updatedAt, lp.createdAt ?? now),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }))

  // 时间线无单独详情页，跳过。

  return [...staticRoutes, ...postRoutes, ...tagRoutes, ...learningRoutes]
}
