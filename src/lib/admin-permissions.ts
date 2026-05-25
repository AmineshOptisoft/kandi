// /**
//  * Admin permission definitions for the TE-Pay Super Admin / Admin role system.
//  * Super Admins always have all permissions implicitly.
//  * Regular Admins only have the permissions explicitly granted by the Super Admin.
//  */

// export const ALL_PERMISSIONS = [
//   "view_dashboard",
//   "add_security_deposit",
//   "commission_settlement",
//   "manually_deposit",
//   "add_interledger",
//   "add_settlement",
//   "manual_payin",
//   "export_data",
//   // Agents
//   "view_agents",
//   "create_agents",
//   "edit_agents",
//   "delete_agents",
//   "activate_agents",
//   "deactivate_agents",

//   //Payment accounts
//   "view_payment_accounts",
//   "add_payment_accounts",
//   "edit_payment_accounts",
//   "delete_payment_accounts",
//   "enable_payin",
//   "enable_payout",
//   "disable_payin",
//   "disable_payout",

//   // Companies
//   "view_companies",
//   "create_companies",
//   "edit_companies",
//   "delete_companies",
//   "activate_companies",
//   "deactivate_companies",

//   // Payins
//   "view_payins",
//   "approve_payins",
//   "reject_payins",
//   "assign_payins",
//   "update_status_payins",

//   // Payouts
//   "view_payouts",
//   "approve_payouts",
//   "reject_payouts",
//   "assign_payouts",
//   "update_status_payouts",

//   // Transactions
//   "view_transactions",
//   "edit_transactions",
//   "delete_transactions",
//   "export_transactions",
//   "update_status_transactions",

//   // Reports
//   "view_reports",
//   "create_reports",
//   "export_reports",

//   // Settlements
//   "view_settlements",
//   "create_settlements",
//   "edit_settlements",
//   "approve_settlements",

//   // Disputes
//   "view_disputes",
//   "create_disputes",
//   "edit_disputes",
//   "resolve_disputes",

//   // Ledger
//   "view_ledger",
//   "export_ledger",

//   // Security Deposits
//   "view_security_deposits",
//   "create_security_deposits",

//   // Admins
//   "view_admins",
//   "create_admins",
//   "edit_admins",
//   "delete_admins",

// //Settlement 
// "add_Settlement",
// "add_company_settlement",

// //Security Deposit Logs
// "add_security_deposit_logs"

// ] as const;

// export type Permission = (typeof ALL_PERMISSIONS)[number];

// export const PERMISSION_GROUPS: Record<string, Permission[]> = {
//   Dashboard: ["view_dashboard"],
//   Agents: ["view_agents", "create_agents", "edit_agents", "delete_agents", "activate_agents", "deactivate_agents", ], 
//    Payment_Accounts: [
//     "view_payment_accounts",
//     "add_payment_accounts",
//     "edit_payment_accounts",
//     "delete_payment_accounts",
//     "enable_payin",
//     "enable_payout",
//     "disable_payin",
//     "disable_payout",
//   ],
//   Companies: ["view_companies", "create_companies", "edit_companies", "delete_companies", "activate_companies", "deactivate_companies"],
//   Payins: ["view_payins", "approve_payins", "reject_payins", "assign_payins", "update_status_payins"],
//   Payouts: ["view_payouts", "approve_payouts", "reject_payouts", "assign_payouts", "update_status_payouts"],
//   Transactions: ["view_transactions", "edit_transactions", "delete_transactions", "export_transactions", "update_status_transactions"],
//   Reports: ["view_reports", "create_reports", "export_reports"],
//     Settlements: [
//     "view_settlements",
//     "create_settlements",
//     "edit_settlements",
//     "approve_settlements",
//     "add_settlement",
//     "add_Settlement",
//     "add_company_settlement",
//     "commission_settlement",
//   ],
//   Disputes: ["view_disputes", "create_disputes", "edit_disputes", "resolve_disputes"],
//   Ledger: ["view_ledger", "export_ledger"],
//   Security_Deposits: ["view_security_deposits", "create_security_deposits"],
//   Admins: ["view_admins", "create_admins", "edit_admins", "delete_admins"],
// };

