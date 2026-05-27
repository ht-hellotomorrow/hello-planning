CREATE TABLE `allocation_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`project_id` text NOT NULL,
	`start_week` text NOT NULL,
	`end_week` text NOT NULL,
	`days_per_week` real NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alloc_person_idx` ON `allocation_segments` (`person_id`,`start_week`);--> statement-breakpoint
CREATE INDEX `alloc_project_idx` ON `allocation_segments` (`project_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`propic_url` text,
	`capacity_days_per_week` real DEFAULT 5 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`airtable_record_id` text,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`status` text,
	`visibility` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_airtable_record_id_unique` ON `projects` (`airtable_record_id`);--> statement-breakpoint
CREATE INDEX `projects_visibility_idx` ON `projects` (`visibility`);