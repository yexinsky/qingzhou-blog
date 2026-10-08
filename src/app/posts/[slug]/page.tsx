import { notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { getServerSession } from 'next-auth'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section } from '@/components/layout/Container'
import { TagCloud } from '@/components/ui/Tag'
import { CommentSection, PostActions } from '@/components/comments/CommentSection'
import { db, schema } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getSiteSettings } from '@/lib/settings'
import { formatDate, decodeParam } from '@/lib/utils'
import { extractToc, flattenToc } from '@/lib/markdown'
import { TableOfContents } from '@/components/article/TableOfContents'

interface PageProps {
  params: { slug: string }
}

async function getPostBySlug(slug: string) {
  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.slug, slug),
    with: {
      author: { columns: { id: true, username: true, avatarUrl: true, bio: true } },
      tags: { with: { tag: true } },
    },
  })

  if (!post) return null
  // v1.1（PRD 11.4）：回收站文章前台不可见；草稿仅博主可见
  const session = await getServerSession(authOptions)
  const canManage = session?.user?.role === 'admin' || session?.user?.id === post.authorId
  if (post.status === 'recycled') return null
  if (post.status === 'draft' && !canManage) return null
  // v1.1（PRD 11.6）：私有文章仅博主登录态可访问，读者访问返回 404
  if (post.visibility === 'private' && !canManage) return null
  return post
}

async function getRelatedPosts(tagIds: string[], currentSlug: string) {
  if (tagIds.length === 0) return []
  const posts = await db.query.posts.findMany({
    where: eq(schema.posts.status, 'published'),
    with: {
      tags: { with: { tag: true } },
    },
    limit: 60,
  })

  const scored = posts
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({
      post: p,
      score: (p.tags || []).filter((pt) => tagIds.includes(pt.tag.id)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  return scored.map(({ post }) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.summary ?? undefined,
    publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
    tags: (post.tags || []).map((pt) => pt.tag).map((t) => ({ name: t.name, slug: t.slug })),
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const post = await getPostBySlug(decodeParam(rawSlug))
  if (!post) {
    return { title: '文章未找到 - Qzhou Blog' }
  }
  return {
    title: post.title + ' - Qzhou Blog',
    description: post.summary ?? undefined,
  }
}

export default async function PostDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const post = await getPostBySlug(decodeParam(rawSlug))
  if (!post) {
    notFound()
  }

  const readingTime = Math.max(1, Math.ceil((post.wordCount || 0) / 300))
  const publishedAtIso = (post.publishedAt ?? post.createdAt).toISOString()
  const tags = (post.tags || []).map((pt) => pt.tag)
  const tagIds = tags.map((t) => t.id)
  const tocItems = post.contentMd ? flattenToc(extractToc(post.contentMd)) : []
  const related = await getRelatedPosts(tagIds, post.slug)

  // v1.1：评论改为按 target 查询；评论区受站点级与文章级开关控制（PRD 11.5）
  const [approvedComments, settings] = await Promise.all([
    db.query.comments.findMany({
      where: and(
        eq(schema.comments.targetType, 'post'),
        eq(schema.comments.targetId, post.id),
        eq(schema.comments.status, 'approved')
      ),
      orderBy: [desc(schema.comments.isPinned), desc(schema.comments.createdAt)],
    }),
    getSiteSettings(),
  ])
  const commentsEnabled = settings.enableComments && post.allowComment

  const comments = approvedComments.map((c) => ({
    id: c.id,
    author: { name: c.authorName },
    content: c.contentHtml,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <Link
              href="/posts"
              className="inline-flex items-center text-sm text-text-secondary hover:text-brand-orange mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              回到文章列表
            </Link>

            <article className="max-w-3xl mx-auto">
              <header className="mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  {post.title}
                </h1>
                {post.summary && (
                  <p className="text-lg text-text-secondary leading-relaxed mb-6">{post.summary}</p>
                )}
                <PostActions
                  likes={post.likeCount ?? 0}
                  views={post.viewCount ?? 0}
                  postId={post.id}
                  title={post.title}
                />
                {post.coverImage && (
                  <div className="aspect-video overflow-hidden rounded-card mt-6">
                    <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted mt-6">
                  {post.author && (
                    <span className="flex items-center gap-1">
                      <span>作者</span>
                      <span className="text-text-secondary">{post.author.username}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <time dateTime={publishedAtIso}>{formatDate(publishedAtIso)}</time>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{readingTime} 分钟</span>
                  </span>
                </div>
              </header>

              {tags.length > 0 && (
                <div className="mb-6">
                  <TagCloud
                    tags={tags.map((t) => ({ name: t.name, href: '/tags/' + t.slug }))}
                    size="sm"
                  />
                </div>
              )}

              <div
                className="prose prose-lg max-w-none text-text-secondary leading-relaxed [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-text-primary [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-text-primary [&_p]:mb-4 [&_a]:text-brand-orange [&_code]:bg-background-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-background-hover [&_pre]:p-4 [&_pre]:rounded-card [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-brand-orange [&_blockquote]:pl-4 [&_blockquote]:italic"
                dangerouslySetInnerHTML={{ __html: post.contentHtml }}
              />

              {tocItems.length > 0 && (
                <aside className="mt-12">
                  <TableOfContents
                    items={tocItems.map((t) => ({ id: t.id, text: t.text, level: t.level }))}
                  />
                </aside>
              )}

              <div className="mt-12 pt-8 border-t border-border">
                {commentsEnabled ? (
                  <CommentSection comments={comments} targetId={post.id} targetType="post" />
                ) : (
                  <p className="text-sm text-text-muted">评论功能已关闭。</p>
                )}
              </div>
            </article>

            {related.length > 0 && (
              <section className="mt-16">
                <h2 className="text-2xl font-bold text-text-primary mb-6">相关文章</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {related.map((p) => (
                    <Link
                      key={p.slug}
                      href={'/posts/' + p.slug}
                      className="block p-4 rounded-card bg-background-base shadow-card hover:shadow-hover transition-all"
                    >
                      <h3 className="font-semibold text-text-primary mb-2 line-clamp-2 group-hover:text-brand-orange">
                        {p.title}
                      </h3>
                      {p.excerpt && (
                        <p className="text-sm text-text-secondary line-clamp-2">{p.excerpt}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}




