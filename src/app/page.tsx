import React from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Container, Section, PageTitle } from '@/components/layout/Container'
import { MainLayout } from '@/components/layout/Layout'
import { Sidebar, TagCloudSection, RecentPostsSection } from '@/components/layout/Sidebar'
import { ArticleList } from '@/components/article/ArticleList'
import { getHomePageData } from '@/lib/queries/home'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Qzhou Blog - 个人技术博客',
  description: '分享技术心得，记录成长历程',
}

// SVG icon kept inline so the empty state can render without any client
// component or extra fetch. The shape is decorative only.
function EmptyIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 140"
      className="mx-auto h-40 w-auto text-brand-orange/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="30" y="30" width="110" height="80" rx="10" className="text-background-hover" fill="currentColor" />
      <rect x="46" y="50" width="78" height="10" rx="3" className="text-border-strong" fill="currentColor" stroke="none" />
      <rect x="46" y="68" width="60" height="6" rx="3" className="text-border" fill="currentColor" stroke="none" />
      <rect x="46" y="80" width="70" height="6" rx="3" className="text-border" fill="currentColor" stroke="none" />
      <rect x="46" y="92" width="40" height="6" rx="3" className="text-border" fill="currentColor" stroke="none" />
      <circle cx="160" cy="40" r="14" className="text-brand-orange" fill="currentColor" stroke="none" />
      <path d="M155 40 l4 4 l8 -8" className="text-white" stroke="currentColor" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="bg-background-base rounded-card shadow-card p-10 md:p-14 text-center">
      <EmptyIllustration />
      <h2 className="mt-6 text-2xl font-semibold text-text-primary">还没有发布的文章</h2>
      <p className="mt-3 text-sm md:text-base text-text-secondary leading-relaxed max-w-md mx-auto">
        这里暂时还没有内容，先去其他板块逛逛吧。
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/moments"
          className="inline-flex items-center px-5 py-2.5 rounded-button text-sm font-medium bg-brand-orange text-white hover:bg-brand-dark transition-colors"
        >
          看看动态
        </Link>
        <Link
          href="/projects"
          className="inline-flex items-center px-5 py-2.5 rounded-button text-sm font-medium bg-background-hover text-text-primary hover:bg-background-cream transition-colors"
        >
          浏览项目
        </Link>
      </div>
    </div>
  )
}

export default async function HomePage() {
  const { articles, tags, recentPosts, profile, totalPosts } = await getHomePageData()

  const sidebarTags = tags.map((t) => ({ name: t.name, count: t.count, href: t.href }))
  const sidebarProfile = {
    name: profile.name,
    bio: profile.bio,
    avatar: profile.avatar,
    tags: profile.tags,
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <Section>
          <Container>
            <MainLayout
              sidebar={
                <Sidebar showProfile profileCard={sidebarProfile}>
                  {sidebarTags.length > 0 && (
                    <TagCloudSection title="标签云" tags={sidebarTags} />
                  )}
                  {recentPosts.length > 0 && (
                    <RecentPostsSection title="最近文章" posts={recentPosts} />
                  )}
                </Sidebar>
              }
            >
              <div className="space-y-8">
                <PageTitle
                  title="技术博客"
                  description="分享技术心得，记录成长历程"
                />

                <div>
                  <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl font-bold text-text-primary">最新文章</h2>
                    {totalPosts > 0 && (
                      <Link
                        href="/posts"
                        className="text-sm text-text-secondary hover:text-brand-orange transition-colors"
                      >
                        查看全部 →
                      </Link>
                    )}
                  </div>

                  {articles.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <ArticleList
                      articles={articles}
                      variant="grid"
                      cols={2}
                      emptyMessage="还没有发布的文章。"
                    />
                  )}
                </div>
              </div>
            </MainLayout>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  )
}



