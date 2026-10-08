'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, ThumbsUp, Eye, Share2, Bookmark, BookmarkCheck, Send } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  author: {
    name: string
    avatar?: string
  }
  content: string
  createdAt: string
}

interface CommentSectionProps {
  comments: Comment[]
  className?: string
  /**
   * When provided, the comment form is rendered and submissions POST to
   * /api/comments. New comments enter the 'pending' queue for moderation.
   * v1.1: 评论对象泛化为 post / moment（PRD 11.7）。
   */
  targetId?: string
  targetType?: 'post' | 'moment'
}

const COMMENT_IDENTITY_KEY = 'qzhou-blog-comment-identity-v1'
const MAX_COMMENT_LENGTH = 2000

function readCommentIdentity(): { name: string; email: string } {
  if (typeof window === 'undefined') return { name: '', email: '' }
  try {
    const raw = window.localStorage.getItem(COMMENT_IDENTITY_KEY)
    if (!raw) return { name: '', email: '' }
    const parsed = JSON.parse(raw)
    return {
      name: typeof parsed?.name === 'string' ? parsed.name : '',
      email: typeof parsed?.email === 'string' ? parsed.email : '',
    }
  } catch {
    return { name: '', email: '' }
  }
}

function writeCommentIdentity(identity: { name: string; email: string }): void {
  try {
    window.localStorage.setItem(COMMENT_IDENTITY_KEY, JSON.stringify(identity))
  } catch {
    // localStorage unavailable — identity simply won't be remembered.
  }
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, className, targetId, targetType = 'post' }) => {
  return (
    <div className={cn('space-y-6', className)}>
      <h3 className="text-2xl font-bold text-text-primary flex items-center space-x-2">
        <MessageCircle className="w-6 h-6" />
        <span>评论 ({comments.length})</span>
      </h3>

      {targetId && <CommentForm targetId={targetId} targetType={targetType} />}

      <div className="space-y-6">
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-center py-8 text-text-muted">
          暂无评论，来抢沙发吧！
        </p>
      )}
    </div>
  )
}

interface CommentFormProps {
  targetId: string
  targetType: 'post' | 'moment'
}

/**
 * 评论发表表单：匿名访客填写昵称与邮箱即可留言，提交后进入待审核队列。
 */
const CommentForm: React.FC<CommentFormProps> = ({ targetId, targetType }) => {
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const identity = readCommentIdentity()
    if (identity.name) setName(identity.name)
    if (identity.email) setEmail(identity.email)
  }, [])

  const remaining = MAX_COMMENT_LENGTH - content.length
  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && content.trim().length > 0 && remaining >= 0 && !submitting

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          authorName: name.trim(),
          authorEmail: email.trim(),
          contentMd: content.trim(),
        }),
      })
      if (res.status === 429) {
        addToast('评论太频繁了，请稍后再试', 'warning')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        addToast(data?.error ? `提交失败：${data.error}` : '提交失败，请稍后再试', 'error')
        return
      }
      writeCommentIdentity({ name: name.trim(), email: email.trim() })
      setContent('')
      setSubmitted(true)
      addToast('评论已提交，审核通过后将显示', 'success')
    } catch {
      addToast('提交失败，请检查网络', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, targetId, targetType, name, email, content, addToast])

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-background-base p-5 space-y-4" aria-label="发表评论">
      <p className="text-sm font-medium text-text-primary">发表评论</p>
      {submitted && (
        <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2">
          评论已提交，等待管理员审核通过后会显示在这里。
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="昵称（必填）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          aria-label="昵称"
        />
        <Input
          type="email"
          placeholder="邮箱（必填，不会公开）"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          required
          aria-label="邮箱"
        />
      </div>
      <div>
        <textarea
          placeholder="写下你的评论……（支持 Markdown 基础语法）"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          rows={4}
          maxLength={MAX_COMMENT_LENGTH}
          className="w-full px-4 py-2.5 rounded-button border border-border bg-background-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-orange/40 resize-y"
          aria-label="评论内容"
        />
        <div className="text-right text-xs text-text-muted mt-1">
          {content.length}/{MAX_COMMENT_LENGTH}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          <Send className="w-4 h-4 mr-1.5" />
          {submitting ? '提交中…' : '提交评论'}
        </Button>
      </div>
    </form>
  )
}

const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => {
  return (
    <div className="flex space-x-4">
      <Avatar src={comment.author.avatar} fallback={comment.author.name} size="md" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-text-primary">{comment.author.name}</span>
          <span className="text-xs text-text-muted">{formatDate(comment.createdAt)}</span>
        </div>
        <p className="text-text-secondary leading-relaxed">{comment.content}</p>
      </div>
    </div>
  )
}

// ---- PostActions -------------------------------------------------------------

/**
 * Persistence keys. Kept narrow so the bookmark store cannot accidentally
 * collide with theme or other settings.
 */
const BOOKMARK_KEY = 'qzhou-blog-bookmarks-v1'
const LIKE_RETRY_AFTER_MS = 60_000

interface PostActionsProps {
  likes?: number
  views?: number
  /** Article postId. Required: the like button POSTs /api/likes with it. */
  postId: string
  /** Title used for share text and bookmark records. */
  title?: string
  /** Optional explicit URL. Defaults to window.location.href in the browser. */
  url?: string
  className?: string
}

interface BookmarkRecord {
  postId: string
  title: string
  url: string
  savedAt: string
}

