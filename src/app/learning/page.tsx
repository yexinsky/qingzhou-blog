import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { BookOpen, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { db, schema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '学习路线 - Qzhou Blog',
  description: '系统化梳理学习路径与进度。',
}

async function getPaths() {
  const paths = await db.query.learningPaths.findMany({
    orderBy: [desc(schema.learningPaths.createdAt)],
    with: {
      nodes: {
        orderBy: [desc(schema.learningNodes.sortOrder)],
        columns: { id: true, status: true },
      },
    },
  })

  return paths.map((p) => {
    const total = p.nodes?.length ?? 0
    const completed = (p.nodes || []).filter((n) => n.status === 'completed').length
    const learning = (p.nodes || []).filter((n) => n.status === 'learning').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description ?? undefined,
      coverImage: p.coverImage ?? undefined,
      totalNodes: total,
      completedNodes: completed,
      learningNodes: learning,
      progress,
    }
  })
}

export default async function LearningPathsPage() {
  const paths = await getPaths()

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <PageTitle
              title="学习路线"
              description="系统化梳理个人学习方向与掌握进度。"
            />

            {paths.length === 0 ? (
              <div className="bg-background-base rounded-card shadow-card p-12 text-center">
                <p className="text-text-muted">还没有创建任何学习路线。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paths.map((p) => (
                  <Link
                    key={p.id}
                    href={'/learning/' + p.slug}
                    className="group block bg-background-base rounded-card shadow-card overflow-hidden hover:shadow-hover transition-all"
                  >
                    {p.coverImage && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={p.coverImage}
                          alt={p.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-2 text-brand-orange">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-sm font-medium">学习路线</span>
                      </div>
                      <h2 className="text-xl font-semibold text-text-primary group-hover:text-brand-orange transition-colors">
                        {p.title}
                      </h2>
                      {p.description && (
                        <p className="text-sm text-text-secondary line-clamp-3 leading-relaxed">
                          {p.description}
                        </p>
                      )}

                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span>完成进度</span>
                          <span className="font-medium">{p.progress}%</span>
                        </div>
                        <div className="w-full bg-background-hover rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-brand-orange h-full transition-all"
                            style={{ width: p.progress + '%' }}
                          />
                        </div>

                        <div className="flex items-center gap-4 text-xs text-text-muted pt-1">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            {p.completedNodes} 已完成
                          </span>
                          <span className="flex items-center gap-1">
                            <Loader2 className="w-3.5 h-3.5 text-brand-orange" />
                            {p.learningNodes} 学习中
                          </span>
                          <span className="flex items-center gap-1">
                            <Circle className="w-3.5 h-3.5" />
                            {p.totalNodes} 总计
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}


