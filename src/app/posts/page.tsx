import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { RecentPostsSection } from '@/components/layout/Sidebar'
import { ArticleList } from '@/components/article/ArticleList'
import { TagCloud } from '@/components/ui/Tag'
import { db, schema } from '@/lib/db'
import { desc, eq, sql } from 'drizzle-orm'

export const metadata = {
  title: '所有文章 - Qzhou Blog',
  description: '浏览 Qzhou Blog 发布的全部技术文章。',
}

interface PageProps {
  searchParams?: Promise<{ page?: string }>
}

const PAGE_SIZE = 10

async function getPostsPage(page: number) {
  const offset = (page - 1) * PAGE_SIZE
  const posts = await db.query.posts.findMany({
    where: eq(schema.posts.status, 'published'),
    with: {
      author: { columns: { id: true, username: true, avatarUrl: true } },
      tags: { with: { tag: true } },
    },
    orderBy: [desc(schema.posts.isPinned), desc(schema.posts.publishedAt)],
    limit: PAGE_SIZE,
    offset,
  })

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(eq(schema.posts.status, 'published'))
  const total = Number(totalRow[0]?.count ?? 0)

  return {
    posts: posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.summary ?? undefined,
      coverImage: post.coverImage ?? undefined,
      publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
      readingTime: Math.max(1, Math.ceil((post.wordCount || 0) / 300)),
      views: post.viewCount ?? 0,
      tags: (post.tags || []).map((pt) => pt.tag).map((t) => ({ name: t.name, slug: t.slug })),
      author: post.author
        ? { name: post.author.username, avatar: post.author.avatarUrl ?? undefined }
        : undefined,
    })),
    total,
  }
}

async function getSidebarTags() {
  const tags = await db.query.tags.findMany({
    with: { posts: { columns: { postId: true } } },
    orderBy: [desc(schema.tags.createdAt)],
    limit: 20,
  })
  return tags.map((tag) => ({
    name: tag.name,
    href: '/tags/' + tag.slug,
    count: tag.posts?.length ?? 0,
  }))
}

async function getRecentPosts() {
  const posts = await db.query.posts.findMany({
    where: eq(schema.posts.status, 'published'),
    columns: { title: true, slug: true, publishedAt: true, createdAt: true },
    orderBy: [desc(schema.posts.publishedAt)],
    limit: 5,
  })
  return posts.map((post) => ({
    title: post.title,
    slug: post.slug,
    date: (post.publishedAt ?? post.createdAt).toISOString().slice(0, 10),
  }))
}

export default async function PostsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const page = Math.max(1, parseInt(resolvedSearchParams?.page ?? '1', 10) || 1)
  const [{ posts, total }, tags, recentPosts] = await Promise.all([
    getPostsPage(page),
    getSidebarTags(),
    getRecentPosts(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <PageTitle
              title="所有文章"
              description="这里是博客上已发布的全部文章。"
            />

            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 min-w-0 space-y-8">
                <ArticleList
                  articles={posts}
                  variant="list"
                  emptyMessage="还没有发布的文章。"
                />

                {totalPages > 1 && (
                  <nav className="flex items-center justify-center gap-2 pt-4">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1
                      const active = p === page
                      const href = p === 1 ? '/posts' : '/posts?page=' + p
                      const cls = 'w-10 h-10 rounded-button text-sm font-medium transition-colors flex items-center justify-center ' + (active
                        ? 'bg-brand-orange text-white'
                        : 'bg-background-base border border-border hover:bg-background-hover')
                      return (
                        <Link key={p} href={href} className={cls}>
                          {p}
                        </Link>
                      )
                    })}
                  </nav>
                )}
              </div>

              <aside className="w-full lg:w-80 lg:sticky lg:top-24 lg:h-fit space-y-6">
                {tags.length > 0 && (
                  <div className="bg-background-base rounded-card shadow-card p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">标签</h3>
                    <TagCloud tags={tags} />
                  </div>
                )}
                {recentPosts.length > 0 && <RecentPostsSection title="最近文章" posts={recentPosts} />}
              </aside>
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}



