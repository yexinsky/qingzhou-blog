import { notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section } from '@/components/layout/Container'
import { MomentCard } from '@/components/moments/MomentCard'
import { CommentSection } from '@/components/comments/CommentSection'
import { db, schema } from '@/lib/db'
import { getSiteSettings } from '@/lib/settings'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getMomentById(id: string) {
  // 接受 uuid 或纯短 id (仅作可访问性回退)。仅当合法 uuid 时查询数据库。
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidLike.test(id)) return null
  return await db.query.moments.findFirst({
    where: eq(schema.moments.id, id),
  })
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  const m = await getMomentById(resolvedParams.id)
  if (!m) return { title: '动态未找到 - Qzhou Blog' }
  return {
    title: '动态 - Qzhou Blog',
    description: m.content.slice(0, 100),
  }
}

export default async function MomentDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const moment = await getMomentById(resolvedParams.id)
  if (!moment) notFound()

  const [settings, approvedComments] = await Promise.all([
    getSiteSettings(),
    db.query.comments.findMany({
      where: and(
        eq(schema.comments.targetType, 'moment'),
        eq(schema.comments.targetId, moment.id),
        eq(schema.comments.status, 'approved')
      ),
      orderBy: [desc(schema.comments.createdAt)],
    }),
  ])

  const publishedAt = (moment.publishedAt ?? moment.createdAt).toISOString()
  const contentHtml = moment.contentMd ? await renderMarkdown(moment.contentMd) : ''
  const images = moment.images ?? (moment.imageUrl ? [moment.imageUrl] : [])

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container maxWidth="md">
            <Link
              href="/moments"
              className="inline-flex items-center text-sm text-text-secondary hover:text-brand-orange mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              回到动态列表
            </Link>

            <MomentCard
              id={moment.id}
              contentHtml={contentHtml || `<p>${moment.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`}
              images={images}
              likeCount={moment.likeCount ?? 0}
              publishedAt={publishedAt}
              commentCount={approvedComments.length}
            />

            {settings.enableComments && (
              <div className="mt-8 bg-background-base rounded-card shadow-card p-6">
                <CommentSection
                  comments={approvedComments.map((c) => ({
                    id: c.id,
                    author: { name: c.authorName },
                    content: c.contentHtml,
                    createdAt: c.createdAt.toISOString(),
                  }))}
                  targetId={moment.id}
                  targetType="moment"
                />
              </div>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}
