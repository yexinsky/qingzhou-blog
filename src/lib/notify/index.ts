import { getSiteSettings } from '@/lib/settings';
import { decryptSecret } from '@/lib/crypto';
import { sendCommentNotification, shouldAggregate, type CommentMailPayload, type MailEvent } from '@/lib/notify/mail';
import { sendFeishuCard, type FeishuCardPayload, type FeishuEvent } from '@/lib/notify/feishu';
import { resolveSiteUrl } from '@/lib/site-url';

export type NotifyEvent = MailEvent | FeishuEvent;
export const NOTIFY_EVENTS: NotifyEvent[] = ['comment.pending', 'comment.reply', 'post.published', 'backup.completed', 'backup.failed'];
const FEISHU_SUBSCRIBABLE: FeishuEvent[] = ['comment.pending', 'post.published', 'backup.completed', 'backup.failed'];

// 通知里的后台链接与 sitemap/RSS 共用同一份地址解析，避免漏配 SITE_URL 时
// 邮件里出现 http://localhost:3000/console 这种点不开的地址。
async function resolveConsoleUrl(): Promise<string> {
  return `${await resolveSiteUrl()}/console`;
}

export interface NotifyPayload {
  title: string;
  summary: string;
  /** 邮件正文所需的评论细节 */
  comment?: CommentMailPayload;
}

/**
 * 站点事件通知分发（PRD 11.8 / 11.9）：SMTP 邮件与飞书群机器人两个通道
 * 相互独立、分别开关；推送异步执行、失败不阻塞主流程，仅记录日志。
 */
export async function notifyEvent(event: NotifyEvent, payload: NotifyPayload): Promise<void> {
  // 异步派发但不等待，调用方不因通知阻塞
  try {
    const settings = await getSiteSettings();
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const consoleUrl = await resolveConsoleUrl();

    const tasks: Promise<unknown>[] = [];

    if (settings.smtpEnabled) {
      // 评论事件带聚合限频；同事件 1 分钟内只发一封
      const aggregated = (event === 'comment.pending' || event === 'comment.reply') && shouldAggregate(`mail:${event}`);
      if (!aggregated && payload.comment) {
        tasks.push(
          sendCommentNotification(settings, event, payload.comment).then((result) => {
            if (!result.ok) console.error(`[notify] mail ${event} failed:`, result.error);
          })
        );
      }
    }

    if (settings.feishuEnabled && settings.feishuWebhookUrl) {
      const subscribable = FEISHU_SUBSCRIBABLE.includes(event as FeishuEvent);
      if (subscribable) {
        const subscriptions = Array.isArray(settings.feishuEvents) ? settings.feishuEvents : [];
        const subscribed = subscriptions.length === 0 || subscriptions.includes(event);
        if (subscribed) {
          const card: FeishuCardPayload = { title: payload.title, summary: payload.summary, timestamp, consoleUrl };
          tasks.push(
            sendFeishuCard(settings.feishuWebhookUrl, decryptSecret(settings.feishuSecret), card).then((result) => {
              if (!result.ok) console.error(`[notify] feishu ${event} failed:`, result.error);
            })
          );
        }
      }
    }

    await Promise.allSettled(tasks);
  } catch (error) {
    console.error('[notify] dispatch failed:', error);
  }
}

/** 触发即忘的封装：调用方无需 await */
export function fireNotify(event: NotifyEvent, payload: NotifyPayload): void {
  void notifyEvent(event, payload);
}
