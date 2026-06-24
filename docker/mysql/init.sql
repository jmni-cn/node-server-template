-- ============================================================
-- MySQL init script (runs once on first container start via
-- /docker-entrypoint-initdb.d). Creates the application database
-- with utf8mb4 and a non-root application user with scoped grants.
--
-- The official mysql image already creates MYSQL_DATABASE / MYSQL_USER
-- from env; this script makes the database explicit, sets the charset,
-- and guarantees the app user exists with the right privileges
-- regardless of which env vars were provided.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `app_template`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Non-root application user (least privilege: no GRANT, no admin).
CREATE USER IF NOT EXISTS 'app'@'%' IDENTIFIED BY 'app';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `app_template`.* TO 'app'@'%';

FLUSH PRIVILEGES;
