"use client";
import React, { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import GlobalNotificationListener from "@/components/common/GlobalNotificationListener";
import ForgotPasswordOtpForm from "@/components/auth/ForgotPasswordOtpForm";

type RidePhase = "idle" | "accepted" | "otp" | "started" | "completed";
type Tab = "rides" | "orders" | "trips" | "profile";

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
  createdAt?: string;
  customer?: { firstName: string; lastName: string; phone: string };
}

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Accepted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Started: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function RiderDashboard() {
  const [riderId, setRiderId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [riders, setRiders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [riderProfile, setRiderProfile] = useState<any>(null);

  const [phase, setPhase] = useState<RidePhase>("idle");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [distanceTravelled, setDistanceTravelled] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("rides");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  // Login state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
  const [loginStep, setLoginStep] = useState<"phone" | "register" | "vehicle">("phone");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // ── Fetch riders and vehicles for login ─────────────────────────────────
  useEffect(() => {
    Promise.all([fetch("/api/riders"), fetch("/api/vehicles")]).then(
      async ([rRes, vRes]) => {
        if (rRes.ok) setRiders(await rRes.json());
        if (vRes.ok) setVehicles((await vRes.json()).filter((v: any) => v.status === "available"));
      }
    );
  }, []);

  const currentRider = riders.find((r: any) => r.id?.toString() === riderId);

  // Auto-set vehicle if rider has an assigned one
  useEffect(() => {
    if (currentRider && currentRider.assignedVehicle && !isLoggedIn) {
      setVehicleId(currentRider.assignedVehicle.id?.toString());
    }
  }, [riderId, currentRider, isLoggedIn]);

  // Auto-login if phone saved from global login modal
  useEffect(() => {
    if (riders.length > 0) {
      const savedPhone = localStorage.getItem("sim_rider_phone");
      if (savedPhone) {
        setLoginPhone(savedPhone);
        const found = riders.find((r: any) => r.phone === savedPhone);
        if (found) {
          setRiderId(found.id?.toString());
          if (found.assignedVehicle) {
            setVehicleId(found.assignedVehicle.id?.toString());
          } else if (vehicles.length > 0) {
            setVehicleId(vehicles[0].id?.toString());
          }
          setLoginStep("vehicle");
          // Skip login card on revisit and open dashboard directly.
          setIsLoggedIn(true);
        }
      }
    }
  }, [riders, vehicles]);

  // Fetch full rider profile including stats & history
  const fetchProfile = useCallback(async () => {
    if (!riderId) return;
    try {
      const res = await fetch(`/api/rider-app/profile?riderId=${riderId}`);
      if (res.ok) setRiderProfile(await res.json());
    } catch (e) { console.error(e); }
  }, [riderId]);

  useEffect(() => {
    if (isLoggedIn && riderId) fetchProfile();
  }, [isLoggedIn, riderId, fetchProfile]);

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
        if (phase === "idle") setPendingOrders(data.pendingOrders || []);
      }
    } catch (err) { console.error("Poll error:", err); }
  }, [riderId, phase]);

  useEffect(() => {
    if (!isLoggedIn || !isOnline) {
      if (isPolling) setIsPolling(false);
      return;
    }
    fetchRides();
    const interval = setInterval(fetchRides, 5000);
    setIsPolling(true);
    return () => { clearInterval(interval); setIsPolling(false); };
  }, [isLoggedIn, isOnline, fetchRides]);

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
      setSuccessMsg("✅ OTP verified! Trip has started.");
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
      fetchProfile(); // Refresh stats
    } catch { setError("An error occurred."); }
    finally { setLoading(false); }
  };

  // ── LIVE TRACKING ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !riderId) return;
    let socket = getSocket();
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
                status: isOnline ? (phase === "idle" ? "free" : "busy") : "offline"
              });
            }
          },
          (err) => console.log("GPS error:", err.message),
          { enableHighAccuracy: true }
        );
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isLoggedIn, riderId, vehicleId, phase, isOnline]);

  const resetToIdle = () => {
    setPhase("idle"); setCurrentOrder(null); setOtpInput("");
    setDistanceTravelled(""); setError(""); setSuccessMsg("");
    fetchRides();
  };

  // ── Login handlers ────────────────────────────────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const payload: Record<string, string> = {
        phone: loginPhone,
        password: loginPassword,
      };
      if (requiresPasswordSetup && newPassword) {
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/rider-app/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.requiresPasswordSetup) {
          setRequiresPasswordSetup(true);
          setError("First time login: please set a new password.");
          return;
        }
        // if (data?.error?.includes("suspended")) {
        //   setError("Your account is suspended. Contact admin.");
        //   return;
        // }
        // If rider does not exist, fall back to registration flow.
        if (data?.error?.toLowerCase()?.includes("invalid credentials")) {
          setLoginStep("register");
          setError("Account not found or password incorrect. You can register if new.");
          return;
        }
        setError(data?.error || "Login failed");
        return;
      }

      localStorage.setItem("sim_rider_phone", loginPhone);
      if (data?.token) localStorage.setItem("sim_rider_token", data.token);

      const loggedRiderId = data?.rider?.id?.toString();
      if (loggedRiderId) {
        setRiderId(loggedRiderId);
        const found = riders.find((r: any) => r.id?.toString() === loggedRiderId);
        if (found?.assignedVehicle) setVehicleId(found.assignedVehicle.id?.toString());
        else if (vehicles.length > 0) setVehicleId(vehicles[0].id?.toString());
      }
      setLoginStep("vehicle");
      setRequiresPasswordSetup(false);
      setNewPassword("");
    } catch {
      setError("Unable to login right now.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/riders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: regName, phone: loginPhone, password: regPassword, status: 0 })
    });
    if (res.ok) {
      const newRider = await res.json();
      setRiders([...riders, newRider]);
      setRiderId(newRider.id?.toString());
      if (vehicles.length > 0) setVehicleId(vehicles[0].id?.toString());
      localStorage.setItem("sim_rider_phone", loginPhone);
      setLoginStep("vehicle");
    } else {
      const data = await res.json().catch(() => ({}));
      const msg =
        data?.error ||
        "Failed to create profile. Ensure details are correct.";
      setError(msg);
      if (res.status === 409 || data?.code === "DUPLICATE_PHONE") {
        setLoginStep("phone");
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsOnline(false);
    localStorage.removeItem("sim_rider_phone");
    localStorage.removeItem("sim_rider_token");
    setLoginStep("phone"); setLoginPhone(""); setRiderId("");
    setLoginPassword(""); setNewPassword(""); setRequiresPasswordSetup(false);
    setShowForgotPassword(false);
    setRiderProfile(null);
  };

  const handleToggleOnlineStatus = () => {
    setIsOnline(!isOnline);
  };

  // ────────────────────────────────────────────────────────────────────────
  // NOT LOGGED IN — Login Screen
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
            {loginStep === "phone" && (
              showForgotPassword ? (
                <ForgotPasswordOtpForm
                  role="rider"
                  onCancel={() => setShowForgotPassword(false)}
                  onSuccess={() => setShowForgotPassword(false)}
                />
              ) : (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Enter Mobile Number</label>
                    <input
                      required type="tel" value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input
                      required
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>
                  {requiresPasswordSetup && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Set New Password</label>
                      <input
                        required
                        minLength={6}
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                  )}
                  <button type="submit" className="w-full py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl">
                    {requiresPasswordSetup ? "Set Password & Continue" : "Login & Continue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="w-full text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Forgot password?
                  </button>
                </form>
              )
            )}

            {loginStep === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                <p className="text-sm text-gray-500 mb-2">Profile not found for <strong>{loginPhone}</strong>. Please register.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input required type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input required type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-white" />
                </div>
                <button type="submit" className="w-full py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl">
                  Create Profile & Continue
                </button>
                <button type="button" onClick={() => setLoginStep("phone")} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                  ← Back
                </button>
              </form>
            )}

            {loginStep === "vehicle" && (
              <div className="space-y-4">
                {currentRider && (
                  <div className="flex items-center gap-3 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800">
                    <div className="h-12 w-12 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-2xl font-bold text-brand-600">
                      {currentRider.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white">{currentRider.name}</p>
                      <p className="text-xs text-gray-500">{currentRider.phone}</p>
                    </div>
                  </div>
                )}
                <button
                  disabled={!riderId}
                  onClick={() => setIsLoggedIn(true)}
                  className="w-full py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-40"
                >
                  Enter Dashboard ➾
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const selectedRider = riderProfile || riders.find((r: any) => r.id?.toString() === riderId);
  const selectedVehicle = riderProfile?.assignedVehicle || vehicles.find((v: any) => v.id?.toString() === vehicleId);

  // ────────────────────────────────────────────────────────────────────────
  // LOGGED IN — Full Dashboard
  // ────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* ── TOP BAR ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 font-extrabold text-lg">
                {selectedRider?.name?.charAt(0)?.toUpperCase() ?? "R"}
              </div>
              <div>
                <p className="font-bold text-gray-800 dark:text-white text-sm">{selectedRider?.name}</p>
                <p className="text-xs text-gray-400">{selectedVehicle?.regNumber} · 🔋{selectedVehicle?.battery}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium px-2 bg-green-50 py-1 rounded-full border border-green-200">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500 font-medium px-2 bg-gray-100 py-1 rounded-full border border-gray-200">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />Offline
                </span>
              )}
              <button
                onClick={handleToggleOnlineStatus}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-all ${isOnline
                  ? "text-red-500 bg-red-50 border-2 border-red-200 hover:bg-red-100"
                  : "text-white bg-green-500 hover:bg-green-600 border-2 border-green-500 shadow-green-500/30"
                  }`}
              >
                {isOnline ? "Go Offline" : "Go Online"}
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all ml-1"
              >
                Logout ➔
              </button>
            </div>
          </div>
        </div>

        {/* ── STATS ROW ─────────────────────────────────────────────────── */}
        {riderProfile?.stats && (
          <div className="bg-gradient-to-r from-brand-600 to-brand-800 px-4 py-4">
            <div className="max-w-7xl mx-auto w-full grid grid-cols-4 gap-3 text-center text-white">
              <div>
                <p className="text-xl font-extrabold">₹{riderProfile.stats.todayEarnings.toFixed(0)}</p>
                <p className="text-xs opacity-70">Today</p>
              </div>
              <div>
                <p className="text-xl font-extrabold">₹{riderProfile.stats.totalEarnings.toFixed(0)}</p>
                <p className="text-xs opacity-70">Total Earned</p>
              </div>
              <div>
                <p className="text-xl font-extrabold">{riderProfile.stats.completedOrders}</p>
                <p className="text-xs opacity-70">Completed</p>
              </div>
              <div>
                <p className="text-xl font-extrabold">{riderProfile.stats.todayOrders}</p>
                <p className="text-xs opacity-70">Today Rides</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TABS ──────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-[65px] z-40">
          <div className="max-w-7xl mx-auto w-full flex">
            {([
              { key: "rides", label: "🛵 Rides" },
              { key: "orders", label: "📋 Orders" },
              { key: "trips", label: "🗺️ Trips" },
              { key: "profile", label: "👤 Profile" },
            ] as { key: Tab; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); if (tab.key === "profile") fetchProfile(); }}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full p-4 space-y-4">
          {/* Messages */}
          {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl dark:bg-red-900/30 dark:text-red-400">⚠️ {error}</div>}
          {successMsg && <div className="p-3 text-sm text-green-600 bg-green-50 rounded-xl dark:bg-green-900/30 dark:text-green-400">{successMsg}</div>}

          {/* ══════════════════════════════════════════════════════════════
              TAB: RIDES (Live Ride Management)
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "rides" && (
            <>
              {phase === "idle" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Ride Requests</h2>
                    <button onClick={fetchRides} className="text-xs text-brand-500 hover:text-brand-700 font-medium">Refresh ↻</button>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-10 text-center">
                      {!isOnline ? (
                        <>
                          <p className="text-4xl mb-3">🛌</p>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">You are offline</p>
                          <p className="text-sm text-gray-400 mt-1">Go online to start receiving ride requests.</p>
                          <button onClick={handleToggleOnlineStatus} className="mt-4 px-6 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">Go Online Now 🟢</button>
                        </>
                      ) : (
                        <>
                          <p className="text-4xl mb-3">📡</p>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">Scanning for duties...</p>
                          <p className="text-sm text-gray-400 mt-1">No ride requests near you right now.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {pendingOrders.map((order) => (
                        <div key={order.id} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm flex flex-col min-h-0">
                          <div className="bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-3 flex items-center justify-between text-white shrink-0">
                            <div>
                              <p className="text-[10px] opacity-80 uppercase tracking-wide">Fare</p>
                              <p className="text-2xl font-extrabold">₹{order.amount ?? "—"}</p>
                            </div>
                            <div className="text-right text-xs opacity-90">
                              <p>💳 {order.paymentMode || "Cash"}</p>
                              <p className="opacity-70">#ORD-{order.id?.toString().padStart(3, "0")}</p>
                            </div>
                          </div>
                          <div className="p-3 space-y-3 flex flex-col flex-1 min-h-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-9 w-9 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold text-sm">
                                {order.customer?.firstName?.charAt(0) ?? "?"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-gray-800 dark:text-white truncate">{order.customer?.firstName} {order.customer?.lastName}</p>
                                <p className="text-xs text-gray-400 truncate">{order.customer?.phone}</p>
                              </div>
                            </div>
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-2 space-y-2 text-xs flex-1 min-h-0">
                              <div className="flex items-start gap-1.5">
                                <span className="text-green-500 shrink-0 mt-0.5">📍</span>
                                <div className="min-w-0">
                                  <p className="text-[10px] text-gray-400">Pickup</p>
                                  <p className="font-medium text-gray-800 dark:text-white line-clamp-3">{order.pickupLoc || "Not specified"}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="text-red-500 shrink-0 mt-0.5">🏁</span>
                                <div className="min-w-0">
                                  <p className="text-[10px] text-gray-400">Drop</p>
                                  <p className="font-medium text-gray-800 dark:text-white line-clamp-3">{order.dropLoc || "Not specified"}</p>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => handleAccept(order)} disabled={loading}
                              className="w-full py-2.5 text-xs font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl disabled:opacity-50 transition-colors shrink-0">
                              {loading ? "Accepting..." : "✅ Accept Ride"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {phase === "accepted" && currentOrder && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-blue-500 p-5 text-white text-center">
                    <p className="text-sm opacity-80 mb-1">Status</p>
                    <p className="text-2xl font-extrabold">🚗 Heading to Pickup</p>
                    <p className="text-sm opacity-80 mt-1">Ask customer for OTP when you arrive</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
                        {currentOrder.customer?.firstName?.charAt(0) ?? "?"}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-white">{currentOrder.customer?.firstName} {currentOrder.customer?.lastName}</p>
                        <a href={`tel:${currentOrder.customer?.phone}`} className="text-brand-500 text-sm font-medium">📞 {currentOrder.customer?.phone}</a>
                      </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2 text-sm">
                      <div className="flex gap-2"><span className="text-green-500">📍</span><div><p className="text-xs text-gray-400">Pickup</p><p className="font-semibold text-gray-800 dark:text-white">{currentOrder.pickupLoc}</p></div></div>
                      <div className="flex gap-2"><span className="text-red-500">🏁</span><div><p className="text-xs text-gray-400">Drop</p><p className="font-semibold text-gray-800 dark:text-white">{currentOrder.dropLoc}</p></div></div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Fare</p>
                      <p className="text-3xl font-extrabold text-brand-600">₹{currentOrder.amount}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
                    <p className="font-bold text-gray-800 dark:text-white mb-1">🔐 Enter Customer OTP</p>
                    <p className="text-sm text-gray-400 mb-4">Ask the customer to show their OTP from the booking confirmation</p>
                    <form onSubmit={handleVerifyOtp} className="flex gap-2">
                      <input type="text" maxLength={4} placeholder="0000" value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                        className="flex-1 px-4 py-3 text-center text-2xl font-mono font-bold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white tracking-widest" />
                      <button type="submit" disabled={loading || otpInput.length !== 4}
                        className="px-5 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-40">
                        {loading ? "..." : "Verify"}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {phase === "started" && currentOrder && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-indigo-600 p-5 text-white text-center">
                    <p className="text-sm opacity-80 mb-1">Trip Status</p>
                    <p className="text-2xl font-extrabold">🛵 Ride in Progress</p>
                    <p className="text-sm opacity-80 mt-1">Head to the drop location</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
                      <div className="flex gap-2"><span className="text-red-500">🏁</span><div><p className="text-xs text-gray-400">Drop Location</p><p className="font-bold text-gray-800 dark:text-white text-base">{currentOrder.dropLoc}</p></div></div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Fare to Collect</p>
                      <p className="text-4xl font-extrabold text-brand-600">₹{currentOrder.amount}</p>
                      <p className="text-sm text-gray-400 mt-0.5">via {currentOrder.paymentMode}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Distance (km) — Optional</label>
                      <input type="number" step="0.1" placeholder="e.g. 12.5" value={distanceTravelled} onChange={(e) => setDistanceTravelled(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <button onClick={handleComplete} disabled={loading}
                      className="w-full py-3.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl disabled:opacity-50 transition-colors">
                      {loading ? "Processing..." : "🏁 Complete Ride & Collect Payment"}
                    </button>
                  </div>
                </div>
              )}

              {phase === "completed" && (
                <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center space-y-4">
                  <div className="text-6xl">🎉</div>
                  <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">Trip Complete!</h2>
                  <p className="text-gray-500 text-sm">{successMsg}</p>
                  <button onClick={resetToIdle} className="w-full py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl">
                    Accept Next Ride →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: ORDERS (All past orders history)
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "orders" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">My Orders</h2>
                <span className="text-xs text-gray-400">{riderProfile?.orders?.length} total</span>
              </div>
              {!riderProfile?.orders || riderProfile.orders.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="font-semibold">No orders yet</p>
                </div>
              ) : (
                riderProfile.orders.map((order: Order) => (
                  <div key={order.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-800 dark:text-white">#ORD-{order.id?.toString().padStart(3, "0")}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-brand-600">₹{order.amount ?? "—"}</p>
                          <p className="text-xs text-gray-400">{order.paymentMode}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-green-500 text-base">📍</span>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">{order.pickupLoc || "—"}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-red-500 text-base">🏁</span>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">{order.dropLoc || "—"}</p>
                        </div>
                      </div>
                      {order.customer && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs">
                            {order.customer.firstName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{order.customer.firstName} {order.customer.lastName}</p>
                            <p className="text-xs text-gray-400">{order.customer.phone}</p>
                          </div>
                          {order.createdAt && (
                            <p className="ml-auto text-xs text-gray-300 dark:text-gray-600">
                              {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: TRIPS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "trips" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">My Trips</h2>
                <span className="text-xs text-gray-400">{riderProfile?.trips?.length ?? 0} total</span>
              </div>
              {!riderProfile?.trips || riderProfile.trips.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">🗺️</p>
                  <p className="font-semibold">No trips recorded yet</p>
                </div>
              ) : (
                riderProfile.trips.map((trip: any) => (
                  <div key={trip.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-gray-800 dark:text-white">Trip #{trip.id}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${trip.status === "completed" ? "bg-green-100 text-green-700" :
                        trip.status === "ongoing" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{trip.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center mt-3">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                        <p className="text-xs text-gray-400">Distance</p>
                        <p className="font-bold text-gray-800 dark:text-white">{trip.distance ?? "—"} km</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                        <p className="text-xs text-gray-400">Fare</p>
                        <p className="font-bold text-brand-600">₹{trip.fare ?? "—"}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                        <p className="text-xs text-gray-400">Date</p>
                        <p className="font-bold text-gray-800 dark:text-white text-xs">
                          {new Date(trip.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                    {(trip.startLoc || trip.endLoc) && (
                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        {trip.startLoc && <p>📍 {trip.startLoc}</p>}
                        {trip.endLoc && <p>🏁 {trip.endLoc}</p>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: PROFILE
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">My Profile</h2>

              {/* Avatar & Name */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white text-2xl font-extrabold">
                  {selectedRider?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">{selectedRider?.name}</p>
                  <p className="text-sm text-gray-400">{selectedRider?.phone}</p>
                  <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${selectedRider?.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}>{selectedRider?.status}</span>
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Total Orders</p>
                  <p className="text-2xl font-extrabold text-gray-800 dark:text-white">{riderProfile?.stats?.totalOrders ?? 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Completed</p>
                  <p className="text-2xl font-extrabold text-green-600">{riderProfile?.stats?.completedOrders ?? 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Total Earnings</p>
                  <p className="text-2xl font-extrabold text-brand-600">₹{riderProfile?.stats?.totalEarnings?.toFixed(0) ?? 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Today's Earn</p>
                  <p className="text-2xl font-extrabold text-indigo-600">₹{riderProfile?.stats?.todayEarnings?.toFixed(0) ?? 0}</p>
                </div>
              </div>

              {/* Vehicle Card */}
              {selectedVehicle && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Assigned Vehicle</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white text-lg">{selectedVehicle.regNumber}</p>
                      <p className="text-sm text-gray-500">{selectedVehicle.model} · {selectedVehicle.type}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <div className={`h-2.5 w-2.5 rounded-full ${selectedVehicle.battery > 40 ? "bg-green-400" : selectedVehicle.battery > 15 ? "bg-yellow-400" : "bg-red-500"}`} />
                        <p className="font-extrabold text-2xl text-gray-700 dark:text-gray-200">{selectedVehicle.battery}%</p>
                      </div>
                      <p className="text-xs text-gray-400">Battery</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Details */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personal Details</p>
                {[
                  { label: "Mobile", value: selectedRider?.phone, icon: "📞" },
                  { label: "Email", value: selectedRider?.email || "Not set", icon: "✉️" },
                  { label: "NID", value: selectedRider?.nid || "Not provided", icon: "🪪" },
                  { label: "Member Since", value: selectedRider?.createdAt ? new Date(selectedRider.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—", icon: "📅" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                    <span className="text-sm text-gray-500">{item.icon} {item.label}</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Logout */}
              <button onClick={handleLogout}
                className="w-full py-3 text-sm font-bold text-red-600 border border-red-200 rounded-2xl hover:bg-red-50 transition-colors">
                🔴 Logout from App
              </button>
            </div>
          )}
        </div>
      </div>
      <GlobalNotificationListener />
    </>
  );
}
