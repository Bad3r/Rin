-- Seed default About page when an admin user exists and no About alias is present.
INSERT INTO `feeds` (`alias`, `title`, `summary`, `content`, `listed`, `draft`, `uid`, `top`, `created_at`, `updated_at`)
SELECT
  'about',
  'About',
  'Welcome to Rin. Update this page from the Writing panel.',
  'Welcome to Rin. Update this page from the Writing panel.',
  1,
  0,
  `users`.`id`,
  0,
  unixepoch(),
  unixepoch()
FROM `users`
WHERE `users`.`permission` = 1
  AND NOT EXISTS (SELECT 1 FROM `feeds` WHERE `alias` = 'about')
LIMIT 1;
--> statement-breakpoint
UPDATE `info` SET `value` = '10' WHERE `key` = 'migration_version';
