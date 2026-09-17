CREATE TABLE `comments` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`root_id` varchar(36),
	`depth` int NOT NULL DEFAULT 0,
	`author_name` varchar(100) NOT NULL,
	`author_email` varchar(255) NOT NULL,
	`content_md` text NOT NULL,
	`content_html` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`is_pinned` boolean NOT NULL DEFAULT false,
	`ip_address` varchar(45),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`),
	CONSTRAINT `comments_depth_check` CHECK (`depth` BETWEEN 0 AND 1),
	CONSTRAINT `comments_status_check` CHECK (`status` IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE `learning_nodes` (
	`id` varchar(36) NOT NULL,
	`path_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`status` enum('planned','learning','completed') NOT NULL DEFAULT 'planned',
	`post_id` varchar(36),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `learning_nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `learning_nodes_status_check` CHECK (`status` IN ('planned', 'learning', 'completed'))
);
--> statement-breakpoint
CREATE TABLE `learning_paths` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`cover_image` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `learning_paths_id` PRIMARY KEY(`id`),
	CONSTRAINT `learning_paths_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`event_date` date NOT NULL,
	`event_type` enum('work','study','open_source','speech','other') NOT NULL,
	`icon` varchar(50),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_public` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moment_likes` (
	`id` varchar(36) NOT NULL,
	`moment_id` varchar(36) NOT NULL,
	`ip_address` varchar(64) NOT NULL,
	`like_date` date NOT NULL DEFAULT (CURRENT_DATE),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `moment_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `moment_likes_daily_unique` UNIQUE(`moment_id`,`ip_address`,`like_date`)
);
--> statement-breakpoint
CREATE TABLE `moments` (
	`id` varchar(36) NOT NULL,
	`content` varchar(500) NOT NULL,
	`image_url` varchar(500),
	`like_count` int NOT NULL DEFAULT 0,
	`published_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `moments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page_type` varchar(50) NOT NULL,
	`page_id` varchar(36),
	`visitor_ip` varchar(45),
	`user_agent` varchar(500),
	`referrer` varchar(500),
	`referrer_type` varchar(20),
	`country` varchar(100),
	`visited_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_likes` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`ip_address` varchar(64) NOT NULL,
	`like_date` date NOT NULL DEFAULT (CURRENT_DATE),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `post_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_likes_daily_unique` UNIQUE(`post_id`,`ip_address`,`like_date`)
);
--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`content_md` text NOT NULL,
	`content_html` text NOT NULL,
	`summary` varchar(500),
	`cover_image` varchar(500),
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`is_pinned` boolean NOT NULL DEFAULT false,
	`word_count` int NOT NULL DEFAULT 0,
	`like_count` int NOT NULL DEFAULT 0,
	`view_count` int NOT NULL DEFAULT 0,
	`scheduled_at` datetime(3),
	`published_at` datetime(3),
	`cancel_scheduled` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `posts_status_check` CHECK (`status` IN ('draft', 'published', 'scheduled'))
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`tech_stack` json NOT NULL,
	`cover_image` varchar(500),
	`github_url` varchar(500),
	`demo_url` varchar(500),
	`star_count` int DEFAULT 0,
	`is_featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`cover_image` varchar(500),
	`is_pinned` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `series_id` PRIMARY KEY(`id`),
	CONSTRAINT `series_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `series_posts` (
	`id` varchar(36) NOT NULL,
	`series_id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `series_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `series_posts_post_id_unique` UNIQUE(`post_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(36) NOT NULL,
	`name` varchar(50) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`color` varchar(7),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(50) NOT NULL,
	`email` varchar(255) NOT NULL,
	`github_id` varchar(100),
	`avatar_url` varchar(500),
	`role` enum('admin','author') NOT NULL DEFAULT 'admin',
	`bio` text,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_github_id_unique` UNIQUE(`github_id`)
);
--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_comments_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_root_id_comments_id_fk` FOREIGN KEY (`root_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD CONSTRAINT `learning_nodes_path_id_learning_paths_id_fk` FOREIGN KEY (`path_id`) REFERENCES `learning_paths`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD CONSTRAINT `learning_nodes_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moment_likes` ADD CONSTRAINT `moment_likes_moment_id_moments_id_fk` FOREIGN KEY (`moment_id`) REFERENCES `moments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_likes` ADD CONSTRAINT `post_likes_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `series_posts` ADD CONSTRAINT `series_posts_series_id_series_id_fk` FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `series_posts` ADD CONSTRAINT `series_posts_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comments_post_id_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE INDEX `comments_parent_id_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_root_id_idx` ON `comments` (`root_id`);--> statement-breakpoint
CREATE INDEX `comments_status_idx` ON `comments` (`status`);--> statement-breakpoint
CREATE INDEX `comments_created_at_idx` ON `comments` (`created_at`);--> statement-breakpoint
CREATE INDEX `learning_nodes_path_id_idx` ON `learning_nodes` (`path_id`);--> statement-breakpoint
CREATE INDEX `learning_nodes_sort_order_idx` ON `learning_nodes` (`sort_order`);--> statement-breakpoint
CREATE INDEX `learning_paths_slug_idx` ON `learning_paths` (`slug`);--> statement-breakpoint
CREATE INDEX `milestones_event_date_idx` ON `milestones` (`event_date`);--> statement-breakpoint
CREATE INDEX `milestones_event_type_idx` ON `milestones` (`event_type`);--> statement-breakpoint
CREATE INDEX `milestones_sort_order_idx` ON `milestones` (`sort_order`);--> statement-breakpoint
CREATE INDEX `moment_likes_moment_id_idx` ON `moment_likes` (`moment_id`);--> statement-breakpoint
CREATE INDEX `moments_published_at_idx` ON `moments` (`published_at`);--> statement-breakpoint
CREATE INDEX `page_views_page_type_idx` ON `page_views` (`page_type`);--> statement-breakpoint
CREATE INDEX `page_views_page_id_idx` ON `page_views` (`page_id`);--> statement-breakpoint
CREATE INDEX `page_views_visited_at_idx` ON `page_views` (`visited_at`);--> statement-breakpoint
CREATE INDEX `post_likes_post_id_idx` ON `post_likes` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_tags_post_id_idx` ON `post_tags` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_tags_tag_id_idx` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `posts_author_id_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_slug_idx` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `projects_is_featured_idx` ON `projects` (`is_featured`);--> statement-breakpoint
CREATE INDEX `projects_sort_order_idx` ON `projects` (`sort_order`);--> statement-breakpoint
CREATE INDEX `series_slug_idx` ON `series` (`slug`);--> statement-breakpoint
CREATE INDEX `series_is_pinned_idx` ON `series` (`is_pinned`);--> statement-breakpoint
CREATE INDEX `series_sort_order_idx` ON `series` (`sort_order`);--> statement-breakpoint
CREATE INDEX `series_posts_series_id_idx` ON `series_posts` (`series_id`);--> statement-breakpoint
CREATE INDEX `series_posts_post_id_idx` ON `series_posts` (`post_id`);--> statement-breakpoint
CREATE INDEX `series_posts_sort_order_idx` ON `series_posts` (`sort_order`);--> statement-breakpoint
CREATE INDEX `tags_slug_idx` ON `tags` (`slug`);


