"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { ChevronDownIcon, HorizontaLDots } from "../icons/index";
import {
  NavAdminDashboardIcon,
  NavCompaniesIcon,
  NavCompanyDashboardIcon,
  NavDisputesIcon,
  NavLedgerIcon,
  NavMyAccountIcon,
  NavNotificationsIcon,
  NavPayInIcon,
  NavPaymentMethodIcon,
  NavPayOutIcon,
  NavReportsIcon,
  NavSettingsIcon,
  NavSettlementLogIcon,
  NavSecurityLogIcon,
  NavTransactionReportIcon,
  NavVendorIcon,
} from "../icons/nav-icons";

/* ── Types ──────────────────────────────────────────────────── */
type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

type NavSection = {
  heading: string;
  sectionKey: string;
  items: NavItem[];
};

type PanelType = "admin" | "agent" | "company";

/* ── Menu definitions ───────────────────────────────────────── */
const adminSections: NavSection[] = [
  {
    heading: "",
    sectionKey: "admin-main",
    items: [
      { icon: <NavAdminDashboardIcon />, name: "Dashboard", path: "/" },
      { icon: <NavVendorIcon />, name: "Vendor", path: "/agent" },
      { icon: <NavCompaniesIcon />, name: "Companies", path: "/companies" },
      { icon: <NavPayInIcon />, name: "Pay In", path: "/pay-in" },
      { icon: <NavPayOutIcon />, name: "Pay Out", path: "/pay-out" },
      { icon: <NavTransactionReportIcon />, name: "Transaction Report", path: "/transaction-report" },
      { icon: <NavDisputesIcon />, name: "Disputes", path: "/dispute" },
      { icon: <NavSettlementLogIcon />, name: "Settlement Log", path: "/settlement-log" },
      { icon: <NavSecurityLogIcon />, name: "Security Log", path: "/security-log" },
      { icon: <NavLedgerIcon />, name: "Ledger", path: "/ledger" },
      { icon: <NavLedgerIcon />, name: "Interledger History", path: "/interledger-history" },
      { icon: <NavNotificationsIcon />, name: "Notifications", path: "/notifications" },
    ],
  },
  {
    heading: "Account",
    sectionKey: "admin-account",
    items: [
      { icon: <NavMyAccountIcon />, name: "My Account", path: "/my-account" },
    ],
  },
];

const agentSections: NavSection[] = [
  {
    heading: "",
    sectionKey: "vendor-main",
    items: [
      { icon: <NavCompanyDashboardIcon />, name: "Dashboard", path: "/agent-dashboard" },
      { icon: <NavPayInIcon />, name: "Pay In", path: "/pay-in" },
      { icon: <NavPayOutIcon />, name: "Pay Out", path: "/pay-out" },
    ],
  },
  // {
  //   heading: "Reporting",
  //   sectionKey: "agent-reporting",
  //   items: [
  //     { icon: <PieChartIcon />, name: "Saved Reports", path: "/saved-reports" },
  //   ],
  // },
  {
    heading: "Management",
    sectionKey: "agent-mgmt",
    items: [
      { icon: <NavPaymentMethodIcon />, name: "Payment Method", path: "/users" },
    ],
  },
  {
    heading: "Account",
    sectionKey: "agent-account",
    items: [
      { icon: <NavMyAccountIcon />, name: "My Account", path: "/my-account" },
    ],
  },
];

const companySections: NavSection[] = [
  {
    heading: "",
    sectionKey: "company-main",
    items: [
      { icon: <NavCompanyDashboardIcon />, name: "Dashboard", path: "/company-dashboard" },
      { icon: <NavPayInIcon />, name: "PayIn", path: "/pay-in" },
      { icon: <NavPayOutIcon />, name: "PayOut", path: "/pay-out" },
      { icon: <NavReportsIcon />, name: "Reports", path: "/reports" },
      { icon: <NavNotificationsIcon />, name: "Notifications", path: "/notifications" },
      { icon: <NavSettingsIcon />, name: "Settings", path: "/company-settings" },
    ],
  },
];

