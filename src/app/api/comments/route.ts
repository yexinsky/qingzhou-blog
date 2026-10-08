import { z } from 'zod';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { renderCommentMarkdown } from '@/lib/markdown';
import { withRatelimit, commentRatelimit, globalRatelimit, getClientIP } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteSettings } from '@/lib/settings';
import { fireNotify } from '@/lib/notify';
import { resolveSiteUrl } from '@/lib/site-url';

// Validation schemas
const createCommentSchema = z.object({
  // v1.1（PRD 11.7）：评论对象泛化为 post / moment；postId 仍被接受以兼容旧客户端
  targetType: z.enum(['post', 'moment']).default('post'),
  targetId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email(),
  contentMd: z.string().min(1).max(2000),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  targetType: z.enum(['post', 'moment']).default('post'),
  targetId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
});

const publicCommentColumns = {
  id: true,
  targetType: true,
  targetId: true,
  parentId: true,
  rootId: true,
  depth: true,
  authorName: true,
  contentHtml: true,
  isPinned: true,
  createdAt: true,
} as const;

const adminCommentColumns = {
  ...publicCommentColumns,
  contentMd: true,
  status: true,
} as const;

const updateCommentSchema = z.object({
  authorName: z.string().min(1).max(100).optional(),
  authorEmail: z.string().email().optional(),
  contentMd: z.string().min(1).max(2000).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  isPinned: z.boolean().optional(),
});

// 获取评论列表（按 target）
export async function GET(request: NextRequest) {
  try {
    // 检查全局限流
    const ratelimitCheck = await withRatelimit(globalRatelimit)(request);
    if (!ratelimitCheck.success) {
      return ratelimitCheck.response!;
    }

    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      targetId: searchParams.get('targetId') || undefined,
      postId: searchParams.get('postId') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.errors }, { status: 400 });
    }

    const { page, limit } = parsed.data;
    const targetType = parsed.data.targetType;
    const targetId = parsed.data.targetId ?? parsed.data.postId;
    if (!targetId) {
      return NextResponse.json(
        { error: 'targetId is required' },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    const comments = await db.query.comments.findMany({
      where: and(
        eq(schema.comments.targetType, targetType),
        eq(schema.comments.targetId, targetId),
        eq(schema.comments.status, 'approved')
      ),
      columns: publicCommentColumns,
      orderBy: [desc(schema.comments.isPinned), desc(schema.comments.createdAt)],
      limit,
      offset,
    });

    // 构建评论树
    const commentMap = new Map(comments.map((c) => [c.id, { ...c, replies: [] as any[] }]));

    comments.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      }
    });

    // 只返回根评论
    const rootComments = comments.filter((c) => c.depth === 0);
    const formattedComments = rootComments.map((c) => commentMap.get(c.id));

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.comments)
      .where(and(
        eq(schema.comments.targetType, targetType),
        eq(schema.comments.targetId, targetId),
        eq(schema.comments.status, 'approved'),
        eq(schema.comments.depth, 0)
      ));

    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      comments: formattedComments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// 创建评论
