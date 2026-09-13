CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`full_name` text,
	`holiday_region` text DEFAULT 'AU-VIC' NOT NULL,
	`standard_start` text DEFAULT '09:00' NOT NULL,
	`standard_end` text DEFAULT '17:06' NOT NULL,
	`standard_break_minutes` integer DEFAULT 30 NOT NULL,
	`include_weekends` integer DEFAULT false NOT NULL,
	`prefilled_through` text
);
