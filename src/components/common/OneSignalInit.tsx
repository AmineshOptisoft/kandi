"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalInit() {
  useEffect(() => {
    // OneSignal strictly requires HTTPS or 'localhost' in Version 16+.
    // Bypass gracefully if running in a local network insecure context.
    if (typeof window !== "undefined" && window.location.protocol === "http:" && window.location.hostname !== "localhost") {
      console.warn("[OneSignal] Skipping init: Push APIs require HTTPS or localhost. Running on:", window.location.href);
      return;
    }

    OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "6545b854-7a84-4b75-90fe-9cf2c066ba58",
      allowLocalhostAsSecureOrigin: true,
    }).then(() => {
      console.log("[OneSignal] Initialized ✅");
    }).catch((err) => {
      console.error("[OneSignal] Init error:", err);
    });
  }, []);

  return null;
}
