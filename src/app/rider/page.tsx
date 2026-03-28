"use client";
import React, { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import GlobalNotificationListener from "@/components/common/GlobalNotificationListener";

type RidePhase = "idle" | "accepted" | "otp" | "started" | "completed";

interface Order {
  id: number;
  status: string;
  otp?: string;
  amount?: number;
  paymentMode?: string;
  pickupLoc?: string;
  dropLoc?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  customer?: { firstName: string; lastName: string; phone: string };
  customer_name?: string;
  customer_phone?: string;
}

export default function RiderDashboard() {
  // Simulated rider login state (in production: from actual auth session)
  const [riderId, setRiderId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [riders, setRiders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [phase, setPhase] = useState<RidePhase>("idle");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [distanceTravelled, setDistanceTravelled] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  // ── Fetch riders and vehicles for login ─────────────────────────────────
  useEffect(() => {
    Promise.all([fetch("/api/riders"), fetch("/api/vehicles")]).then(
      async ([rRes, vRes]) => {
        if (rRes.ok) setRiders(await rRes.json());
        if (vRes.ok) setVehicles((await vRes.json()).filter((v: any) => v.status === "available"));
      }
    );
  }, []);

  const currentRider = riders.find((r: any) => r.id.toString() === riderId);

  // Auto-set vehicle if rider has an assigned one
  useEffect(() => {
    if (currentRider && currentRider.assignedVehicle && !isLoggedIn) {
      setVehicleId(currentRider.assignedVehicle.id.toString());
    }
  }, [riderId, currentRider, isLoggedIn]);

  // ── Fetch pending rides ──────────────────────────────────────────────────
  const fetchRides = useCallback(async () => {
    if (!riderId) return;
    try {
      const res = await fetch(`/api/rider-app/pending-rides?riderId=${riderId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.riderStatus === "busy") {
        if (data.activeOrder) {
          setCurrentOrder(data.activeOrder);
          setPhase(data.activeOrder.status === "Started" ? "started" : "accepted");
        }
      } else {
        if (phase === "idle") {
          setPendingOrders(data.pendingOrders || []);
        }
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, [riderId, phase]);

  // Poll every 5 seconds when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchRides();
    const interval = setInterval(fetchRides, 5000);
    setIsPolling(true);
    return () => { clearInterval(interval); setIsPolling(false); };
  }, [isLoggedIn, fetchRides]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleAccept = async (order: Order) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/rider-app/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, riderId: parseInt(riderId), vehicleId: parseInt(vehicleId) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to accept"); return; }
      setCurrentOrder(data.order);
      setPhase("accepted");
      setPendingOrders([]);
      setSuccessMsg("🎉 Ride accepted! Head to the pickup point.");
    } catch { setError("An error occurred."); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/ride-requests/${currentOrder.id}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpInput, vehicleId: parseInt(vehicleId) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "OTP verification failed"); return; }
      setCurrentOrder((prev) => prev ? { ...prev, status: "Started" } : prev);
      setPhase("started");
      setSuccessMsg("✅ OTP verified! Trip has started. Head to the drop location.");
    } catch { setError("An error occurred."); }
    finally { setLoading(false); }
  };

  const handleComplete = async () => {
    if (!currentOrder) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/ride-requests/${currentOrder.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMode: currentOrder.paymentMode || "Cash",
          distanceTravelled: parseFloat(distanceTravelled) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to complete trip"); return; }
      setPhase("completed");
      setSuccessMsg(`🏁 Trip completed! ₹${data.data?.amountCollected} collected via ${data.data?.paymentMode}`);
      setCurrentOrder(null);
    } catch { setError("An error occurred."); }
    finally { setLoading(false); }
  };

  // ── LIVE TRACKING ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !riderId) return;

    let socket = getSocket();
    
    // Periodically send coordinates to socket server
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
             const { latitude, longitude } = pos.coords;
             if (socket && socket.connected) {
               socket.emit("update-location", { 
                 riderId: parseInt(riderId), 
                 vehicleId: parseInt(vehicleId),
                 lat: latitude, 
                 lng: longitude,
                 status: phase === "idle" ? "free" : "busy"
               });
             }
          },
          (err) => console.log("GPS Location error:", err.message),
          { enableHighAccuracy: true }
        );
      }
    }, 10000); // 10 seconds check

    return () => clearInterval(interval);
  }, [isLoggedIn, riderId, vehicleId, phase]);

  const resetToIdle = () => {
    setPhase("idle");
    setCurrentOrder(null);
    setOtpInput("");
    setDistanceTravelled("");
    setError("");
    setSuccessMsg("");
    fetchRides();
  };

  // ────────────────────────────────────────────────────────────────────────
  // NOT LOGGED IN — Rider Select Screen
  // ────────────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-brand-500 to-brand-700 p-6 text-center text-white">
            <div className="text-4xl mb-2">🛵</div>
            <h1 className="text-2xl font-extrabold">Rider App</h1>
            <p className="text-sm opacity-80 mt-1">Kadi EV Fleet</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Your Profile</label>
              <select
                value={riderId}
                onChange={(e) => {
                  setRiderId(e.target.value);
                  setVehicleId(""); // Reset vehicle when rider changes
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="">Select Rider...</option>
                {riders.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Vehicle</label>
              {currentRider && currentRider.assignedVehicle ? (
                <div className="p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-600 dark:text-brand-400 text-sm">
                      {currentRider.assignedVehicle.regNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentRider.assignedVehicle.model} · Fixed Assignment
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-brand-500">🔋{currentRider.assignedVehicle.battery}%</span>
                  </div>
                </div>
              ) : (
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Select Vehicle...</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.regNumber} — {v.model} 🔋{v.battery}%</option>
                  ))}
                </select>
              )}
            </div>

            {!currentRider?.assignedVehicle && vehicles.length === 0 && (
              <p className="text-xs text-red-500 text-center">No available vehicles. All vehicles may be in use.</p>
            )}

            <button
              disabled={!riderId || !vehicleId}
              onClick={() => setIsLoggedIn(true)}
              className="w-full py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-40 transition-colors"
            >
              Go Online 🟢
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedRider = riders.find((r: any) => r.id.toString() === riderId);
  const selectedVehicle = vehicles.find((v: any) => v.id.toString() === vehicleId);

  return (
    <>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛵</span>
          <div>
            <p className="font-bold text-gray-800 dark:text-white text-sm">{selectedRider?.name}</p>
            <p className="text-xs text-gray-400">{selectedVehicle?.regNumber} · 🔋{selectedVehicle?.battery}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPolling && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <button
            onClick={() => setIsLoggedIn(false)}
            className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Go Offline
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Messages */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl dark:bg-red-900/30 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 text-sm text-green-600 bg-green-50 rounded-xl dark:bg-green-900/30 dark:text-green-400">
            {successMsg}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PHASE: IDLE — Show pending ride requests
        ══════════════════════════════════════════════════════════════ */}
        {phase === "idle" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Ride Requests</h2>
              <button onClick={fetchRides} className="text-xs text-brand-500 hover:text-brand-700 font-medium">Refresh ↻</button>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-10 text-center">
                <p className="text-4xl mb-3">😴</p>
                <p className="font-semibold text-gray-700 dark:text-gray-300">No ride requests right now</p>
                <p className="text-sm text-gray-400 mt-1">Polling every 5 seconds...</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  {/* Fare Banner */}
                  <div className="bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-3 flex items-center justify-between text-white">
                    <div>
                      <p className="text-xs opacity-80">Estimated Fare</p>
                      <p className="text-3xl font-extrabold">₹{order.amount ?? "—"}</p>
                    </div>
                    <div className="text-right text-sm opacity-90">
                      <p>💳 {order.paymentMode || "Cash"}</p>
                      <p className="text-xs opacity-70">#ORD-{order.id.toString().padStart(3, "0")}</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold">
                        {order.customer?.firstName?.charAt(0) ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-white">
                          {order.customer?.firstName} {order.customer?.lastName}
                        </p>
                        <p className="text-sm text-gray-400">{order.customer?.phone}</p>
                      </div>
                    </div>

                    {/* Locations */}
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">📍</span>
                        <div>
                          <p className="text-xs text-gray-400">Pickup</p>
                          <p className="font-medium text-gray-800 dark:text-white">{order.pickupLoc || "Not specified"}</p>
                          {order.pickupLat && order.pickupLng && (
                            <p className="text-xs text-gray-400">{order.pickupLat}, {order.pickupLng}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">🏁</span>
                        <div>
                          <p className="text-xs text-gray-400">Drop</p>
                          <p className="font-medium text-gray-800 dark:text-white">{order.dropLoc || "Not specified"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Accept Button */}
                    <button
                      onClick={() => handleAccept(order)}
                      disabled={loading}
                      className="w-full py-3 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Accepting..." : "✅ Accept Ride"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PHASE: ACCEPTED — Heading to pickup, waiting for OTP
        ══════════════════════════════════════════════════════════════ */}
        {phase === "accepted" && currentOrder && (
          <div className="space-y-4">
            {/* Status Banner */}
            <div className="rounded-2xl bg-blue-500 p-5 text-white text-center">
              <p className="text-sm opacity-80 mb-1">Status</p>
              <p className="text-2xl font-extrabold">🚗 Heading to Pickup</p>
              <p className="text-sm opacity-80 mt-1">Ask customer for OTP when you arrive</p>
            </div>

            {/* Customer & Location Info */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
                  {currentOrder.customer?.firstName?.charAt(0) ?? "?"}
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">
                    {currentOrder.customer?.firstName} {currentOrder.customer?.lastName}
                  </p>
                  <a href={`tel:${currentOrder.customer?.phone}`} className="text-brand-500 text-sm font-medium">
                    📞 {currentOrder.customer?.phone}
                  </a>
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-green-500">📍</span>
                  <div>
                    <p className="text-xs text-gray-400">Pickup Location</p>
                    <p className="font-semibold text-gray-800 dark:text-white">{currentOrder.pickupLoc}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="text-red-500">🏁</span>
                  <div>
                    <p className="text-xs text-gray-400">Drop Location</p>
                    <p className="font-semibold text-gray-800 dark:text-white">{currentOrder.dropLoc}</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Fare</p>
                <p className="text-3xl font-extrabold text-brand-600">₹{currentOrder.amount}</p>
                <p className="text-xs text-gray-400">{currentOrder.paymentMode}</p>
              </div>
            </div>

            {/* OTP Entry Form */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
              <p className="font-bold text-gray-800 dark:text-white mb-1">🔐 Enter Customer OTP</p>
              <p className="text-sm text-gray-400 mb-4">Ask the customer to show their OTP from the booking confirmation</p>
              <form onSubmit={handleVerifyOtp} className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Enter 4-digit OTP"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 px-4 py-3 text-center text-2xl font-mono font-bold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white tracking-widest"
                />
                <button
                  type="submit"
                  disabled={loading || otpInput.length !== 4}
                  className="px-5 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-40"
                >
                  {loading ? "..." : "Verify"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PHASE: STARTED — Trip is ongoing, heading to drop
        ══════════════════════════════════════════════════════════════ */}
        {phase === "started" && currentOrder && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-indigo-600 p-5 text-white text-center">
              <p className="text-sm opacity-80 mb-1">Trip Status</p>
              <p className="text-2xl font-extrabold">🛵 Ride in Progress</p>
              <p className="text-sm opacity-80 mt-1">Head to the drop location</p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-sm space-y-2">
                <div className="flex gap-2">
                  <span className="text-red-500">🏁</span>
                  <div>
                    <p className="text-xs text-gray-400">Drop Location</p>
                    <p className="font-bold text-gray-800 dark:text-white text-base">{currentOrder.dropLoc}</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Fare to Collect</p>
                <p className="text-4xl font-extrabold text-brand-600">₹{currentOrder.amount}</p>
                <p className="text-sm text-gray-400 mt-0.5">via {currentOrder.paymentMode}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Actual Distance (km) — Optional
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 12.5"
                  value={distanceTravelled}
                  onChange={(e) => setDistanceTravelled(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full py-3.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl disabled:opacity-50 transition-colors"
              >
                {loading ? "Processing..." : "🏁 Complete Ride & Collect Payment"}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PHASE: COMPLETED
        ══════════════════════════════════════════════════════════════ */}
        {phase === "completed" && (
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">Trip Complete!</h2>
            <p className="text-gray-500 text-sm">{successMsg}</p>
            <button
              onClick={resetToIdle}
              className="w-full py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl"
            >
              Accept Next Ride →
            </button>
          </div>
        )}
      </div>
    </div>
    <GlobalNotificationListener />
    </>
  );
}
