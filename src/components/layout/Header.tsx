'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { SiteLogo } from './SiteLogo'

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/moments', label: '动态' },
  { href: '/learning', label: '学习路线' },
  { href: '/projects', label: '项目展示' },
  { href: '/timeline', label: '时间线' },
  { href: '/about', label: '关于我' },
]

export const Header: React.FC = () => {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background-base/80 backdrop-blur-sm">
      <div className="page-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <SiteLogo size={32} />
            <span className="text-xl font-bold text-text-primary hidden sm:block">Qzhou Blog</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map(link => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-button transition-colors',
                    isActive
                      ? 'bg-brand-orange text-white'
                      : 'text-text-secondary hover:bg-background-hover'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-button hover:bg-background-hover transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-text-secondary" />
              ) : (
                <Moon className="w-5 h-5 text-text-secondary" />
              )}
            </button>

            {/* Admin Link */}
            <Link
              href="/console"
              className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium bg-brand-orange text-white rounded-button hover:bg-brand-dark transition-colors"
            >
              管理后台
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-button hover:bg-background-hover transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 text-text-secondary" />
              ) : (
                <Menu className="w-5 h-5 text-text-secondary" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-1">
              {navLinks.map(link => {
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      'px-4 py-3 text-sm font-medium rounded-button transition-colors',
                      isActive
                        ? 'bg-brand-orange text-white'
                        : 'text-text-secondary hover:bg-background-hover'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Link
                href="/console"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 text-sm font-medium bg-brand-orange text-white rounded-button text-center"
              >
                管理后台
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}