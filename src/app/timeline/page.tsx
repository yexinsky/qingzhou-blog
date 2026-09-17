import { desc } from 'drizzle-orm'
import { Briefcase, GraduationCap, Github, Mic, Calendar as CalendarIcon } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { db, schema } from '@/lib/db'
import type { LucideIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '时间线 - Qzhou Blog',
  description: '工作、学习、开源与生活的重要时刻。',
}

type EventType = 'work' | 'study' | 'open_source' | 'speech' | 'other'

const TYPE_META: Record<EventType, { label: string; icon: LucideIcon; className: string }> = {
  work: { label: '工作', icon: Briefcase, className: 'text-blue-600 bg-blue-50' },
  study: { label: '学习', icon: GraduationCap, className: 'text-green-600 bg-green-50' },
  open_source: { label: '开源', icon: Github, className: 'text-purple-600 bg-purple-50' },
  speech: { label: '演讲', icon: Mic, className: 'text-yellow-600 bg-yellow-50' },
  other: { label: '其它', icon: CalendarIcon, className: 'text-text-secondary bg-background-hover' },
}

async function getMilestones() {
  const list = await db.query.milestones.findMany({
    orderBy: [desc(schema.milestones.eventDate), desc(schema.milestones.sortOrder)],
  })
  return list
    .filter((m) => m.isPublic !== false)
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? undefined,
      eventDate: m.eventDate.toString(),
      eventType: m.eventType,
    }))
}

export default async function TimelinePage() {
  const milestones = await getMilestones()

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container maxWidth="md">
            <PageTitle
              title="时间线"
              description="记录重要的时刻。"
            />

            {milestones.length === 0 ? (
              <div className="bg-background-base rounded-card shadow-card p-12 text-center">
                <p className="text-text-muted">时间线还没有内容。</p>
              </div>
            ) : (
              <ol className="relative border-l-2 border-border ml-3 space-y-8">
                {milestones.map((m) => {
                  const meta = TYPE_META[m.eventType] ?? TYPE_META.other
                  const Icon = meta.icon
                  return (
                    <li key={m.id} className="pl-6 relative">
                      <span
                        className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-background-cream ${meta.className}`}
                      >
                        <Icon className="w-3 h-3" />
                      </span>
                      <article className="bg-background-base rounded-card shadow-card p-4">
                        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
                          <time dateTime={m.eventDate}>{m.eventDate}</time>
                          <span>·</span>
                          <span>{meta.label}</span>
                        </div>
                        <h3 className="font-semibold text-text-primary mb-1">{m.title}</h3>
                        {m.description && (
                          <p className="text-sm text-text-secondary leading-relaxed">{m.description}</p>
                        )}
                      </article>
                    </li>
                  )
                })}
              </ol>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}


