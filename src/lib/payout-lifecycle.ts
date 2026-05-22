const ASSIGNABLE = new Set(["NOT_ASSIGNED", "RE_ASSIGNED", "PENDING", "EXPIRED"]);

const COMPANY_EDITABLE = new Set(["NOT_ASSIGNED", "PENDING"]);

/** Company can modify/delete payout only while still pending/unassigned. */
export function canCompanyEditOrDelete(status: string): boolean {
  return COMPANY_EDITABLE.has(status);
}

/** Admin can assign when payout is waiting or re-assigned. */
export function canAdminAssign(status: string): boolean {
  return ASSIGNABLE.has(status);
}

/** Mapping of allowed source statuses for each target status when an agent performs a transition. */
// const AGENT_ALLOWED_FROM: Record<string, Set<string>> = {
//   PAID: new Set(["PENDING", "RE_ASSIGNED"]),
//   APPROVED_BY_AGENT: new Set(["PENDING", "PAID", "EXPIRED", "PENDING_APPROVAL"]),
//   EXPIRED_APPROVED_BY_AGENT: new Set(["EXPIRED", "PENDING_APPROVAL"]),
//   REJECTED: new Set(["PENDING", "PAID", "RE_ASSIGNED", "EXPIRED", "PENDING_APPROVAL"]),
//   REVOKED: new Set(["PENDING", "PAID", "RE_ASSIGNED", "EXPIRED", "PENDING_APPROVAL"]),
//   RE_ASSIGNED: new Set(["PENDING", "PAID"]),
//   PENDING_APPROVAL: new Set(["PENDING"]),
// };

const AGENT_ALLOWED_FROM: Record<string, Set<string>> = {
  APPROVED_BY_AGENT: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
  EXPIRED_APPROVED_BY_AGENT: new Set(["EXPIRED"]),
  REJECTED: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
  REVOKED: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
  EXPIRED: new Set(["PAID", "PENDING", "RE_ASSIGNED"]),
  RE_ASSIGNED: new Set(["PENDING", "PAID", "EXPIRED"]),
  // APPROVED_BY_ADMIN: new Set(["PENDING", "PAID", "RE_ASSIGNED", "EXPIRED"]),
};
const ADMIN_ALLOWED_FROM: Record<string, Set<string>> = {
  APPROVED_BY_ADMIN: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED", "PENDING_APPROVAL"]),
  EXPIRED_APPROVED_BY_ADMIN: new Set(["EXPIRED"]),
  REJECTED: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
  EXPIRED: new Set(["PAID", "PENDING", "RE_ASSIGNED"]),
  RE_ASSIGNED: new Set(["PENDING", "PAID", "EXPIRED"]),
};

/** Agent transition guard for payout statuses. */
export function canAgentTransition(from: string, to: string): boolean {
  const set = AGENT_ALLOWED_FROM[to];
  let setadmin = ADMIN_ALLOWED_FROM[to];
  if (!set && !setadmin) {
    // Allow transition from PENDING_APPROVAL to APPROVED_BY_AGENT as a special case
    if (to === "APPROVED_BY_AGENT" && from === "PENDING_APPROVAL") return true;
    return false;
  }
  return set.has(from) || setadmin.has(from);
}
