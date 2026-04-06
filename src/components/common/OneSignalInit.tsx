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
      appId: "c725be3b-b497-4e32-a6d6-9d8ed6420dd4",
      safari_web_id: "web.onesignal.auto.257d0569-0e14-4d06-8d17-3d55d768ff68",
      allowLocalhostAsSecureOrigin: true,
    }).then(() => {
      console.log("[OneSignal] Initialized ✅");
    }).catch((err) => {
      console.error("[OneSignal] Init error:", err);
    });
  }, []);

  return null;
}