function readBookmarks(): BookmarkRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BOOKMARK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as BookmarkRecord[]) : []
  } catch {
    return []
  }
}

function writeBookmarks(records: BookmarkRecord[]): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

function resolveShareUrl(explicit?: string): string {
  if (explicit) return explicit
  if (typeof window !== 'undefined' && window.location?.href) return window.location.href
  return ''
}

/**
 * Try the Web Share API first (mobile-friendly), fall back to clipboard.
 * Resolves with a human-readable result the caller can surface in a toast.
 */
async function sharePost(title: string, url: string): Promise<{ ok: true; via: 'share' | 'clipboard' } | { ok: false; reason: string }> {
  if (!url) return { ok: false, reason: '无法获取当前页面地址' }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return { ok: true, via: 'share' }
    } catch (err) {
      // AbortError means the user cancelled — treat as a soft failure.
      const name = (err && typeof err === 'object' && 'name' in err) ? String((err as { name?: unknown }).name) : ''
      if (name === 'AbortError') return { ok: false, reason: '已取消分享' }
      // Anything else means Web Share is unavailable; fall through to clipboard.
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url)
      return { ok: true, via: 'clipboard' }
    } catch {
      return { ok: false, reason: '复制到剪贴板失败' }
    }
  }
  return { ok: false, reason: '当前浏览器不支持分享或复制' }
}

export const PostActions: React.FC<PostActionsProps> = ({
  likes = 0,
  views = 0,
  postId,
  title,
  url,
  className,
}) => {
  const { addToast } = useToast()
  const [likeCount, setLikeCount] = useState(likes)
  const [liking, setLiking] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [sharing, setSharing] = useState(false)

  // Keep server-provided count in sync when the prop changes (e.g. navigation).
  useEffect(() => { setLikeCount(likes) }, [likes])

  // Restore bookmark state on mount; never touch localStorage during render.
  useEffect(() => {
    const existing = readBookmarks()
    setBookmarked(existing.some(r => r.postId === postId))
  }, [postId])

  const shareUrl = useMemo(() => resolveShareUrl(url), [url])
  const likeDisabled = liking

  const handleLike = useCallback(async () => {
    if (liking) return
    setLiking(true)
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      if (res.status === 409) {
        addToast('今天已经点过赞了', 'info')
        return
      }
      if (!res.ok) {
        addToast('点赞失败，请稍后再试', 'error')
        return
      }
      const data = await res.json().catch(() => null) as { likeCount?: number } | null
      if (data && typeof data.likeCount === 'number') {
        setLikeCount(data.likeCount)
      } else {
        setLikeCount(prev => prev + 1)
      }
      addToast('点赞成功', 'success')
    } catch {
      addToast('点赞失败，请检查网络', 'error')
    } finally {
      setTimeout(() => setLiking(false), LIKE_RETRY_AFTER_MS)
    }
  }, [liking, postId, addToast])

  const handleShare = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    try {
      const result = await sharePost(title ?? '来自 Qzhou Blog 的文章', shareUrl)
      if (result.ok) {
        addToast(result.via === 'share' ? '已调起分享' : '链接已复制到剪贴板', 'success')
      } else {
        addToast(result.reason, 'warning')
      }
    } finally {
      setSharing(false)
    }
  }, [sharing, title, shareUrl, addToast])

  const handleBookmark = useCallback(() => {
    const existing = readBookmarks()
    const idx = existing.findIndex(r => r.postId === postId)
    let next: BookmarkRecord[]
    let nowBookmarked: boolean
    if (idx >= 0) {
      next = existing.filter((_, i) => i !== idx)
      nowBookmarked = false
    } else {
      next = [
        { postId, title: title ?? '', url: shareUrl, savedAt: new Date().toISOString() },
        ...existing,
      ]
      nowBookmarked = true
    }
    if (!writeBookmarks(next)) {
      addToast('收藏失败：localStorage 不可用', 'error')
      return
    }
    setBookmarked(nowBookmarked)
    addToast(nowBookmarked ? '已加入收藏' : '已取消收藏', 'success')
  }, [postId, title, shareUrl, addToast])

  return (
    <div className={cn('flex items-center justify-between py-4 border-y border-border', className)}>
      <div className="flex items-center space-x-4 text-sm text-text-muted">
        <span className="flex items-center space-x-1">
          <Eye className="w-4 h-4" />
          <span>{views} 阅读</span>
        </span>
        <button
          type="button"
          onClick={handleLike}
          disabled={likeDisabled}
          aria-disabled={likeDisabled}
          title="为文章点赞"
          className={cn(
            'flex items-center space-x-1 transition-colors',
            liking ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-orange cursor-pointer',
          )}
        >
          <ThumbsUp className="w-4 h-4" />
          <span>{likeCount} 赞</span>
        </button>
        <span className="flex items-center space-x-1">
          <MessageCircle className="w-4 h-4" />
          <span>评论</span>
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          disabled={sharing}
          aria-label="分享文章"
        >
          <Share2 className="w-4 h-4 mr-1" />
          分享
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBookmark}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? '取消收藏' : '收藏文章'}
        >
          {bookmarked ? (
            <>
              <BookmarkCheck className="w-4 h-4 mr-1 text-brand-orange" />
              已收藏
            </>
          ) : (
            <>
              <Bookmark className="w-4 h-4 mr-1" />
              收藏
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
