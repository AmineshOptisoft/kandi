export async function sendPushNotification({
  title,
  message,
  url,
  userIds,
  playerIds
}: {
  title: string;
  message: string;
  url?: string;
  userIds?: string[];
  playerIds?: string[];
}) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restKey) {
    console.warn("[OneSignal] Skipping push: Credentials missing in .env");
    return false;
  }

  try {
    const payload: Record<string, any> = {
      app_id: appId,
      headings: { en: title || "Kandi" },
      contents: { en: message || "New Notification" },
    };

    if (url) payload.url = url;

    // Target by Player IDs (UUIDs)
    if (playerIds && playerIds.length > 0) {
      payload.include_player_ids = playerIds;
      console.log(`[OneSignal] Targeting Player IDs: ${playerIds.length} users`);
    } 
    // Target by Database User IDs (External IDs)
    else if (userIds && userIds.length > 0) {
      payload.include_external_user_ids = userIds;
      payload.channel_for_external_user_ids = "push";
      console.log(`[OneSignal] Targeting External IDs: ${userIds.join(', ')}`);
    } 
    // Default: Broadcast to All Subscribed Users
    else {
      payload.included_segments = ["Total Subscriptions"]; // Use "Total Subscriptions" or "Subscribed Users"
      console.log(`[OneSignal] Broadcasting to all subscribed users`);
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${restKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("[OneSignal] Push Error:", result);
      return false;
    }
    
    console.log("[OneSignal] Push Success! ID:", result.id);
    return true;
  } catch (error) {
    console.error("[OneSignal] Network Error:", error);
    return false;
  }
}
