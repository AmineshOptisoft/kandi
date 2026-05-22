"use client";

import { IoIosWarning } from "react-icons/io";
import { PiContactlessPaymentFill } from "react-icons/pi";
import {
  HiArrowsRightLeft,
  HiBell,
  HiBuildingOffice2,
  HiChartPie,
  HiClipboardDocumentList,
  HiCog6Tooth,
  HiDocumentText,
  HiTableCells,
  HiUser,
  HiUserCircle,
  HiUsers,
  HiLockClosed,
} from "react-icons/hi2";

const NAV_CLS = "h-5 w-5 shrink-0";
const PAGE_CLS = "h-6 w-6 shrink-0";

type IconProps = { className?: string };

/** SecurityLog */
export function SecurityLogIcon({ className = PAGE_CLS }: IconProps) {
  return <HiLockClosed className={className} aria-hidden />;
}

export function NavSecurityLogIcon() {
  return <SecurityLogIcon className={NAV_CLS} />;
}

/** AdminDashboard */
export function AdminDashboardIcon({ className = PAGE_CLS }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 2a10 10 0 1 0 10 10h-10z" />
      <path d="M13 2.05A10 10 0 0 1 21.95 11H13z" opacity="0.5" />
    </svg>
  );
}

/** AgentList — Vendors */
export function VendorIcon({ className = PAGE_CLS }: IconProps) {
  return <HiUsers className={className} aria-hidden />;
}

/** CompaniesList */
export function CompaniesIcon({ className = PAGE_CLS }: IconProps) {
  return <HiBuildingOffice2 className={className} aria-hidden />;
}

/** PayInList, CompanyPayInView */
export function PayInIcon({ className = PAGE_CLS }: IconProps) {
  return <PiContactlessPaymentFill className={className} aria-hidden />;
}

/** PayOutList */
export function PayOutIcon({ className = `${PAGE_CLS} rotate-180` }: IconProps) {
  return <PiContactlessPaymentFill className={className} aria-hidden />;
}

/** TransactionReport */
export function TransactionReportIcon({ className = PAGE_CLS }: IconProps) {
  return <HiArrowsRightLeft className={className} aria-hidden />;
}

/** DisputeList */
export function DisputesIcon({ className = PAGE_CLS }: IconProps) {
  return <IoIosWarning className={className} aria-hidden />;
}

/** SettlementLog */
export function SettlementLogIcon({ className = PAGE_CLS }: IconProps) {
  return <HiClipboardDocumentList className={className} aria-hidden />;
}

/** LedgerReport */
export function LedgerIcon({ className = PAGE_CLS }: IconProps) {
  return <HiTableCells className={className} aria-hidden />;
}

/** CompanyNotifications */
export function NotificationsIcon({ className = PAGE_CLS }: IconProps) {
  return <HiBell className={className} aria-hidden />;
}

/** CompanyDashboard, agent dashboard */
export function CompanyDashboardIcon({ className = PAGE_CLS }: IconProps) {
  return <HiChartPie className={className} aria-hidden />;
}

/** SavedReports / company Reports */
export function ReportsIcon({ className = PAGE_CLS }: IconProps) {
  return <HiDocumentText className={className} aria-hidden />;
}

/** UsersList — Payment Method */
export function PaymentMethodIcon({ className = PAGE_CLS }: IconProps) {
  return <HiUser className={className} aria-hidden />;
}

/** CompanySettings */
export function SettingsIcon({ className = PAGE_CLS }: IconProps) {
  return <HiCog6Tooth className={className} aria-hidden />;
}

/** MyAccount */
export function MyAccountIcon({ className = PAGE_CLS }: IconProps) {
  return <HiUserCircle className={className} aria-hidden />;
}

/* Sidebar wrappers */
export function NavAdminDashboardIcon() {
  return <AdminDashboardIcon className={NAV_CLS} />;
}
export function NavVendorIcon() {
  return <VendorIcon className={NAV_CLS} />;
}
export function NavCompaniesIcon() {
  return <CompaniesIcon className={NAV_CLS} />;
}
export function NavPayInIcon() {
  return <PayInIcon className={NAV_CLS} />;
}
export function NavPayOutIcon() {
  return <PayOutIcon className={`${NAV_CLS} rotate-180`} />;
}
export function NavTransactionReportIcon() {
  return <TransactionReportIcon className={NAV_CLS} />;
}
export function NavDisputesIcon() {
  return <DisputesIcon className={NAV_CLS} />;
}
export function NavSettlementLogIcon() {
  return <SettlementLogIcon className={NAV_CLS} />;
}
export function NavLedgerIcon() {
  return <LedgerIcon className={NAV_CLS} />;
}
export function NavNotificationsIcon() {
  return <NotificationsIcon className={NAV_CLS} />;
}
export function NavCompanyDashboardIcon() {
  return <CompanyDashboardIcon className={NAV_CLS} />;
}
export function NavReportsIcon() {
  return <ReportsIcon className={NAV_CLS} />;
}
export function NavPaymentMethodIcon() {
  return <PaymentMethodIcon className={NAV_CLS} />;
}
export function NavSettingsIcon() {
  return <SettingsIcon className={NAV_CLS} />;
}
export function NavMyAccountIcon() {
  return <MyAccountIcon className={NAV_CLS} />;
}
