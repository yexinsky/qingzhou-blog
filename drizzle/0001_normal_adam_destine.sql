CREATE TABLE `attachment_groups` (
	`id` varchar(36) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `attachment_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` varchar(36) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` bigint NOT NULL,
	`url` varchar(500) NOT NULL,
	`group_id` varchar(36),
	`storage` varchar(50) NOT NULL DEFAULT 'local',
	`uploader_id` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` varchar(36) NOT NULL,
	`site_name` varchar(100) NOT NULL DEFAULT 'QzBlog',
	`site_description` varchar(500),
	`site_logo` varchar(500),
	`site_favicon` varchar(500),
	`avatar_url` varchar(500),
	`bio` text,
	`dark_mode_default` boolean NOT NULL DEFAULT false,
	`icp_number` varchar(100),
	`custom_css` text,
	`seo_keywords` varchar(500),
	`block_search_engine` boolean NOT NULL DEFAULT false,
	`enable_comments` boolean NOT NULL DEFAULT true,
	`smtp_enabled` boolean NOT NULL DEFAULT false,
	`smtp_host` varchar(200),
	`smtp_port` int,
	`smtp_user` varchar(200),
	`smtp_pass` varchar(500),
	`smtp_from` varchar(200),
	`smtp_display_name` varchar(100),
	`feishu_enabled` boolean NOT NULL DEFAULT false,
	`feishu_webhook_url` varchar(500),
	`feishu_secret` varchar(500),
	`feishu_events` json,
	`smtp_events` json,
	`backup_keep_count` int NOT NULL DEFAULT 5,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `comments` MODIFY COLUMN `ip_address` varchar(45);--> statement-breakpoint
ALTER TABLE `page_views` MODIFY COLUMN `visitor_ip` varchar(45);--> statement-breakpoint
ALTER TABLE `posts` ADD `category_id` varchar(36);--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_group_id_attachment_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `attachment_groups`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_uploader_id_users_id_fk` FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attachment_groups_sort_order_idx` ON `attachment_groups` (`sort_order`);--> statement-breakpoint
CREATE INDEX `attachments_group_id_idx` ON `attachments` (`group_id`);--> statement-breakpoint
CREATE INDEX `attachments_storage_idx` ON `attachments` (`storage`);--> statement-breakpoint
CREATE INDEX `attachments_created_at_idx` ON `attachments` (`created_at`);--> statement-breakpoint
CREATE INDEX `attachments_filename_idx` ON `attachments` (`filename`);--> statement-breakpoint
CREATE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_sort_order_idx` ON `categories` (`sort_order`);--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_depth_check` CHECK (`comments`.`depth` BETWEEN 0 AND 1);--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_status_check` CHECK (`comments`.`status` IN ('pending', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD CONSTRAINT `learning_nodes_status_check` CHECK (`learning_nodes`.`status` IN ('planned', 'learning', 'completed'));--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_status_check` CHECK (`posts`.`status` IN ('draft', 'published', 'scheduled'));--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;