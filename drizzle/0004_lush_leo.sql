CREATE TABLE `backups` (
	`id` varchar(36) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`size` bigint NOT NULL DEFAULT 0,
	`type` enum('full') NOT NULL DEFAULT 'full',
	`status` enum('running','success','failed') NOT NULL DEFAULT 'running',
	`note` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_revisions` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content_md` text NOT NULL,
	`word_count` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `post_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `single_pages` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`content_md` text NOT NULL,
	`content_html` text NOT NULL,
	`visible` boolean NOT NULL DEFAULT true,
	`allow_comment` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `single_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `single_pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `post_revisions` ADD CONSTRAINT `post_revisions_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `backups_created_at_idx` ON `backups` (`created_at`);--> statement-breakpoint
CREATE INDEX `post_revisions_post_id_idx` ON `post_revisions` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `single_pages_slug_idx` ON `single_pages` (`slug`);