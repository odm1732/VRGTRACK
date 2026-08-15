CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`referrals` int NOT NULL DEFAULT 200,
	`oneToOnes` int NOT NULL DEFAULT 350,
	`money` decimal(15,2) NOT NULL DEFAULT '5000000',
	`visitors` int NOT NULL DEFAULT 20,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `goals_year_unique` UNIQUE(`year`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`meetingDate` timestamp NOT NULL,
	`attended` boolean NOT NULL DEFAULT true,
	`absenceReason` text,
	`visitorsCount` int NOT NULL DEFAULT 0,
	`referrals` text,
	`oneToOnes` text,
	`moneyReceived` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetExpiry` timestamp;