import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { Github, ExternalLink, Star } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { TagCloud } from '@/components/ui/Tag'
import { db, schema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '项目展示 - Qzhou Blog',
  description: '个人项目、开源作品与实践。',
}

async function getProjects() {
  const projects = await db.query.projects.findMany({
    orderBy: [desc(schema.projects.isFeatured), desc(schema.projects.sortOrder), desc(schema.projects.createdAt)],
  })

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    techStack: Array.isArray(p.techStack) ? (p.techStack as string[]) : [],
    coverImage: p.coverImage ?? undefined,
    githubUrl: p.githubUrl ?? undefined,
    demoUrl: p.demoUrl ?? undefined,
    starCount: p.starCount ?? 0,
    isFeatured: p.isFeatured ?? false,
  }))
}

export default async function ProjectsPage() {
  const projects = await getProjects()
  const featured = projects.filter((p) => p.isFeatured)
  const others = projects.filter((p) => !p.isFeatured)

  const renderCard = (p: (typeof projects)[number]) => (
    <article
      key={p.id}
      className="bg-background-base rounded-card shadow-card overflow-hidden hover:shadow-hover transition-all group"
    >
      {p.coverImage && (
        <Link href={'/projects/' + p.id} className="block aspect-video overflow-hidden">
          <img
            src={p.coverImage}
            alt={p.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      )}
      <div className="p-6 space-y-4">
        <div>
          <Link href={'/projects/' + p.id}>
            <h2 className="text-xl font-semibold text-text-primary group-hover:text-brand-orange transition-colors">
              {p.name}
            </h2>
          </Link>
          {p.description && (
            <p className="text-sm text-text-secondary mt-2 leading-relaxed line-clamp-3">
              {p.description}
            </p>
          )}
        </div>

        {p.techStack.length > 0 && (
          <TagCloud
            tags={p.techStack.map((t) => ({ name: t }))}
            size="sm"
          />
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            {p.githubUrl && (
              <a
                href={p.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand-orange transition-colors"
                aria-label="GitHub 仓库"
              >
                <Github className="w-4 h-4" />
              </a>
            )}
            {p.demoUrl && (
              <a
                href={p.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand-orange transition-colors"
                aria-label="在线演示"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          {p.starCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Star className="w-3.5 h-3.5" />
              {p.starCount}
            </span>
          )}
        </div>
      </div>
    </article>
  )

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <PageTitle
              title="项目展示"
              description="个人项目与开源作品。"
            />

            {projects.length === 0 ? (
              <div className="bg-background-base rounded-card shadow-card p-12 text-center">
                <p className="text-text-muted">还没有任何项目。</p>
              </div>
            ) : (
              <>
                {featured.length > 0 && (
                  <section className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-6">精选项目</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{featured.map(renderCard)}</div>
                  </section>
                )}

                {others.length > 0 && (
                  <section>
                    {featured.length > 0 && (
                      <h2 className="text-2xl font-bold text-text-primary mb-6">更多项目</h2>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{others.map(renderCard)}</div>
                  </section>
                )}
              </>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}


