'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Heart, MessageCircle, X } from 'lucide-react';
import { CommentSection } from '@/components/comments/CommentSection';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

export type MomentComment = {
  id: string;
  author: { name: string; avatar?: string };
  content: string;
  createdAt: string;
};

type ApiComment = {
  id: string;
  authorName: string;
  contentHtml: string;
  createdAt: string;
};

const LIKE_RETRY_AFTER_MS = 60_000;

/**
 * 动态卡片（v1.1，PRD 11.7）：Markdown 内容 + 九宫格多图（点击放大浏览）
 * + 点赞 + 内联评论区。评论接口与文章共用，targetType='moment'。
 */
export function MomentCard({
  id,
  contentHtml,
  images,
  likeCount,
  publishedAt,
  commentCount,
  className,
}: {
  id: string;
  contentHtml: string;
  images: string[];
  likeCount: number;
  publishedAt: string;
  commentCount: number;
  className?: string;
}) {
  const { addToast } = useToast();
  const [likes, setLikes] = useState(likeCount);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<MomentComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => { setLikes(likeCount) }, [likeCount]);

  // 灯箱打开时锁定背景滚动
  useEffect(() => {
    if (!activeImage) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveImage(null); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [activeImage]);

  const handleLike = useCallback(async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id }),
      });
      if (res.status === 409) {
        addToast('今天已经点过赞了', 'info');
        return;
      }
      if (!res.ok) {
        addToast('点赞失败，请稍后再试', 'error');
        return;
      }
      const data = await res.json().catch(() => null) as { likeCount?: number } | null;
      setLikes(typeof data?.likeCount === 'number' ? data.likeCount : (prev) => prev + 1);
      setLiked(true);
      addToast('点赞成功', 'success');
    } catch {
      addToast('点赞失败，请检查网络', 'error');
    } finally {
      setTimeout(() => setLiking(false), LIKE_RETRY_AFTER_MS);
    }
  }, [id, liking, addToast]);

  const toggleComments = useCallback(async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments === null && !commentsLoading) {
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/comments?targetType=moment&targetId=${encodeURIComponent(id)}&limit=50`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || '加载评论失败');
        const items = (data?.comments ?? []) as ApiComment[];
        setComments(items.map((c) => ({
          id: c.id,
          author: { name: c.authorName },
          content: c.contentHtml,
          createdAt: c.createdAt,
        })));
      } catch (error) {
        addToast(error instanceof Error ? error.message : '加载评论失败', 'error');
        setCommentsOpen(false);
      } finally {
        setCommentsLoading(false);
      }
    }
  }, [commentsOpen, comments, commentsLoading, id, addToast]);

  // 九宫格布局：1 图大图，2/4 图两列，其余三列
  const gridClass =
    images.length === 1 ? 'grid-cols-1 max-w-sm'
      : images.length === 2 || images.length === 4 ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <article className={cn('bg-background-base rounded-card shadow-card p-5', className)}>
      <div className="flex items-center gap-1 text-xs text-text-muted mb-2">
        <Calendar className="w-3 h-3" />
        <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
      </div>

      {contentHtml ? (
        <div
          className="prose prose-sm max-w-none text-text-secondary [&_p]:mb-2 [&_a]:text-brand-orange [&_code]:bg-background-hover [&_code]:px-1 [&_code]:rounded [&_pre]:bg-background-hover [&_pre]:p-3 [&_pre]:rounded-button [&_pre]:overflow-x-auto [&_img]:rounded-button"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      ) : null}

      {images.length > 0 && (
        <div className={cn('mt-3 grid gap-1.5', gridClass)}>
          {images.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              className="group relative overflow-hidden rounded-button"
              onClick={() => setActiveImage(url)}
              aria-label={`查看图片 ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`动态配图 ${index + 1}`}
                loading="lazy"
                className={cn(
                  'w-full object-cover transition-transform group-hover:scale-[1.02]',
                  images.length === 1 ? 'max-h-80' : 'aspect-square'
                )}
              />
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={handleLike}
          disabled={liking}
          className={cn('flex items-center gap-1 transition-colors', liked ? 'text-brand-orange' : 'text-text-muted hover:text-brand-orange')}
          aria-label="为这条动态点赞"
        >
          <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
          <span>{likes}</span>
        </button>
        <button
          type="button"
          onClick={() => void toggleComments()}
          className={cn('flex items-center gap-1 transition-colors', commentsOpen ? 'text-brand-orange' : 'text-text-muted hover:text-brand-orange')}
          aria-expanded={commentsOpen}
        >
          <MessageCircle className="h-4 w-4" />
          <span>评论{commentCount > 0 ? ` (${commentCount})` : ''}</span>
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-4 border-t border-border pt-4">
          {commentsLoading ? (
            <p className="py-4 text-center text-sm text-text-muted">评论加载中…</p>
          ) : (
            <CommentSection comments={comments ?? []} targetId={id} targetType="moment" className="!space-y-4" />
          )}
        </div>
      )}

      {activeImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="图片放大浏览"
          onClick={() => setActiveImage(null)}
        >
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="关闭大图" onClick={() => setActiveImage(null)}>
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage} alt="动态配图大图" className="max-h-[90vh] max-w-full rounded-card object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </article>
  );
}
