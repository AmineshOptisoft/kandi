-- Migration 014: Granular Action-Based Permissions
-- Replaces/extends course module-level permissions with highly granular action-based permissions.

USE `tepay`;

ALTER TABLE `admin_permissions`
  -- Drop old module level permissions
  DROP COLUMN `view_dashboard`,
  DROP COLUMN `manage_agents`,
  DROP COLUMN `manage_companies`,
  DROP COLUMN `manage_payins`,
  DROP COLUMN `manage_payouts`,
  DROP COLUMN `manage_settlements`,
  DROP COLUMN `manage_disputes`,
  DROP COLUMN `manage_ledger`,
  DROP COLUMN `manage_reports`,
  DROP COLUMN `manage_transactions`,
  DROP COLUMN `manage_interledger`,
  DROP COLUMN `manage_security_deposit`;

ALTER TABLE `admin_permissions`
  -- Add new granular permissions
  ADD COLUMN `view_dashboard`             tinyint(1) NOT NULL DEFAULT 0,

  -- Agents module
  ADD COLUMN `view_agents`                 tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_agents`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `edit_agents`                 tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `delete_agents`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `activate_agents`             tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `deactivate_agents`           tinyint(1) NOT NULL DEFAULT 0,

  -- Companies module
  ADD COLUMN `view_companies`              tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_companies`            tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `edit_companies`              tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `delete_companies`            tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `activate_companies`          tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `deactivate_companies`        tinyint(1) NOT NULL DEFAULT 0,

  -- Payins module
  ADD COLUMN `view_payins`                 tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `approve_payins`              tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `reject_payins`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `assign_payins`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `update_status_payins`        tinyint(1) NOT NULL DEFAULT 0,

  -- Payouts module
  ADD COLUMN `view_payouts`                tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `approve_payouts`             tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `reject_payouts`              tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `assign_payouts`              tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `update_status_payouts`       tinyint(1) NOT NULL DEFAULT 0,

  -- Transactions module
  ADD COLUMN `view_transactions`           tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `edit_transactions`           tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `delete_transactions`         tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `export_transactions`         tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `update_status_transactions`  tinyint(1) NOT NULL DEFAULT 0,

  -- Reports module
  ADD COLUMN `view_reports`                tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_reports`              tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `export_reports`              tinyint(1) NOT NULL DEFAULT 0,

  -- Settlements module
  ADD COLUMN `view_settlements`            tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_settlements`          tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `edit_settlements`            tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `approve_settlements`          tinyint(1) NOT NULL DEFAULT 0,

  -- Disputes module
  ADD COLUMN `view_disputes`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_disputes`             tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `edit_disputes`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `resolve_disputes`            tinyint(1) NOT NULL DEFAULT 0,

  -- Ledger module
  ADD COLUMN `view_ledger`                 tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `export_ledger`               tinyint(1) NOT NULL DEFAULT 0,

  -- Security Deposits module
  ADD COLUMN `view_security_deposits`     tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_security_deposits`   tinyint(1) NOT NULL DEFAULT 0,

  -- Admins module
  ADD COLUMN `view_admins`                 tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `create_admins`               tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `edit_admins`                 tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `delete_admins`               tinyint(1) NOT NULL DEFAULT 0;
