import React from 'react'
import Link from 'next/link'
import { Github, Twitter, Mail, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPublicLinks, type PublicLinkKind } from '@/lib/public-links'

const linkIcons: Record<PublicLinkKind, typeof Github> = {
  github: Github,
  twitter: Twitter,
  email: Mail,
}

const footerLinks = [
  { label: '首页', href: '/' },
  { label: '关于我', href: '/about' },
  { label: 'RSS', href: '/rss.xml' },
]

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear()
  // 社交入口由 NEXT_PUBLIC_GITHUB_URL / NEXT_PUBLIC_TWITTER_URL /
  // NEXT_PUBLIC_CONTACT_EMAIL 提供；一个都没配时整列不渲染。
  const socialLinks = getPublicLinks()

  return (
    <footer className="border-t border-border bg-background-base mt-auto">
      <div className="page-container py-12">
        <div className={cn('grid grid-cols-1 gap-8', socialLinks.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          {/* Brand Section */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">Q</span>
              </div>
              <span className="text-xl font-bold text-text-primary">Qzhou Blog</span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              分享技术心得，记录成长历程。
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">快速链接</h3>
            <div className="flex flex-col space-y-2">
              {footerLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-text-secondary hover:text-brand-orange transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">关注我</h3>
              <div className="flex space-x-4">
                {socialLinks.map(social => {
                  const Icon = linkIcons[social.kind]
                  const isMail = social.kind === 'email'
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target={isMail ? undefined : '_blank'}
                      rel={isMail ? undefined : 'noopener noreferrer'}
                      className="p-2 rounded-button hover:bg-background-hover transition-colors"
                      aria-label={social.label}
                    >
                      <Icon className="w-5 h-5 text-text-secondary" />
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-center text-sm text-text-muted flex items-center justify-center space-x-1">
            <span>© {currentYear} Qzhou Blog. Made with</span>
            <Heart className="w-4 h-4 text-red-500" />
            <span>using Next.js</span>
          </p>
        </div>
      </div>
    </footer>
  )
}