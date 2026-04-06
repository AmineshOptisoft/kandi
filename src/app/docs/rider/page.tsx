'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function RiderDocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderBottom: '1px solid #334155',
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          🏍️
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
            Kandi Rider App — API Docs
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
            React Native Developer Reference &mdash; Rider APIs Only &mdash; v1.0.0
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Rider Auth', 'Rider Profile', 'Rider Actions'].map((tag) => (
            <span
              key={tag}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: tag === 'Rider Auth' ? '#312e81' : '#1e293b',
                border: `1px solid ${tag === 'Rider Auth' ? '#6366f1' : '#334155'}`,
                color: tag === 'Rider Auth' ? '#a5b4fc' : '#94a3b8',
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {tag}
            </span>
          ))}
          <a
            href="/docs"
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              background: '#0f172a',
              border: '1px solid #475569',
              color: '#cbd5e1',
              fontSize: 11,
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            ← All APIs
          </a>
        </div>
      </div>

      {/* Quick Reference */}
      <div
        style={{
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '14px 32px',
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          color: '#94a3b8',
        }}
      >
        <span>📱 <strong style={{ color: '#e2e8f0' }}>12 Endpoints</strong></span>
        <span>🔐 <strong style={{ color: '#e2e8f0' }}>3</strong> Auth (Login, Forgot, Reset)</span>
        <span>👤 <strong style={{ color: '#e2e8f0' }}>1</strong> Profile</span>
        <span>🚗 <strong style={{ color: '#e2e8f0' }}>8</strong> Ride Actions</span>
        <span style={{ marginLeft: 'auto', color: '#6366f1' }}>
          Base URL: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/api/rider-app
          </code>
        </span>
      </div>

      {/* Swagger UI */}
      <div style={{ padding: '0', background: '#fff' }}>
        <style>{`
          .swagger-ui .topbar { display: none !important; }
          .swagger-ui .info { padding: 20px 32px 0 !important; }
          .swagger-ui .info .title { font-size: 28px !important; }
          .swagger-ui .scheme-container { padding: 16px 32px !important; background: #f8fafc !important; }
          .swagger-ui .opblock-tag { font-size: 16px !important; font-weight: 600 !important; }
          .swagger-ui .btn.authorize { background: #6366f1 !important; border-color: #6366f1 !important; color: #fff !important; }
          .swagger-ui .btn.authorize svg { fill: #fff !important; }
          .swagger-ui .opblock.opblock-post { border-color: #6366f1 !important; }
          .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #6366f1 !important; }
          .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #22c55e !important; }
          .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #f59e0b !important; }
        `}</style>

        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', background: '#fff' }}>
            <div style={{ textAlign: 'center', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <p>Loading Rider API Documentation...</p>
            </div>
          </div>
        }>
          <SwaggerUI
            url="/api/docs/rider"
            persistAuthorization={true}
            tryItOutEnabled={true}
            displayRequestDuration={true}
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={3}
            docExpansion="list"
            filter={true}
          />
        </Suspense>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SOCKET.IO REAL-TIME EVENTS REFERENCE
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: '#0f172a',
          padding: '40px 32px',
          borderTop: '1px solid #334155',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
            ⚡ Socket.io — Real-Time Events Reference
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>
            These WebSocket events are used alongside the REST APIs for live location tracking and push notifications.
            Connect via <code style={{ background: '#1e293b', padding: '2px 8px', borderRadius: 4, color: '#a5b4fc' }}>
              socket.io-client
            </code> with path <code style={{ background: '#1e293b', padding: '2px 8px', borderRadius: 4, color: '#a5b4fc' }}>
              /api/socket/io
            </code>
          </p>

          {/* Connection Setup */}
          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 24,
            border: '1px solid #334155',
          }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              🔌 Connection Setup (React Native)
            </h3>
            <pre style={{
              background: '#0f172a', padding: 16, borderRadius: 8, color: '#a5b4fc',
              fontSize: 12, lineHeight: 1.6, overflowX: 'auto', margin: 0,
            }}>
{`import { io } from "socket.io-client";

const socket = io("https://your-server-url", {
  path: "/api/socket/io",
  addTrailingSlash: false,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("disconnect", () => console.log("Disconnected"));`}
            </pre>
          </div>

          {/* EMIT: update-location */}
          <div style={{
            background: '#1e293b', borderRadius: 12, marginBottom: 24,
            border: '1px solid #334155', overflow: 'hidden',
          }}>
            <div style={{
              background: '#312e81', padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                background: '#6366f1', color: '#fff', padding: '3px 10px',
                borderRadius: 6, fontSize: 11, fontWeight: 700,
              }}>EMIT</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
                update-location
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>
                Client → Server
              </span>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 12 }}>
                Rider app emits GPS coordinates every <strong style={{ color: '#a5b4fc' }}>10 seconds</strong> while online.
                Server persists to DB, resolves area via reverse geocoding, and broadcasts <code style={{ color: '#a5b4fc' }}>rider-moved</code> to all connected clients.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>PAYLOAD:</p>
              <pre style={{
                background: '#0f172a', padding: 16, borderRadius: 8, color: '#a5b4fc',
                fontSize: 12, lineHeight: 1.6, overflowX: 'auto', margin: 0,
              }}>
{`socket.emit("update-location", {
  riderId: 1,          // int — Rider ID
  vehicleId: 5,        // int — Assigned vehicle ID
  lat: 26.9124,        // float — GPS latitude
  lng: 75.7873,        // float — GPS longitude
  status: "free"       // "free" | "busy" | "offline"
});`}
              </pre>
            </div>
          </div>

          {/* LISTEN: rider-moved */}
          <div style={{
            background: '#1e293b', borderRadius: 12, marginBottom: 24,
            border: '1px solid #334155', overflow: 'hidden',
          }}>
            <div style={{
              background: '#064e3b', padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                background: '#22c55e', color: '#fff', padding: '3px 10px',
                borderRadius: 6, fontSize: 11, fontWeight: 700,
              }}>LISTEN</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
                rider-moved
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>
                Server → Client
              </span>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 12 }}>
                Broadcast to all clients when any rider&apos;s GPS location updates. Use this for live map tracking.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>PAYLOAD:</p>
              <pre style={{
                background: '#0f172a', padding: 16, borderRadius: 8, color: '#a5b4fc',
                fontSize: 12, lineHeight: 1.6, overflowX: 'auto', margin: 0,
              }}>
{`socket.on("rider-moved", (data) => {
  // data = {
  //   riderId: 1,
  //   vehicleId: 5,
  //   lat: 26.9124,
  //   lng: 75.7873,
  //   area: "Malviya Nagar, Jaipur",  // Resolved by server
  //   name: "Ravi Kumar",              // From DB
  //   lastSeen: 1712412345000,         // Unix timestamp
  //   status: "free"
  // }
});`}
              </pre>
            </div>
          </div>

          {/* LISTEN: notification */}
          <div style={{
            background: '#1e293b', borderRadius: 12, marginBottom: 24,
            border: '1px solid #334155', overflow: 'hidden',
          }}>
            <div style={{
              background: '#78350f', padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                background: '#f59e0b', color: '#000', padding: '3px 10px',
                borderRadius: 6, fontSize: 11, fontWeight: 700,
              }}>LISTEN</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
                notification
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>
                Server → Client (via Redis Pub/Sub)
              </span>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 12 }}>
                Real-time ride lifecycle notifications pushed from the server when rides are booked, accepted, started, completed, or cancelled.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>EVENT TYPES:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 16 }}>
                {[
                  { type: 'new-booking', emoji: '🆕', desc: 'New ride request created' },
                  { type: 'ride-accepted', emoji: '✅', desc: 'Rider accepted a ride' },
                  { type: 'ride-assigned', emoji: '📌', desc: 'Admin assigned ride to rider' },
                  { type: 'trip-started', emoji: '🚗', desc: 'OTP verified, trip started' },
                  { type: 'trip-completed', emoji: '🏁', desc: 'Trip completed, fare collected' },
                  { type: 'notification', emoji: '🔔', desc: 'Generic notification (cancel etc)' },
                ].map((evt) => (
                  <div key={evt.type} style={{
                    background: '#0f172a', borderRadius: 8, padding: '8px 12px',
                    border: '1px solid #334155',
                  }}>
                    <span style={{ fontSize: 14 }}>{evt.emoji}</span>
                    <code style={{ color: '#a5b4fc', fontSize: 11, marginLeft: 6 }}>{evt.type}</code>
                    <p style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>{evt.desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>PAYLOAD EXAMPLE:</p>
              <pre style={{
                background: '#0f172a', padding: 16, borderRadius: 8, color: '#a5b4fc',
                fontSize: 12, lineHeight: 1.6, overflowX: 'auto', margin: 0,
              }}>
{`socket.on("notification", (data) => {
  // data = {
  //   type: "ride-accepted",       // Event type (see above)
  //   orderId: 42,                 // Order ID
  //   riderId: 1,                  // Rider ID (if applicable)
  //   message: "✅ Ride accepted: Rider #1 heading to pickup",
  //   timestamp: 1712412345000     // Unix timestamp
  // }
  
  // Use this to show in-app toast/alert
  showAlert(data.message);
});`}
              </pre>
            </div>
          </div>

          {/* Quick Integration Flow */}
          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 24,
            border: '1px solid #334155',
          }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              📋 Rider App Integration Flow
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: '1', title: 'Login', desc: 'POST /api/rider-app/auth/login → Get JWT token' },
                { step: '2', title: 'Connect Socket', desc: 'io("server-url", { path: "/api/socket/io" })' },
                { step: '3', title: 'Go Online', desc: 'PATCH /api/rider-app/status → { status: 0 }' },
                { step: '4', title: 'Start GPS Tracking', desc: 'Emit "update-location" every 10 seconds' },
                { step: '5', title: 'Poll Pending Rides', desc: 'GET /api/rider-app/pending-rides every 5 seconds' },
                { step: '6', title: 'Listen for Notifications', desc: 'socket.on("notification") for ride events' },
                { step: '7', title: 'Accept → Arrive → Start → Complete', desc: 'Full ride lifecycle via REST APIs' },
              ].map((item) => (
                <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {item.step}
                  </div>
                  <div>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{item.title}</span>
                    <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
