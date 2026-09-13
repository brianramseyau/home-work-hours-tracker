CREATE TABLE `days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`office_id` integer,
	`notes` text,
	`source` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `days_date_unique` ON `days` (`date`);--> statement-breakpoint
CREATE TABLE `financial_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_year` integer NOT NULL,
	`rate_cents_per_hour` integer NOT NULL,
	`rate_note` text,
	`finalised_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_years_start_year_unique` ON `financial_years` (`start_year`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`source` text NOT NULL,
	`repeats_yearly` integer DEFAULT false NOT NULL,
	`disabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `holidays_region_date_idx` ON `holidays` (`region`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_date_region_name_unique` ON `holidays` (`date`,`region`,`name`);--> statement-breakpoint
CREATE TABLE `home_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_id` integer NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`break_minutes` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `home_blocks_day_id_position_idx` ON `home_blocks` (`day_id`,`position`);--> statement-breakpoint
CREATE TABLE `offices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offices_name_unique` ON `offices` (`name`);--> statement-breakpoint
CREATE TABLE `schedule_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer NOT NULL,
	`week_index` integer NOT NULL,
	`weekday` integer NOT NULL,
	`mode` text NOT NULL,
	`office_id` integer,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_days_schedule_id_week_index_weekday_unique` ON `schedule_days` (`schedule_id`,`week_index`,`weekday`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`effective_from` text NOT NULL,
	`cycle_weeks` integer NOT NULL,
	`anchor_monday` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedules_effective_from_unique` ON `schedules` (`effective_from`);