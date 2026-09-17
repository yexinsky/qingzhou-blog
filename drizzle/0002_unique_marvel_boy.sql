ALTER TABLE `posts` DROP CONSTRAINT `posts_status_check`;--> statement-breakpoint
ALTER TABLE `comments` DROP FOREIGN KEY `comments_post_id_posts_id_fk`;
--> statement-breakpoint
DROP INDEX `comments_post_id_idx` ON `comments`;--> statement-breakpoint
ALTER TABLE `comments` MODIFY COLUMN `post_id` varchar(36);--> statement-breakpoint
ALTER TABLE `posts` MODIFY COLUMN `status` enum('draft','published','scheduled','recycled') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `comments` ADD `target_type` enum('post','moment') DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE `comments` ADD `target_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `moments` ADD `content_md` text;--> statement-breakpoint
ALTER TABLE `moments` ADD `images` json;--> statement-breakpoint
ALTER TABLE `posts` ADD `visibility` enum('public','private') DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `allow_comment` boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- v1.1 存量数据回填：评论 target 泛化 + 动态 Markdown 原文（PRD 11.7）
UPDATE `comments` SET `target_id` = `post_id` WHERE `post_id` IS NOT NULL AND (`target_id` = '' OR `target_id` IS NULL);--> statement-breakpoint
UPDATE `moments` SET `content_md` = `content` WHERE `content_md` IS NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_status_check` CHECK (`posts`.`status` IN ('draft', 'published', 'scheduled', 'recycled'));--> statement-breakpoint
CREATE INDEX `comments_target_idx` ON `comments` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `posts_visibility_idx` ON `posts` (`visibility`);