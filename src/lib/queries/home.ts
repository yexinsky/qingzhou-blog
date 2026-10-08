import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

/**
 * Article payload shaped to match the ArticleCard/ArticleList contract.
 * Dates are returned as ISO strings; nullables are normalized to undefined.
 */
export interface HomeArticle {
  slug: string
  title: string
  excerpt?: string
  coverImage?: string
  publishedAt: string
  readingTime: number
  views: number
  tags: Array<{ name: string; slug: string }>
  author?: { name: string; avatar?: string }
}

export interface HomeTag {
  name: string
  href: string
  count: number
}

export interface HomeRecentPost {
  title: string
  slug: string
  date: string
}

export interface HomeProfile {
  name?: string
  bio?: string
  avatar?: string
  tags: Array<{ name: string; count?: number; href?: string }>
}

export interface HomePageData {
  articles: HomeArticle[]
  tags: HomeTag[]
  recentPosts: HomeRecentPost[]
  profile: HomeProfile
  totalPosts: number
}

/**
 * Compute reading time from a stored wordCount. Falls back to 1 minute when the
 * value is zero so the UI never renders a "0 分钟" label for a real post.
 */
function readingTimeFromWordCount(wordCount: number | null | undefined): number {
  const words = Math.max(0, Number(wordCount ?? 0))
  if (words === 0) return 1
  return Math.max(1, Math.ceil(words / 300))
}

/**
 * Aggregate all queries needed by the home page in a single round trip.
 * - articles: latest published posts with author + tags joined, pinned first.
 * - tags: every tag with its post count for the sidebar cloud.
 * - recentPosts: 5 most recent published posts (slug + date only).
 * - profile: the first admin user + their top tags as profile chips.
 *
 * All queries are read-only and tolerate an empty database gracefully so the
 * page can render a beautiful empty state instead of throwing.
 */
export async function getHomePageData(articleLimit = 6, tagLimit = 20): Promise<HomePageData> {
  const [latestPosts, allTags, recentPosts, profileUser] = await Promise.all([
    db.query.posts.findMany({
      where: eq(schema.posts.status, 'published'),
      with: {
        author: { columns: { id: true, username: true, avatarUrl: true, bio: true } },
        tags: { with: { tag: true } },
      },
      orderBy: [desc(schema.posts.isPinned), desc(schema.posts.publishedAt)],
      limit: articleLimit,
    }),
    db.query.tags.findMany({
      with: { posts: { columns: { postId: true } } },
      orderBy: [desc(schema.tags.createdAt)],
      limit: tagLimit,
    }),
    db.query.posts.findMany({
      where: eq(schema.posts.status, 'published'),
      columns: { title: true, slug: true, publishedAt: true, createdAt: true },
      orderBy: [desc(schema.posts.publishedAt)],
      limit: 5,
    }),
    db.query.users.findFirst({
      orderBy: [desc(schema.users.createdAt)],
      columns: { id: true, username: true, avatarUrl: true, bio: true },
    }),
  ])

  const articles: HomeArticle[] = latestPosts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.summary ?? undefined,
    coverImage: post.coverImage ?? undefined,
    publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
    readingTime: readingTimeFromWordCount(post.wordCount),
    views: post.viewCount ?? 0,
    tags: (post.tags ?? [])
      .map((pt) => pt.tag)
      .filter((t): t is { id: string; name: string; slug: string; color: string | null; createdAt: Date } => Boolean(t))
      .map((t) => ({ name: t.name, slug: t.slug })),
    author: post.author
      ? { name: post.author.username, avatar: post.author.avatarUrl ?? undefined }
      : undefined,
  }))

  const tags: HomeTag[] = allTags.map((tag) => ({
    name: tag.name,
    href: '/tags/' + tag.slug,
    count: tag.posts?.length ?? 0,
  }))

  const recent: HomeRecentPost[] = recentPosts.map((post) => ({
    title: post.title,
    slug: post.slug,
    date: (post.publishedAt ?? post.createdAt).toISOString().slice(0, 10),
  }))

  // Profile chips reuse the most common tags from the sidebar so the sidebar
  // never falls back to hardcoded labels. The chips carry a count so users can
  // see which topics actually have content.
  const topTags = [...tags]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((t) => ({ name: t.name, count: t.count, href: t.href }))

  // 不做人设兜底：博主没填昵称/简介时留空，由 ProfileCard 跳过对应行，
  // 而不是在线上站点凭空渲染一个捏造的名字与自我介绍。
  const profile: HomeProfile = {
    name: profileUser?.username,
    bio: profileUser?.bio ?? undefined,
    avatar: profileUser?.avatarUrl ?? undefined,
    tags: topTags,
  }

  return {
    articles,
    tags,
    recentPosts: recent,
    profile,
    totalPosts: articles.length,
  }
}