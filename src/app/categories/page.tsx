import Link from 'next/link'
import { asc, sql } from 'drizzle-orm'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { db, schema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '所有分类 - Qzhou Blog',
  description: '浏览博客中所有的分类。',
}

export default async function CategoriesPage() {
  // 表前缀必须写死（drizzle sql 模板渲染裸列名，跨表关联会指错作用域）
  const categories = await db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
      description: schema.categories.description,
      postCount: sql<number>`(
        SELECT count(*) FROM \`posts\`
        WHERE \`posts\`.\`category_id\` = \`categories\`.\`id\`
          AND \`posts\`.\`status\` = 'published'
      )`,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.createdAt))

  const [uncategorized] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(sql`\`posts\`.\`category_id\` IS NULL AND \`posts\`.\`status\` = 'published'`)
  const uncategorizedCount = Number(uncategorized?.count ?? 0)

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <PageTitle
              title="所有分类"
              description="按主题浏览文章。"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={'/categories/' + cat.slug}
                  className="block p-6 rounded-card bg-background-base shadow-card hover:shadow-hover transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-xl font-semibold text-text-primary group-hover:text-brand-orange transition-colors">
                      {cat.name}
                    </h2>
                    <span className="text-xs text-text-muted bg-background-hover px-2 py-0.5 rounded">
                      {Number(cat.postCount ?? 0)} 篇
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{cat.description ?? '暂无描述'}</p>
                </Link>
              ))}
              {uncategorizedCount > 0 && (
                <div className="p-6 rounded-card bg-background-base shadow-card">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-xl font-semibold text-text-primary">未分类</h2>
                    <span className="text-xs text-text-muted bg-background-hover px-2 py-0.5 rounded">
                      {uncategorizedCount} 篇
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">尚未归入任何分类的文章。</p>
                </div>
              )}
            </div>

            {categories.length === 0 && uncategorizedCount === 0 && (
              <div className="p-12 text-center bg-background-base rounded-card shadow-card">
                <p className="text-text-muted mb-4">暂无分类。</p>
                <Link
                  href="/posts"
                  className="px-4 py-2 rounded-button bg-brand-orange text-white text-sm hover:bg-brand-dark transition-colors"
                >
                  浏览所有文章
                </Link>
              </div>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}
