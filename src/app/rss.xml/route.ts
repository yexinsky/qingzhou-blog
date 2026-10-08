import { eq, desc } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { resolveSiteUrl } from '@/lib/site-url'

const SITE_TITLE = 'Qzhou Blog'
const SITE_DESCRIPTION = '分享技术心得，记录成长历程。'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const dynamic = 'force-dynamic'

type RssPost = {
  slug: string
  title: string
  summary: string | null
  contentMd: string
  publishedAt: Date | null
  createdAt: Date
}

async function safeFindPublishedPosts(): Promise<RssPost[]> {
  try {
    return await db.query.posts.findMany({
      where: eq(schema.posts.status, 'published'),
      orderBy: [desc(schema.posts.publishedAt)],
      limit: 20,
    })
  } catch (error) {
    console.warn(
      '[rss] failed to load posts, returning empty feed:',
      error instanceof Error ? error.message : error
    )
    return []
  }
}

export async function GET() {
  const baseUrl = await resolveSiteUrl()
  const posts = await safeFindPublishedPosts()

  const items = posts
    .map((post) => {
      const link = baseUrl + '/posts/' + post.slug
      const pub = (post.publishedAt ?? post.createdAt).toUTCString()
      const description = post.summary ?? (post.contentMd ?? '').slice(0, 200)
      return [
        '<item>',
        '<title>' + escapeXml(post.title) + '</title>',
        '<link>' + link + '</link>',
        '<guid isPermaLink="true">' + link + '</guid>',
        '<pubDate>' + pub + '</pubDate>',
        '<description>' + escapeXml(description) + '</description>',
        '</item>',
      ].join('')
    })
    .join('')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>' + escapeXml(SITE_TITLE) + '</title>',
    '<link>' + baseUrl + '</link>',
    '<description>' + escapeXml(SITE_DESCRIPTION) + '</description>',
    '<language>zh-CN</language>',
    items,
    '</channel>',
    '</rss>',
  ].join('')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
