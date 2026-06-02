CREATE TABLE `person_project_order` (
	`person_id` text NOT NULL,
	`project_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`person_id`, `project_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `people` ADD `sort_order` integer DEFAULT 0 NOT NULL;