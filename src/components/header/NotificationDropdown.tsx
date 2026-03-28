"use client";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { getSocket } from "@/lib/socket";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = (data: any) => {
      console.log("🔔 Header Received Notification:", data);
      
      let title = "System Alert";
      let type = "alert";
      
      if (data.type === 'new-booking') {
        title = "New Booking Received";
        type = "order";
      } else if (data.type === 'ride-assigned') {
        title = "Operative Assigned";
        type = "dispatch";
      } else if (data.type === 'ride-accepted') {
        title = "Mission Accepted";
        type = "success";
      }

      setNotifications(prev => [
        {
          id: Math.random().toString(36).substr(2, 9),
          type,
          title,
          message: data.message || `Order ID: ${data.orderId}`,
          time: "Just now",
          timestamp: Date.now()
        },
        ...prev
      ].slice(0, 8)); // Keep last 8
      
      setNotifying(true);
    };

    socket.on("notification", handleNewNotification);

    return () => {
      socket.off("notification");
    };
  }, []);

  function toggleDropdown() {
    setIsOpen(!isOpen);
    if (!isOpen) setNotifying(false);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
            !notifying ? "hidden" : "flex"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[150px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
             Kadi Operational Alerts
          </h5>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500 text-white rounded-full uppercase tracking-tighter shadow-sm animate-pulse">
             Live
          </span>
        </div>

        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar flex-1">
          {notifications.length === 0 ? (
             <li className="py-24 text-center opacity-30">
                <p className="text-4xl mb-4">📡</p>
                <p className="text-xs font-bold uppercase tracking-widest">Awaiting Signals</p>
             </li>
          ) : (
            notifications.map((n) => (
              <li key={n.id}>
                <DropdownItem
                  onItemClick={closeDropdown}
                  className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5 active:scale-[0.98] transition-all"
                >
                  <div className={`flex h-10 w-full max-w-10 items-center justify-center rounded-xl text-white shadow-sm font-bold ${
                    n.type === 'order' ? 'bg-orange-500' : 
                    n.type === 'dispatch' ? 'bg-brand-500' : 'bg-success-500'
                  }`}>
                    {n.type === 'order' ? '📦' : n.type === 'dispatch' ? '⚡' : '✅'}
                  </div>

                  <span className="block flex-1">
                    <span className="mb-0.5 block text-xs font-bold text-gray-800 dark:text-white/90 uppercase tracking-tight">
                       {n.title}
                    </span>
                    <span className="block text-theme-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                       {n.message}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase mt-1 inline-block bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                       {n.time}
                    </span>
                  </span>
                </DropdownItem>
              </li>
            ))
          )}
        </ul>

        <Link
          href="/notifications"
          className="block px-4 py-3 mt-3 text-xs font-bold text-center text-gray-700 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 uppercase tracking-[.2em] shadow-sm active:scale-[0.97] transition-all"
        >
          Mission Archive
        </Link>
      </Dropdown>
    </div>
  );
}
