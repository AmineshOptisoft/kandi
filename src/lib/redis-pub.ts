import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let redis: any;

try {
  redis = new Redis(redisUrl);
} catch (e) {
  console.log("Redis not available for publishing.");
}

export const publishNotification = async (type: string, data: any) => {
  if (!redis || redis.status !== "ready") return;
  
  const payload = JSON.stringify({
    type,       // 'new-booking', 'ride-accepted', 'trip-started', 'trip-completed'
    ...data,
    timestamp: Date.now()
  });

  await redis.publish("ride-updates", payload);
};