// export const PERMISSION_LABELS: Record<Permission, string> = {
//   view_dashboard: "View Dashboard Stats",
//   add_security_deposit: "Add Security Deposit",
//   commission_settlement: "Commission Settlement",
//   manually_deposit: "Manually Deposit",
//   add_interledger: "Add Interledger",
//   add_settlement: "Add Settlement",
//   export_data: "Export Data",
//   manual_payin: "Manual Payin",
//   // Agents
//   view_agents: "View Agents List",
//   create_agents: "Create New Agents",
//   edit_agents: "Edit Agent Details",
//   delete_agents: "Delete Agents",
//   activate_agents: "Activate Agents",
//   deactivate_agents: "Deactivate Agents",
//   view_payment_accounts: "View Payment Accounts List",
//   add_payment_accounts: "Add Payment Accounts",
//   edit_payment_accounts: "Edit Payment Accounts",
//   delete_payment_accounts: "Delete Payment Accounts",
//   enable_payin: "Enable Payin",
//   enable_payout: "Enable Payout",
//   disable_payin: "Disable Payin",
//   disable_payout: "Disable Payout",

//   // Companies
//   view_companies: "View Companies List",
//   create_companies: "Create New Companies",
//   edit_companies: "Edit Company Settings",
//   delete_companies: "Delete Companies",
//   activate_companies: "Activate Companies",
//   deactivate_companies: "Deactivate Companies",

//   // Payins
//   view_payins: "View PayIn Transactions",
//   approve_payins: "Approve PayIn Status",
//   reject_payins: "Reject PayIn Status",
//   assign_payins: "Assign/Reassign PayIns",
//   update_status_payins: "Force Update PayIn Status",

//   // Payouts
//   view_payouts: "View PayOut Transactions",
//   approve_payouts: "Approve PayOut Status",
//   reject_payouts: "Reject PayOut Status",
//   assign_payouts: "Assign/Reassign PayOuts",
//   update_status_payouts: "Force Update PayOut Status",

//   // Transactions
//   view_transactions: "View All System Transactions",
//   edit_transactions: "Edit Transaction Details",
//   delete_transactions: "Delete Transactions",
//   export_transactions: "Export Transactions (Excel/CSV)",
//   update_status_transactions: "Batch Update Transaction Status",

//   // Reports
//   view_reports: "View Generated Reports",
//   create_reports: "Generate New Reports",
//   export_reports: "Download Report Files",

//   // Settlements
//   view_settlements: "View Settlements Log",
//   create_settlements: "Initiate New Settlements",
//   edit_settlements: "Modify Settlement Parameters",
//   approve_settlements: "Approve Processing Settlements",

//   // Disputes
//   view_disputes: "View Open Disputes",
//   create_disputes: "Log New Disputes",
//   edit_disputes: "Edit Dispute Remarks",
//   resolve_disputes: "Resolve or Close Disputes",

//   // Ledger
//   view_ledger: "View Running Ledger Logs",
//   export_ledger: "Export Ledger Activity",

//   // Security Deposits
//   view_security_deposits: "View Security Deposit Snapshots",
//   create_security_deposits: "Adjust (Debit/Credit) Security Deposits",

//   // Admins
//   view_admins: "View System Administrators",
//   create_admins: "Create Secondary Admins",
//   edit_admins: "Edit Admin Access details",
//   delete_admins: "Remove Secondary Admins",


// };

// export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
//   view_dashboard: "Grants access to main dashboard page and global stats counters",
//   add_security_deposit: "Add Security Deposit",
//   commission_settlement: "Commission Settlement",
//   manually_deposit: "Manually Deposit",
//   add_interledger: "Add Interledger",
//   add_settlement: "Add Settlement",
//   export_data: "Export Data",
//   manual_payin: "Manual Payin",
//   // Agents
//   view_agents: "Browse list of agents, details, and operation metrics",
//   create_agents: "Register new agents or vendor accounts",
//   edit_agents: "Edit basic profile details and bank/gateway details of agents",
//   delete_agents: "Permanently delete agent accounts from the system",
//   activate_agents: "Allow agent to accept transactions",
//   deactivate_agents: "Temporarily pause transaction processing for agents",
//   view_payment_accounts: "View Payment Accounts List",
//   add_payment_accounts: "Add Payment Accounts",
//   edit_payment_accounts: "Edit Payment Accounts",
//   delete_payment_accounts: "Delete Payment Accounts",
//   enable_payin: "Enable Payin",
//   enable_payout: "Enable Payout",
//   disable_payin: "Disable Payin",
//   disable_payout: "Disable Payout",

//   // Companies
//   view_companies: "Browse active/inactive client companies lists",
//   create_companies: "Register new client merchants and configure basic API structures",
//   edit_companies: "Edit profile settings, logos, and rate percentages",
//   delete_companies: "Permanently delete client merchant accounts",
//   activate_companies: "Allow company integration to go live",
//   deactivate_companies: "Block company requests and API integration access",

