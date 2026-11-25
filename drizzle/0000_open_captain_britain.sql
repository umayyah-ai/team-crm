CREATE TABLE `access_levels` (
	`org_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`level` text NOT NULL,
	PRIMARY KEY(`viewer_id`, `owner_id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`company_id` text,
	`emails` text DEFAULT '' NOT NULL,
	`phones` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`background` text DEFAULT '' NOT NULL,
	`assigned_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contacts_org_idx` ON `contacts` (`org_id`,`kind`);--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`contact_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`contact_id`, `field_id`)
);
--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`options` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_attendees` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `event_contacts` (
	`event_id` text NOT NULL,
	`contact_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `contact_id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_org_idx` ON `events` (`org_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`author_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `files_contact_idx` ON `files` (`contact_id`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `contact_id`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`edited_at` text
);
--> statement-breakpoint
CREATE INDEX `notes_contact_idx` ON `notes` (`contact_id`);--> statement-breakpoint
CREATE TABLE `pipeline_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`options` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pipeline_item_values` (
	`item_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`item_id`, `field_id`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_items` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`status_id` text NOT NULL,
	`value` real,
	`assigned_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_pipeline_idx` ON `pipeline_items` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `items_contact_idx` ON `pipeline_items` (`contact_id`);--> statement-breakpoint
CREATE TABLE `pipeline_statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `status_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`from_status_id` text,
	`to_status_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `changes_item_idx` ON `status_changes` (`item_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`due_date` text NOT NULL,
	`contact_id` text,
	`pipeline_item_id` text,
	`assigned_user_id` text NOT NULL,
	`created_by` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assigned_user_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_contact_idx` ON `tasks` (`contact_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`agenda_enabled` integer DEFAULT false NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`agenda_sent_on` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
