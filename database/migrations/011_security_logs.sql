-- Security logs table for agents.

CREATE TABLE IF NOT EXISTS `agent_security_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `agent_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `remark` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL COMMENT 'admin.admin_id',
  `transaction_type` enum('DEBIT','CREDIT') NOT NULL DEFAULT 'CREDIT',
  `previous_balance_snapshot` decimal(15,2) NOT NULL DEFAULT 0.00,
  `running_balance_snapshot` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_agent_security_logs_agent` (`agent_id`),
  KEY `idx_agent_security_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