const PANEL_LABELS: Record<PanelType, string> = {
  admin: "Admin Panel",
  agent: "Agent Panel",
  company: "Company Panel",
};

const PANEL_THEME: Record<PanelType, { borderBgText: string; iconBg: string; activeItemBg: string; text: string }> = {
  admin: {
    borderBgText: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
    iconBg: "bg-blue-500",
    activeItemBg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
  },
  agent: {
    borderBgText: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
    iconBg: "bg-purple-500",
    activeItemBg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-300",
  },
  company: {
    borderBgText: "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300",
    iconBg: "bg-teal-500",
    activeItemBg: "bg-teal-50 dark:bg-teal-900/20",
    text: "text-teal-700 dark:text-teal-300",
  },
};

/* ── Notification Badge ─────────────────────────────────────── */
function NotificationBadge({ compact }: { compact?: boolean }) {
  const { unreadCount } = useNotifications();
  if (unreadCount === 0) return null;
  if (compact) {
    return (
      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    );
  }
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

/* ── Component ──────────────────────────────────────────────── */
const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user } = useAuth();
  const pathname = usePathname();

  /* Panel switcher */
  const [panel, setPanel] = useState<PanelType>("admin");
  const [panelDropOpen, setPanelDropOpen] = useState(false);
  const panelDropRef = useRef<HTMLDivElement>(null);

  const lockedRole = user?.role || null;

  /* Sync panel with auth role */
  useEffect(() => {
    if (lockedRole) {
      setPanel(lockedRole);
      localStorage.setItem("tepay_panel", lockedRole);
      localStorage.setItem("tepay_role", lockedRole);
    } else {
      const saved = localStorage.getItem("tepay_panel") as PanelType | null;
      if (saved === "admin" || saved === "agent" || saved === "company") setPanel(saved);
    }
  }, [lockedRole]);

  /* Save panel choice */
  const switchPanel = (p: PanelType) => {
    if (lockedRole && p !== lockedRole) return;
    setPanel(p);
    setPanelDropOpen(false);
    localStorage.setItem("tepay_panel", p);
  };

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelDropRef.current && !panelDropRef.current.contains(e.target as Node)) {
        setPanelDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const effectivePanel = lockedRole ?? panel;
  const homePath =
    effectivePanel === "agent" ? "/agent-dashboard" : effectivePanel === "company" ? "/company-dashboard" : "/";
  const currentSections = useMemo((): NavSection[] => {
    if (effectivePanel !== "admin") return effectivePanel === "agent" ? agentSections : companySections;

    if (user?.adminRole === "SUPER_ADMIN") {
      const baseMainItems = adminSections[0].items;
      if (!baseMainItems.some((item) => item.path === "/admins")) {
        return [
          {
            heading: "",
            sectionKey: "admin-main",
            items: [
              ...baseMainItems.slice(0, 3), // Dashboard, Vendor, Companies
              { icon: <NavVendorIcon />, name: "Admins", path: "/admins" },
              // { icon: <NavSecurityLogIcon />, name: "Admin Activity Log", path: "/admin-activity-log" },
              ...baseMainItems.slice(3), // Pay In, etc.
            ] as NavItem[],
          },
          adminSections[1],
        ];
      }
    }
    return adminSections;
  }, [effectivePanel, user?.adminRole]);

  /* Submenu state */
  const [openSubmenu, setOpenSubmenu] = useState<{ sectionKey: string; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    let matched = false;
    currentSections.forEach((section) => {
      section.items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((sub) => {
            if (isActive(sub.path)) {
              setOpenSubmenu({ sectionKey: section.sectionKey, index });
              matched = true;
            }
          });
        }
      });
    });
    if (!matched) setOpenSubmenu(null);
  }, [pathname, isActive, effectivePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.sectionKey}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, sectionKey: string) => {
    setOpenSubmenu((prev) =>
      prev && prev.sectionKey === sectionKey && prev.index === index
        ? null
        : { sectionKey, index }
    );
  };

  const renderMenuItems = (items: NavItem[], sectionKey: string) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, sectionKey)}
              className={`menu-item group ${openSubmenu?.sectionKey === sectionKey && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span className={openSubmenu?.sectionKey === sectionKey && openSubmenu?.index === index ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${openSubmenu?.sectionKey === sectionKey && openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}
              >
                <span className={isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text flex items-center gap-2">
                    {nav.name}
                    {nav.path === "/notifications" && (
                      <NotificationBadge />
                    )}
                  </span>
                )}
                {!isExpanded && !isHovered && !isMobileOpen && nav.path === "/notifications" && (
                  <NotificationBadge compact />
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => { subMenuRefs.current[`${sectionKey}-${index}`] = el; }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.sectionKey === sectionKey && openSubmenu?.index === index
                    ? `${subMenuHeight[`${sectionKey}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span className={`ml-auto ${isActive(subItem.path) ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive"} menu-dropdown-badge`}>
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span className={`ml-auto ${isActive(subItem.path) ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive"} menu-dropdown-badge`}>
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const showLabel = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className={`py-5 flex ${!isExpanded && !isHovered ? "lg:justify-center justify-start" : "lg:justify-center justify-start"}`}>
        <Link href={homePath}>
          {showLabel ? (
            <>
              <Image className="dark:hidden" src="/images/logo/logo-dark.svg" alt="Logo" width={150} height={40} />
              <Image className="hidden dark:block" src="/images/logo/logo.svg" alt="Logo" width={150} height={40} />
            </>
          ) : (
            <Image src="/images/logo/logo-icon.svg" alt="Logo" width={32} height={32} />
          )}
        </Link>
      </div>

      {/* ── Panel Switcher ── */}
      <div ref={panelDropRef} className={`relative mb-5 ${showLabel ? "" : "flex justify-center"}`}>
        <button
          onClick={() => !lockedRole && setPanelDropOpen((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border transition-colors w-full
            ${PANEL_THEME[effectivePanel].borderBgText}
            ${showLabel ? "px-3 py-2.5" : "justify-center p-2.5"}`}
        >
          {/* Icon */}
          <span className={`flex items-center justify-center w-6 h-6 rounded-lg shrink-0 ${PANEL_THEME[effectivePanel].iconBg}`}>
            {effectivePanel === "admin" ? (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ) : effectivePanel === "agent" ? (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h10M7 12h10M7 17h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            )}
          </span>

          {/* Label + chevron */}
          {showLabel && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-bold leading-tight truncate">{PANEL_LABELS[effectivePanel]}</p>
                <p className="text-[10px] opacity-60 leading-tight">
                  {lockedRole
                    ? `Signed in as ${lockedRole.charAt(0).toUpperCase()}${lockedRole.slice(1)}`
                    : "Switch panel"}
                </p>
              </div>
              {!lockedRole && (
                <svg
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${panelDropOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </>
          )}
        </button>

        {/* Dropdown options */}
        {panelDropOpen && showLabel && !lockedRole && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
            {(["admin", "agent", "company"] as PanelType[]).map((p) => (
              <button
                key={p}
                onClick={() => switchPanel(p)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors
                  ${effectivePanel === p ? PANEL_THEME[p].activeItemBg : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-lg shrink-0 ${PANEL_THEME[p].iconBg}`}>
                  {p === "admin" ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ) : p === "agent" ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h10M7 12h10M7 17h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${PANEL_THEME[p].text}`}>
                    {PANEL_LABELS[p]}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                    {p === "admin" ? "Full system access" : p === "agent" ? "Operations access" : "Company operations"}
                  </p>
                </div>
                {effectivePanel === p && (
                  <svg className={`w-4 h-4 shrink-0 ${p === "admin" ? "text-blue-500" : p === "agent" ? "text-purple-500" : "text-teal-500"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {currentSections.map((section) => (
              <div key={section.sectionKey}>
                {section.heading && (
                  <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                    }`}>
                    {showLabel ? section.heading : <HorizontaLDots />}
                  </h2>
                )}
                {renderMenuItems(section.items, section.sectionKey)}
              </div>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
