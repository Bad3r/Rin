-- Add top column to feeds table for pinning/ordering support
ALTER TABLE `feeds` ADD COLUMN `top` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '9' WHERE `key` = 'migration_version';