//   // Payins
//   view_payins: "Access the PayIn list page and view detailed metadata records",
//   approve_payins: "Manually verify bank/UPI deposits and approve status",
//   reject_payins: "Flag failed or mock deposits as rejected",
//   assign_payins: "Manually assign or reassign incoming payments to specific gateways",
//   update_status_payins: "Override status directly bypassing workflow rules",

//   // Payouts
//   view_payouts: "Access the PayOut queue and check status",
//   approve_payouts: "Approve funds processing and confirm bank transfers",
//   reject_payouts: "Flag incomplete payout requests as failed/refunded",
//   assign_payouts: "Manually allocate outgoing payments to specific gateway lines",
//   update_status_payouts: "Directly manipulate payout statuses to adjust pipeline errors",

//   // Transactions
//   view_transactions: "View full system transaction table with extensive searching",
//   edit_transactions: "Manually edit transaction records, UTRs, and reference values",
//   delete_transactions: "Remove transaction items from tracking list",
//   export_transactions: "Export custom selected transactions list to CSV/Excel",
//   update_status_transactions: "Batch select transactions to update state",

//   // Reports
//   view_reports: "Look at the list of saved system-wide performance reports",
//   create_reports: "Generate customized query summaries for distinct dates",
//   export_reports: "Export generated figures to offline analytical documents",

//   // Settlements
//   view_settlements: "Check status of previous settlement distributions",
//   create_settlements: "Prepare a new batch of ledger payouts for distribution",
//   edit_settlements: "Adjust individual rates or deduction structures before payout",
//   approve_settlements: "Finalize settlement batches for direct routing",

//   // Disputes
//   view_disputes: "Monitor transaction complaints and UTR matching requests",
//   create_disputes: "File complaints for mismatching references",
//   edit_disputes: "Add remarks, proofs, and screenshots to dispute entries",
//   resolve_disputes: "Authorize resolution action (e.g. approve or refund)",

//   // Ledger
//   view_ledger: "Look at running ledger entries and balance statements",
//   export_ledger: "Download CSV statement of general balances",

//   // Security Deposits
//   view_security_deposits: "Track balance histories of security deposits per agent",
//   create_security_deposits: "Process manual credit/debit adjustments on security deposit balances",

//   // Admins
//   view_admins: "Browse list of system secondary administrators",
//   create_admins: "Create secondary admins and provision access roles",
//   edit_admins: "Edit login details, status, or passwords of secondary admins",
//   delete_admins: "Decommission and remove secondary administrative profiles",


//   //Settlement 
//   add_company_settlement: "Add Company Settlement",

//   //Security Deposit Logs
//   add_security_deposit_logs: "Add Security Deposit Logs",
// };

// export type AdminPermissions = Record<Permission, boolean>;

// export function allPermissionsGranted(): AdminPermissions {
//   return Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true])) as AdminPermissions;
// }

// export function noPermissionsGranted(): AdminPermissions {
//   return Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false])) as AdminPermissions;
// }

// export function isValidPermission(key: string): key is Permission {
//   return (ALL_PERMISSIONS as readonly string[]).includes(key);
// }


/**
 * Admin permission definitions for the TE-Pay Super Admin / Admin role system.
 * Super Admins always have all permissions implicitly.
 * Regular Admins only have the permissions explicitly granted by the Super Admin.
 */

