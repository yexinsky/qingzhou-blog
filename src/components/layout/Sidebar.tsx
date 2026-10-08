import React from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { TagCloud } from '@/components/ui/Tag'

interface ProfileCardProps {
  name?: string
  bio?: string
  avatar?: string
  tags?: Array<{ name: string; count?: number; href?: string }>
}

// 昵称与简介不设占位默认值：博主尚未填写时对应行不渲染，而不是在线上站点显示
// 「你的名字」这类模板文字；整张卡都没内容时连空壳一起省掉。
export const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  bio,
  avatar,
  tags = []
}) => {
  // 没有昵称时不能渲染 Avatar：它会退到 alt 首字母渲染一个无意义的字母。
  const showAvatar = Boolean(avatar) || Boolean(name)
  const showText = Boolean(name) || Boolean(bio)
  if (!showAvatar && !showText && tags.length === 0) return null

  return (
    <div className="bg-background-base rounded-card shadow-card p-6">
      <div className="flex flex-col items-center text-center space-y-4">
        {showAvatar && <Avatar src={avatar} fallback={name} size="xl" />}
        {showText && (
          <div className="space-y-2">
            {name && <h3 className="text-lg font-semibold text-text-primary">{name}</h3>}
            {bio && <p className="text-sm text-text-secondary leading-relaxed">{bio}</p>}
          </div>
        )}
        {tags.length > 0 && (
          <div className="pt-2">
            <TagCloud tags={tags} size="sm" />
          </div>
        )}
      </div>
    </div>
  )
}

interface SidebarProps {
  children?: React.ReactNode
  profileCard?: ProfileCardProps
  showProfile?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
  children,
  profileCard,
  showProfile = false
}) => {
  return (
    <aside className="space-y-6">
      {showProfile && profileCard && <ProfileCard {...profileCard} />}
      {children}
    </aside>
  )
}

interface TagCloudSectionProps {
  title?: string
  tags?: Array<{ name: string; count?: number; href?: string }>
}

export const TagCloudSection: React.FC<TagCloudSectionProps> = ({
  title = '标签云',
  tags = []
}) => {
  return (
    <div className="bg-background-base rounded-card shadow-card p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
      <TagCloud tags={tags} />
    </div>
  )
}

interface RecentPostsSectionProps {
  posts?: Array<{ title: string; slug: string; date: string }>
  title?: string
}

export const RecentPostsSection: React.FC<RecentPostsSectionProps> = ({
  posts = [],
  title = '最近文章'
}) => {
  return (
    <div className="bg-background-base rounded-card shadow-card p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
      <div className="space-y-3">
        {posts.map((post, index) => (
          <a
            key={index}
            href={`/posts/${post.slug}`}
            className="block group"
          >
            <h4 className="text-sm font-medium text-text-secondary group-hover:text-brand-orange transition-colors line-clamp-2">
              {post.title}
            </h4>
            <p className="text-xs text-text-muted mt-1">{post.date}</p>
          </a>
        ))}
      </div>
    </div>
  )
}