-- Migration 012: Add APPROVED_BY_AGENT to transactions.status ENUM
-- The lifecycle code uses APPROVED_BY_AGENT but it was missing from the ENUM,
-- causing MySQL "Data truncated for column 'status'" on any agent approval.

ALTER TABLE `transactions`
  MODIFY COLUMN `status` enum(
    'PENDING',
    'PAID',
    'APPROVED',
    'APPROVED_BY_ADMIN',
    'APPROVED_BY_AGENT',
    'REJECTED',
    'EXPIRED',
    'EXPIRED_APPROVED_BY_ADMIN',
    'EXPIRED_APPROVED_BY_AGENT',
    'NOT_ASSIGNED',
    'RE_ASSIGNED',
    'REVOKED'
  ) NOT NULL DEFAULT 'PENDING';
