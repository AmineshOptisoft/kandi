"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, UserCircleIcon } from "@/icons";
import UserAuthModal from "./UserAuthModal";
import { UserContext } from "@/app/(user)/user/layout";
import { useContext } from "react";

export default function UserHeader() {
  const pathname = usePathname();
  const { user: activeUser } = useContext(UserContext) as any;
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [open, setOpen] = useState(false);
  const showAuthButtons = (pathname === "/" || pathname === "/user") && !activeUser;
  const showUserIcon = pathname !== "/user" || activeUser;

  const openModal = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center justify-between px-4 py-3 md:px-6">
          <Link href="/user" className="text-2xl font-bold text-brand-600">
            Kadi
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <Link
              href="/user/book-ride"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 font-bold"
            >
              Book a Ride
            </Link>
            <Link
              href="/user/orders"
              className="text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300"
            >
              My Orders
            </Link>
            <Link
              href="/user/track"
              className="text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300"
            >
              Track
            </Link>
            <Link
              href="/user/profile"
              className="text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300"
            >
              Profile
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {showAuthButtons ? (
              <>
                <button
                  onClick={() => openModal("login")}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                >
                  Login
                </button>
                <button
                  onClick={() => openModal("signup")}
                  className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Sign Up
                </button>
              </>
            ) : null}
            <Link
              href="/user/notifications"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.05]"
              title="Notifications"
            >
              <BellIcon />
            </Link>
            {activeUser ? (
              <div className="flex items-center gap-2 pr-2 border-r border-gray-100 dark:border-gray-800 mr-1">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{activeUser.firstName}</p>
                  <p className="text-[10px] text-brand-600 font-medium">Customer</p>
                </div>
              </div>
            ) : null}

            {showUserIcon ? (
              <Link
                href="/user/profile"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.05] transition-colors"
                title="Profile"
              >
                <UserCircleIcon />
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <UserAuthModal mode={authMode} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