export const ALL_PERMISSIONS = [
  // Dashboard
  "view_dashboard",

  // General Operations
  "add_security_deposit",
  "commission_settlement",
  "manually_deposit",
  "add_interledger",
  "add_settlement",
  "manual_payin",
  "export_data",

  // Agents
  "view_agents",
  "create_agents",
  "edit_agents",
  "delete_agents",
  "activate_agents",
  "deactivate_agents",

  // Payment Accounts
  "view_payment_accounts",
  "add_payment_accounts",
  "edit_payment_accounts",
  "delete_payment_accounts",
  "enable_payin",
  "enable_payout",
  "disable_payin",
  "disable_payout",

  // Companies
  "view_companies",
  "create_companies",
  "edit_companies",
  "delete_companies",
  "activate_companies",
  "deactivate_companies",

  // Payins
  "view_payins",
  "approve_payins",
  "reject_payins",
  "assign_payins",
  "update_status_payins",

  // Payouts
  "view_payouts",
  "approve_payouts",
  "reject_payouts",
  "assign_payouts",
  "update_status_payouts",

  // Transactions
  "view_transactions",
  "edit_transactions",
  "delete_transactions",
  "export_transactions",
  "update_status_transactions",

  // Reports
  "view_reports",
  "create_reports",
  "export_reports",

  // Settlements
  "view_settlements",
  "create_settlements",
  "edit_settlements",
  "approve_settlements",
  "add_company_settlement",

  // Disputes
  "view_disputes",
  "create_disputes",
  "edit_disputes",
  "resolve_disputes",

  // Ledger
  "view_ledger",
  "export_ledger",

  // Security Deposits
  "view_security_deposits",
  "create_security_deposits",
  "add_security_deposit_logs",

  // Admins
  "view_admins",
  "create_admins",
  "edit_admins",
  "delete_admins",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  Dashboard: ["view_dashboard",],

  General: [
    "add_security_deposit",
    "commission_settlement",
    "manually_deposit",
    "add_interledger",
    "add_settlement",
    "manual_payin",
    "export_data",
  ],

  Agents: [
    "view_agents",
    "create_agents",
    "edit_agents",
    "delete_agents",
    "activate_agents",
    "deactivate_agents",
  ],

  Payment_Accounts: [
    "view_payment_accounts",
    "add_payment_accounts",
    "edit_payment_accounts",
    "delete_payment_accounts",
    "enable_payin",
    "enable_payout",
    "disable_payin",
    "disable_payout",
  ],

  Companies: [
    "view_companies",
    "create_companies",
    "edit_companies",
    "delete_companies",
    "activate_companies",
    "deactivate_companies",
  ],

  Payins: [
    "view_payins",
    "approve_payins",
    "reject_payins",
    "assign_payins",
    "update_status_payins",
  ],

  Payouts: [
    "view_payouts",
    "approve_payouts",
    "reject_payouts",
    "assign_payouts",
    "update_status_payouts",
  ],

  Transactions: [
    "view_transactions",
    "edit_transactions",
    "delete_transactions",
    "export_transactions",
    "update_status_transactions",
  ],

  Reports: [
    "view_reports",
    "create_reports",
    "export_reports",
  ],

  Settlements: [
    "view_settlements",
    "create_settlements",
    "edit_settlements",
    "approve_settlements",
    "add_company_settlement",
    "add_settlement",
    "commission_settlement",
  ],

  Disputes: [
    "view_disputes",
    "create_disputes",
    "edit_disputes",
    "resolve_disputes",
  ],

  Ledger: [
    "view_ledger",
    "export_ledger",
    "add_interledger",
  ],

  Security_Deposits: [
    "view_security_deposits",
    "create_security_deposits",
    "add_security_deposit",
    "add_security_deposit_logs",
  ],

  Admins: [
    "view_admins",
    "create_admins",
    "edit_admins",
    "delete_admins",
  ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  // Dashboard
  view_dashboard: "View Dashboard Stats",

  // General
  add_security_deposit: "Add Security Deposit",
  commission_settlement: "Commission Settlement",
  manually_deposit: "Manually Deposit",
  add_interledger: "Add Interledger",
  add_settlement: "Add Settlement",
  manual_payin: "Manual Payin",
  export_data: "Export Data",

  // Agents
  view_agents: "View Agents List",
  create_agents: "Create New Agents",
  edit_agents: "Edit Agent Details",
  delete_agents: "Delete Agents",
  activate_agents: "Activate Agents",
  deactivate_agents: "Deactivate Agents",

  // Payment Accounts
  view_payment_accounts: "View Payment Accounts",
  add_payment_accounts: "Add Payment Accounts",
  edit_payment_accounts: "Edit Payment Accounts",
  delete_payment_accounts: "Delete Payment Accounts",
  enable_payin: "Enable Payin",
  enable_payout: "Enable Payout",
  disable_payin: "Disable Payin",
  disable_payout: "Disable Payout",

  // Companies
  view_companies: "View Companies",
  create_companies: "Create Companies",
  edit_companies: "Edit Companies",
  delete_companies: "Delete Companies",
  activate_companies: "Activate Companies",
  deactivate_companies: "Deactivate Companies",

  // Payins
  view_payins: "View Payins",
  approve_payins: "Approve Payins",
  reject_payins: "Reject Payins",
  assign_payins: "Assign Payins",
  update_status_payins: "Update Payin Status",

  // Payouts
  view_payouts: "View Payouts",
  approve_payouts: "Approve Payouts",
  reject_payouts: "Reject Payouts",
  assign_payouts: "Assign Payouts",
  update_status_payouts: "Update Payout Status",

  // Transactions
  view_transactions: "View Transactions",
  edit_transactions: "Edit Transactions",
  delete_transactions: "Delete Transactions",
  export_transactions: "Export Transactions",
  update_status_transactions: "Update Transaction Status",

  // Reports
  view_reports: "View Reports",
  create_reports: "Create Reports",
  export_reports: "Export Reports",

  // Settlements
  view_settlements: "View Settlements",
  create_settlements: "Create Settlements",
  edit_settlements: "Edit Settlements",
  approve_settlements: "Approve Settlements",
  add_company_settlement: "Add Company Settlement",

  // Disputes
  view_disputes: "View Disputes",
  create_disputes: "Create Disputes",
  edit_disputes: "Edit Disputes",
  resolve_disputes: "Resolve Disputes",

  // Ledger
  view_ledger: "View Ledger",
  export_ledger: "Export Ledger",

  // Security Deposits
  view_security_deposits: "View Security Deposits",
  create_security_deposits: "Create Security Deposits",
  add_security_deposit_logs: "Add Security Deposit Logs",

  // Admins
  view_admins: "View Admins",
  create_admins: "Create Admins",
  edit_admins: "Edit Admins",
  delete_admins: "Delete Admins",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // Dashboard
  view_dashboard: "Access dashboard statistics and analytics",

  // General
  add_security_deposit: "Add security deposits manually",
  commission_settlement: "Handle commission settlement operations",
  manually_deposit: "Perform manual deposits",
  add_interledger: "Create interledger entries",
  add_settlement: "Add settlement records",
  manual_payin: "Create manual payin requests",
  export_data: "Export system data",

  // Agents
  view_agents: "View agents and related information",
  create_agents: "Create new agents",
  edit_agents: "Modify existing agents",
  delete_agents: "Delete agents from system",
  activate_agents: "Activate agents",
  deactivate_agents: "Deactivate agents",

  // Payment Accounts
  view_payment_accounts: "View payment accounts",
  add_payment_accounts: "Add payment accounts",
  edit_payment_accounts: "Edit payment accounts",
  delete_payment_accounts: "Delete payment accounts",
  enable_payin: "Enable payin services",
  enable_payout: "Enable payout services",
  disable_payin: "Disable payin services",
  disable_payout: "Disable payout services",

  // Companies
  view_companies: "View companies",
  create_companies: "Create companies",
  edit_companies: "Edit companies",
  delete_companies: "Delete companies",
  activate_companies: "Activate companies",
  deactivate_companies: "Deactivate companies",

  // Payins
  view_payins: "View payin transactions",
  approve_payins: "Approve payins",
  reject_payins: "Reject payins",
  assign_payins: "Assign payins",
  update_status_payins: "Update payin statuses",

  // Payouts
  view_payouts: "View payout transactions",
  approve_payouts: "Approve payouts",
  reject_payouts: "Reject payouts",
  assign_payouts: "Assign payouts",
  update_status_payouts: "Update payout statuses",

  // Transactions
  view_transactions: "View all transactions",
  edit_transactions: "Edit transactions",
  delete_transactions: "Delete transactions",
  export_transactions: "Export transactions",
  update_status_transactions: "Update transaction statuses",

  // Reports
  view_reports: "View reports",
  create_reports: "Generate reports",
  export_reports: "Export reports",

  // Settlements
  view_settlements: "View settlements",
  create_settlements: "Create settlements",
  edit_settlements: "Edit settlements",
  approve_settlements: "Approve settlements",
  add_company_settlement: "Add company settlement entries",

  // Disputes
  view_disputes: "View disputes",
  create_disputes: "Create disputes",
  edit_disputes: "Edit disputes",
  resolve_disputes: "Resolve disputes",

  // Ledger
  view_ledger: "View ledger entries",
  export_ledger: "Export ledger records",

  // Security Deposits
  view_security_deposits: "View security deposits",
  create_security_deposits: "Create security deposits",
  add_security_deposit_logs: "Add security deposit logs",

  // Admins
  view_admins: "View admins",
  create_admins: "Create admins",
  edit_admins: "Edit admins",
  delete_admins: "Delete admins",
};

export type AdminPermissions = Record<Permission, boolean>;

export function allPermissionsGranted(): AdminPermissions {
  return Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => [permission, true])
  ) as AdminPermissions;
}

export function noPermissionsGranted(): AdminPermissions {
  return Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => [permission, false])
  ) as AdminPermissions;
}

export function isValidPermission(key: string): key is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(key);
}