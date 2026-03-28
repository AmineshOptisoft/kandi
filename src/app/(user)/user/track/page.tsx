"use client";

import { useEffect, useContext, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserContext } from "../layout";

function TrackingRedirectController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = useContext(UserContext) as any;
  const activeUser = context?.user;
  const queryOrderId = searchParams.get("orderId");

  useEffect(() => {
    // 1. If we have a direct orderId in query, go there
    if (queryOrderId) {
      router.replace(`/user/track/${queryOrderId}`);
      return;
    }

    // 2. If no queryOrderId, find most recent active trip for the user
    if (activeUser) {
      fetch(`/api/orders?customerId=${activeUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const ongoing = data.find(o => ["Pending", "Accepted", "Started", "Picked Up"].includes(o.status));
            if (ongoing) {
              router.replace(`/user/track/${ongoing.id}`);
            } else {
              // No ongoing ride, take back to orders
              router.replace("/user/orders");
            }
          }
        })
        .catch(() => router.replace("/user/orders"));
    }
  }, [queryOrderId, activeUser, router]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-10 text-center">
       <div className="h-12 w-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
       <p className="text-lg font-bold text-gray-800 dark:text-white">🛰️ Connecting to Satellite Tracking...</p>
       <p className="text-sm text-gray-400 mt-2 italic">Please wait while we establish a secure link to your rider.</p>
    </div>
  );
}

export default function UserTrackFallbackPage() {
  return (
    <Suspense fallback={<div>Loading mapping system...</div>}>
      <TrackingRedirectController />
    </Suspense>
  );
}
