"use client";

import React, { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

export default function GlobalNotificationListener() {
  const [notification, setNotification] = useState<any>(null);

  useEffect(() => {
    const socket = getSocket();
    
    socket.on("notification", (data) => {
      console.log("🔔 New Real-time Notification:", data);
      setNotification(data);
      
      // Auto-hide after 6 seconds
      setTimeout(() => setNotification(null), 6000);
    });

    return () => { socket.off("notification"); };
  }, []);

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99999] animate-bounce-in">
      <div className="bg-white dark:bg-gray-900 border-l-4 border-brand-500 shadow-2xl rounded-xl p-4 min-w-[300px] border border-gray-200 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <div className="text-2xl">
            {notification.type === "ride-assigned" && "🎯"}
            {notification.type === "ride-accepted" && "✅"}
            {notification.type === "trip-started" && "🚕"}
            {notification.type === "trip-completed" && "🏁"}
          </div>
          <div className="flex-1">
             <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">
                System Alert
             </p>
             <p className="text-sm font-semibold text-gray-800 dark:text-white">
                {notification.message}
             </p>
             <p className="text-[10px] text-gray-400 mt-1">
                {new Date(notification.timestamp).toLocaleTimeString()}
             </p>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>
    </div>
  );
}
