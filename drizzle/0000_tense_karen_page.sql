CREATE TABLE `lobby_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`secret` text NOT NULL,
	`joined` integer NOT NULL,
	`seen` integer NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`connected` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `lobby_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lobby_member_room` ON `lobby_members` (`room`,`connected`);--> statement-breakpoint
CREATE INDEX `lobby_member_expiry` ON `lobby_members` (`seen`);--> statement-breakpoint
CREATE TABLE `lobby_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`public` integer NOT NULL,
	`protocol` integer NOT NULL,
	`capacity` integer NOT NULL,
	`host` text NOT NULL,
	`term` integer DEFAULT 1 NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`ai` integer DEFAULT 0 NOT NULL,
	`clear_trails` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lobby_room_search` ON `lobby_rooms` (`public`,`protocol`,`created`);--> statement-breakpoint
CREATE TABLE `lobby_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `lobby_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lobby_signal_inbox` ON `lobby_signals` (`recipient`,`id`);--> statement-breakpoint
CREATE INDEX `lobby_signal_expiry` ON `lobby_signals` (`created`);