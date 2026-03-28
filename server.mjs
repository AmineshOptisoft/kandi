import "dotenv/config";
import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import * as mariadb from "mariadb";

const pool = mariadb.createPool({ host: 'localhost', user: 'root', database: 'ev_fleet' });
const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0"; // Listen on all network interfaces
const port = 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let redis;
let sub;

try {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Don't retry indefinitely
  });
  sub = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  redis.on("error", (e) => console.log("Redis Client Error (Silent):", e.message));
  sub.on("error", (e) => console.log("Redis Sub Error (Silent):", e.message));

  console.log("Redis Connection Attempted...");
} catch (e) {
  console.log("Redis initialization failed. Using in-memory mode.");
}

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: { origin: "*" }
  });

  // Listen for Pub/Sub messages from API routes
  if (sub) {
    sub.subscribe("ride-updates", (err, count) => {
      if (err) console.error("Redis Subscribe Error:", err.message);
      else console.log(`Subscribed to ride-updates channel (${count} channel)`);
    });

    sub.on("message", (channel, message) => {
      if (channel === "ride-updates") {
        const data = JSON.parse(message);
        console.log(`🔔 Notification: ${data.type} - Order #${data.orderId}`);
        io.emit("notification", data);
      }
    });
  }


  const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  async function resolveArea(lat, lng) {
     if (!GOOGLE_API_KEY) return "Indira Puram"; // Mock fallback
     try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
        const data = await res.json();
        const areaComp = data.results?.[0]?.address_components?.find(c => c.types.includes("sublocality") || c.types.includes("locality"));
        return areaComp ? areaComp.long_name : "Central Area";
     } catch { return "Sector 62"; }
  }

  io.on("connection", (socket) => {
    console.log(`📡 Connection: ${socket.id}`);

    socket.on("update-location", async (data) => {
      const { riderId, lat, lng } = data;
      const area = await resolveArea(lat, lng);
      const enrichedData = { ...data, area, lastSeen: Date.now() };

      // 1. Log to Redis for ultra-fast live updates
      if (redis && redis.status === "ready") {
        await redis.set(`rider:${riderId}`, JSON.stringify(enrichedData), "EX", 300);
      }

      // 2. Persist to DB for "Resting" visibility (Async)
      prisma.rider.update({
        where: { id: parseInt(riderId) },
        data: { 
          lastLat: parseFloat(lat), 
          lastLng: parseFloat(lng), 
          lastArea: area, 
          lastUpdated: new Date() 
        },
        select: { id: true, name: true }
      }).then(rider => {
        const finalData = { ...enrichedData, name: rider?.name || `Rider ${riderId}` };
        io.emit("rider-moved", finalData);
      }).catch(e => {
        console.log("DB Persistence Error:", e.message);
        io.emit("rider-moved", enrichedData);
      });
    });

    socket.on("disconnect", () => console.log(`❌ Disconnected: ${socket.id}`));
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io + Redis Notifications Active`);
  });
});