export async function POST(request: NextRequest) {
  try {
    // 检查评论限流
    const ratelimitCheck = await withRatelimit(commentRatelimit)(request);
    if (!ratelimitCheck.success) {
      return ratelimitCheck.response!;
    }

    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);
    const targetType = validatedData.targetType;
    const targetId = validatedData.targetId ?? validatedData.postId;
    if (!targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    }

    // v1.1（PRD 11.5）：评论策略 —— 站点级总开关关闭时评论 API 直接 403
    const settings = await getSiteSettings();
    if (!settings.enableComments) {
      return NextResponse.json({ error: '站点已关闭评论功能' }, { status: 403 });
    }

    // 校验评论对象存在；文章还需已发布且允许评论
    let targetLabel: string;
    if (targetType === 'post') {
      const post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, targetId),
        columns: { id: true, status: true, allowComment: true, authorId: true, title: true, slug: true },
      });
      if (!post || post.status !== 'published') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      // v1.1（PRD 11.5）：文章级「允许评论」开关
      if (!post.allowComment) {
        return NextResponse.json({ error: '该文章已关闭评论' }, { status: 403 });
      }
      targetLabel = `文章《${post.title}》`;
    } else {
      const moment = await db.query.moments.findFirst({
        where: eq(schema.moments.id, targetId),
        columns: { id: true, content: true },
      });
      if (!moment) {
        return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
      }
      targetLabel = `动态「${moment.content.slice(0, 30)}」`;
    }

    // 处理嵌套回复
    let depth = 0;
    let rootId: string | null = null;

    if (validatedData.parentId) {
      const parentComment = await db.query.comments.findFirst({
        where: and(
          eq(schema.comments.id, validatedData.parentId),
          eq(schema.comments.targetType, targetType),
          eq(schema.comments.targetId, targetId),
          eq(schema.comments.status, 'approved')
        ),
        columns: { id: true, rootId: true, depth: true },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }

      // 最多嵌套2层（根评论=0，对根评论的回复=1）
      if (parentComment.depth >= 1) {
        return NextResponse.json(
          { error: 'Maximum nesting depth exceeded' },
          { status: 400 }
        );
      }

      depth = parentComment.depth + 1;
      rootId = parentComment.rootId || parentComment.id;

      // 防御历史脏数据：root 必须存在且属于同一评论对象。
      const rootComment = await db.query.comments.findFirst({
        where: and(
          eq(schema.comments.id, rootId),
          eq(schema.comments.targetType, targetType),
          eq(schema.comments.targetId, targetId)
        ),
        columns: { id: true },
      });
      if (!rootComment) {
        return NextResponse.json(
          { error: 'Invalid comment thread' },
          { status: 400 }
        );
      }
    }

    // 渲染评论HTML内容
    const contentHtml = await renderCommentMarkdown(validatedData.contentMd);

    // 获取客户端IP
    const ipAddress = getClientIP(request);

    // 创建评论（默认pending状态，需要审核）
    const commentId = randomUUID();
    await db
      .insert(schema.comments)
      .values({
        id: commentId,
        targetType,
        targetId,
        parentId: validatedData.parentId || null,
        rootId: rootId,
        depth,
        authorName: validatedData.authorName,
        authorEmail: validatedData.authorEmail,
        contentMd: validatedData.contentMd,
        contentHtml,
        status: 'pending', // 默认需要审核
        ipAddress,
      });

    // v1.1（PRD 11.8 / 11.9）：新评论待审核 / 评论被回复 → 邮件 + 飞书（异步、不阻塞）
    // 后台链接与 sitemap/RSS 共用同一份地址解析，漏配 SITE_URL 时也不会给管理员发出
    // 点不开的 localhost 链接。
    const consoleUrl = `${await resolveSiteUrl()}/console/comments`;
    fireNotify(depth > 0 ? 'comment.reply' : 'comment.pending', {
      title: depth > 0 ? '有新回复待审核' : '有新评论待审核',
      summary: `**${validatedData.authorName}** 评论了 ${targetLabel}：\n${validatedData.contentMd.slice(0, 80)}`,
      comment: {
        authorName: validatedData.authorName,
        targetLabel,
        contentSummary: validatedData.contentMd.slice(0, 200),
        consoleUrl,
      },
    });
    // 创建响应不回显邮箱、IP、审核状态或原始 Markdown。
    const newComment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
      columns: publicCommentColumns,
    });

    return NextResponse.json(
      {
        comment: newComment,
        message: 'Comment submitted and pending approval',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

// 更新评论（博主操作）
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateCommentSchema.parse(body);

    const updateData: any = {};

    if (validatedData.contentMd !== undefined) {
      updateData.contentMd = validatedData.contentMd;
      updateData.contentHtml = await renderCommentMarkdown(validatedData.contentMd);
    }

    if (validatedData.authorName !== undefined) {
      updateData.authorName = validatedData.authorName;
    }

    if (validatedData.authorEmail !== undefined) {
      updateData.authorEmail = validatedData.authorEmail;
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    if (validatedData.isPinned !== undefined) {
      updateData.isPinned = validatedData.isPinned;
    }

    await db
      .update(schema.comments)
      .set(updateData)
      .where(eq(schema.comments.id, commentId));
    // 即使管理员接口也遵循最小披露原则；邮箱/IP 不通过此接口返回。
    const updatedComment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
      columns: adminCommentColumns,
    });

    if (!updatedComment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedComment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

// 删除评论（博主操作）
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    const deleted = await db.query.comments.findFirst({ where: eq(schema.comments.id, commentId) });
    if (!deleted) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    await db
      .delete(schema.comments)
      .where(eq(schema.comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
