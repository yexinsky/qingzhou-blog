import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { TagCloud } from '@/components/ui/Tag'
import { db, schema } from '@/lib/db'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '所有标签 - Qzhou Blog',
  description: '浏览博客中所有的标签。',
}

async function getAllTags() {
  const tags = await db.query.tags.findMany({
    with: { posts: { columns: { postId: true } } },
    orderBy: [desc(schema.tags.createdAt)],
  })

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    color: tag.color ?? undefined,
    count: tag.posts?.length ?? 0,
  }))
}

export default async function TagsPage() {
  const tags = await getAllTags()
  const tagCloud = tags.map((t) => ({
    name: t.name,
    count: t.count,
    href: '/tags/' + t.slug,
  }))

  const sortedByCount = [...tags].sort((a, b) => b.count - a.count)

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <PageTitle
              title="所有标签"
              description="按使用频率排序，点击进入查看相关文章。"
            />

            {tags.length === 0 ? (
              <p className="text-center py-12 text-text-muted">还没有任何标签。</p>
            ) : (
              <>
                <div className="bg-background-base rounded-card shadow-card p-6 mb-8">
                  <TagCloud tags={tagCloud} />
                </div>

                <div className="bg-background-base rounded-card shadow-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-muted border-b border-border">
                        <th className="px-6 py-3 font-medium">标签</th>
                        <th className="px-6 py-3 font-medium w-32 text-right">文章数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedByCount.map((tag) => (
                        <tr key={tag.id} className="border-b border-border last:border-0 hover:bg-background-hover transition-colors">
                          <td className="px-6 py-3">
                            <a
                              href={'/tags/' + tag.slug}
                              className="text-text-primary hover:text-brand-orange transition-colors font-medium inline-flex items-center gap-2"
                            >
                              {tag.color && (
                                <span
                                  className="inline-block w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                  aria-hidden
                                />
                              )}
                              {tag.name}
                            </a>
                          </td>
                          <td className="px-6 py-3 text-right text-text-secondary">{tag.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}


