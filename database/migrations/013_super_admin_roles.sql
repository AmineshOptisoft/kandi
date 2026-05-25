-- Migration 013: Super Admin & Admin Role System
-- Adds role differentiation, per-admin permissions, and activity audit log.

-- 1. Extend the `admin` table
ALTER TABLE `admin`
  ADD COLUMN `fullname`   varchar(150)                         DEFAULT NULL    AFTER `email`,
  ADD COLUMN `role`       ENUM('SUPER_ADMIN','ADMIN')          NOT NULL DEFAULT 'ADMIN' AFTER `fullname`,
  ADD COLUMN `status`     ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE' AFTER `role`,
  ADD COLUMN `created_by` int(11)                              DEFAULT NULL    AFTER `status`,
  ADD COLUMN `created_at` timestamp                            NULL DEFAULT current_timestamp() AFTER `created_by`,
  ADD COLUMN `updated_at` timestamp                            NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() AFTER `created_at`;

-- Promote the first (lowest-id) admin to SUPER_ADMIN automatically
UPDATE `admin` SET `role` = 'SUPER_ADMIN', `status` = 'ACTIVE' ORDER BY `admin_id` ASC LIMIT 1;

-- 2. Per-admin permission flags
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `admin_id`               int(11)     NOT NULL,
  `view_dashboard`         tinyint(1)  NOT NULL DEFAULT 0,
  `manage_agents`          tinyint(1)  NOT NULL DEFAULT 0,
  `manage_companies`       tinyint(1)  NOT NULL DEFAULT 0,
  `manage_payins`          tinyint(1)  NOT NULL DEFAULT 0,
  `manage_payouts`         tinyint(1)  NOT NULL DEFAULT 0,
  `manage_settlements`     tinyint(1)  NOT NULL DEFAULT 0,
  `manage_disputes`        tinyint(1)  NOT NULL DEFAULT 0,
  `manage_ledger`          tinyint(1)  NOT NULL DEFAULT 0,
  `manage_reports`         tinyint(1)  NOT NULL DEFAULT 0,
  `manage_transactions`    tinyint(1)  NOT NULL DEFAULT 0,
  `manage_interledger`     tinyint(1)  NOT NULL DEFAULT 0,
  `manage_security_deposit` tinyint(1) NOT NULL DEFAULT 0,
  `created_at`             timestamp   NULL DEFAULT current_timestamp(),
  `updated_at`             timestamp   NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`admin_id`),
  CONSTRAINT `fk_admin_perms_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Activity audit log
CREATE TABLE IF NOT EXISTS `admin_activity_log` (
  `id`          bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id`    int(11)     NOT NULL,
  `action`      varchar(100) NOT NULL COMMENT 'e.g. CREATE_ADMIN, UPDATE_PERMISSIONS, LOGIN, etc.',
  `target_type` varchar(50)  DEFAULT NULL COMMENT 'entity type: admin, agent, company, transaction …',
  `target_id`   varchar(50)  DEFAULT NULL,
  `details`     text         DEFAULT NULL COMMENT 'JSON blob of relevant before/after data',
  `ip_address`  varchar(45)  DEFAULT NULL,
  `created_at`  timestamp    NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_action`   (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_activity_log_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
