'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Home, LayoutDashboard, PenTool, Image, MessageSquare, FolderOpen, Paperclip, Trash2, Settings, FileText, DatabaseBackup, User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteLogo } from '@/components/layout/SiteLogo'

interface NavItem { icon: React.ElementType; label: string; href: string; badge?: number }
const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: '仪表盘', href: '/console' },
  { icon: PenTool, label: '文章管理', href: '/console/posts' },
  { icon: FolderOpen, label: '分类管理', href: '/console/categories' },
  { icon: Trash2, label: '回收站', href: '/console/posts/recycle-bin' },
  { icon: Image, label: '动态管理', href: '/console/moments' },
  { icon: MessageSquare, label: '评论管理', href: '/console/comments' },
  { icon: Paperclip, label: '附件管理', href: '/console/attachments' },
  { icon: FileText, label: '页面管理', href: '/console/pages' },
  { icon: User, label: '个人资料', href: '/console/profile' },
  { icon: DatabaseBackup, label: '备份与恢复', href: '/console/backup' },
  { icon: Settings, label: '站点设置', href: '/console/settings' },
]

export const AdminSidebar: React.FC<{ className?: string }> = ({ className }) => {
  const pathname = usePathname()
  return (
    <aside className={cn('w-64 shrink-0 bg-background-base border-r border-border min-h-screen sticky top-0', className)}>
      <div className="p-6 border-b border-border">
        <Link href="/console" className="flex items-center space-x-2">
          <SiteLogo size={32} />
          <span className="text-xl font-bold text-text-primary">管理后台</span>
        </Link>
      </div>
      <nav className="p-4 space-y-1">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return <Link key={item.href} href={item.href} className={cn('flex items-center space-x-3 px-4 py-3 rounded-button transition-colors', isActive ? 'bg-brand-orange text-white' : 'text-text-secondary hover:bg-background-hover')}>
            <item.icon className="w-5 h-5" /><span className="font-medium">{item.label}</span>
            {item.badge ? <span className="ml-auto px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">{item.badge}</span> : null}
          </Link>
        })}
        <div className="h-px bg-border my-4" />
        <Link href="/" className="flex items-center space-x-3 px-4 py-3 rounded-button text-text-secondary hover:bg-background-hover transition-colors">
          <Home className="w-5 h-5" /><span className="font-medium">返回前台</span>
        </Link>
        <button type="button" onClick={() => void signOut({ callbackUrl: '/console/login' })} className="w-full flex items-center space-x-3 px-4 py-3 rounded-button text-text-secondary hover:bg-background-hover transition-colors">
          <LogOut className="w-5 h-5" /><span className="font-medium">退出登录</span>
        </button>
      </nav>
    </aside>
  )
}
