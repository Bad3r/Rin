-- Ensure only one About alias row can exist.
CREATE UNIQUE INDEX IF NOT EXISTS `feeds_alias_about_unique` ON `feeds` (`alias`) WHERE `alias` = 'about';
--> statement-breakpoint
UPDATE `info` SET `value` = '11' WHERE `key` = 'migration_version';
