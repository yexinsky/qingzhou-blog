import { desc, eq } from 'drizzle-orm'
import { Mail, Github, Twitter, ArrowRight } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { TagCloud } from '@/components/ui/Tag'
import Link from 'next/link'
import { db, schema } from '@/lib/db'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '关于我 - Qzhou Blog',
  description: '关于我、技能与联系方式。',
}

// v1.1（PRD 11.12）：/about 绑定 slug='about' 的自定义页面内容，后台可编辑、支持可见性开关
async function getAboutPage() {
  const page = await db.query.singlePages.findFirst({
    where: eq(schema.singlePages.slug, 'about'),
  })
  if (!page || !page.visible) return null
  return page
}

async function getProfile() {
  const user = await db.query.users.findFirst({
    orderBy: [desc(schema.users.createdAt)],
  })
  return user
    ? {
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
        bio: user.bio ?? undefined,
      }
    : null
}

async function getPopularTags() {
  const tags = await db.query.tags.findMany({
    with: { posts: { columns: { postId: true } } },
    limit: 12,
  })
  return tags.map((t) => ({
    name: t.name,
    href: '/tags/' + t.slug,
    count: t.posts?.length ?? 0,
  }))
}

export default async function AboutPage() {
  const [profile, popularTags, aboutPage] = await Promise.all([getProfile(), getPopularTags(), getAboutPage()])
  const aboutHtml = aboutPage?.contentMd ? await renderMarkdown(aboutPage.contentMd) : null

  const socials = [
    { href: 'https://github.com/qzhou', label: 'GitHub', icon: Github },
    { href: 'https://twitter.com/qzhou', label: 'Twitter', icon: Twitter },
    ...(process.env.PUBLIC_CONTACT_EMAIL
      ? [{ href: 'mailto:' + process.env.PUBLIC_CONTACT_EMAIL, label: '邮箱', icon: Mail }]
      : []),
  ]

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container maxWidth="md">
            <PageTitle
              title="关于我"
              description="在路上，不断前行。"
            />

            {aboutHtml && (
              <article
                className="prose prose-base max-w-none bg-background-base rounded-card shadow-card p-6 md:p-8 mb-6 [&_a]:text-brand-orange [&_img]:rounded-button"
                dangerouslySetInnerHTML={{ __html: aboutHtml }}
              />
            )}

            <article className="bg-background-base rounded-card shadow-card p-6 md:p-8 space-y-6">
              <header className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-brand-orange text-white text-3xl font-bold mb-4 overflow-hidden">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(profile?.username ?? 'Q').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-text-primary">
                  {profile?.username ?? 'Qzhou'}
                </h2>
                {profile?.bio ? (
                  <p className="text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">{profile.bio}</p>
                ) : (
                  <p className="text-text-muted mt-2 max-w-md mx-auto">
                    全栈开发工程师，热爱技术，喜欢分享。专注于 Web 开发、前端架构和开源项目。
                  </p>
                )}
              </header>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-border">
                {socials.map((s) => {
                  const Icon = s.icon
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target={s.href.startsWith('mailto:') ? undefined : '_blank'}
                      rel={s.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-button border border-border-strong text-text-primary text-sm hover:bg-background-hover transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{s.label}</span>
                    </a>
                  )
                })}
              </div>
            </article>

            <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/posts" className="block bg-background-base rounded-card shadow-card p-5 hover:shadow-hover transition-all">
                <h3 className="font-medium text-text-primary mb-1">所有文章</h3>
                <p className="text-sm text-text-secondary mb-3">浏览已发布的技术文章。</p>
                <span className="inline-flex items-center text-sm text-brand-orange">
                  前往 <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              </Link>
              <Link href="/projects" className="block bg-background-base rounded-card shadow-card p-5 hover:shadow-hover transition-all">
                <h3 className="font-medium text-text-primary mb-1">项目展示</h3>
                <p className="text-sm text-text-secondary mb-3">个人项目与开源作品。</p>
                <span className="inline-flex items-center text-sm text-brand-orange">
                  前往 <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              </Link>
              <Link href="/moments" className="block bg-background-base rounded-card shadow-card p-5 hover:shadow-hover transition-all">
                <h3 className="font-medium text-text-primary mb-1">动态</h3>
                <p className="text-sm text-text-secondary mb-3">随手记录的即时刻。</p>
                <span className="inline-flex items-center text-sm text-brand-orange">
                  前往 <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              </Link>
            </section>

            {popularTags.length > 0 && (
              <section className="mt-8 bg-background-base rounded-card shadow-card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">常关注的话题</h3>
                <TagCloud tags={popularTags} />
              </section>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}



