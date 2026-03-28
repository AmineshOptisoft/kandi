"use client";
import React, { useState, useEffect, useContext } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useRouter } from "next/navigation";
import { UserContext } from "../layout";
import Autocomplete from "react-google-autocomplete";

// ─── Client-side Haversine ──────────────────────────────────────────────────
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcFare(km: number): number {
  return Math.round(50 + 15 * km);
}

function calcTime(km: number): number {
  return Math.round((km / 20) * 60);
}

export default function BookRidePage() {
  const router = useRouter();
  const { user: activeUser } = useContext(UserContext);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    pickupLoc: "",
    pickupLat: "",
    pickupLng: "",
    dropLoc: "",
    dropLat: "",
    dropLng: "",
    paymentMode: "Cash",
  });

  // Handlers for address selection
  const handlePickupSelected = (place: any) => {
    if (!place.geometry) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setFormData(prev => ({
      ...prev,
      pickupLoc: place.formatted_address,
      pickupLat: lat.toString(),
      pickupLng: lng.toString()
    }));
  };

  const handleDropSelected = (place: any) => {
    if (!place.geometry) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setFormData(prev => ({
      ...prev,
      dropLoc: place.formatted_address,
      dropLat: lat.toString(),
      dropLng: lng.toString()
    }));
  };

  // Sync with Global User Context
  useEffect(() => {
    if (activeUser) {
      setFormData(prev => ({
        ...prev,
        firstName: activeUser.firstName,
        lastName: activeUser.lastName,
        email: activeUser.email,
        phone: activeUser.phone,
      }));
      setStep(1);
    } else {
      setStep(0);
    }
  }, [activeUser]);

  // Fetch customers
  useEffect(() => {
    fetch("/api/customers")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedCustomerId(cid);
    const customer = customers.find(c => c.id.toString() === cid);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      }));
      setStep(1);
    }
  };

  const [estimate, setEstimate] = useState<{
    distance: number;
    fare: number;
    timeMin: number;
  } | null>(null);

  useEffect(() => {
    const pLat = parseFloat(formData.pickupLat);
    const pLng = parseFloat(formData.pickupLng);
    const dLat = parseFloat(formData.dropLat);
    const dLng = parseFloat(formData.dropLng);

    if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng)) {
      const dist = calcDistance(pLat, pLng, dLat, dLng);
      setEstimate({
        distance: parseFloat(dist.toFixed(2)),
        fare: calcFare(dist),
        timeMin: calcTime(dist),
      });
    } else {
      setEstimate(null);
    }
  }, [formData.pickupLat, formData.pickupLng, formData.dropLat, formData.dropLng]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(null);

    try {
      const res = await fetch("/api/book-ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to place ride request.");
      else setSuccess(data);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const { order, nearbyRiders } = success;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-2xl text-white shadow-md">✅</div>
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">Ride Request Placed!</h2>
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">A rider will be assigned to you shortly.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-gray-800 dark:text-white/90">Trip Summary</h3>
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white text-center shadow-lg">
            <p className="text-sm opacity-80 mb-1">Estimated Fare</p>
            <p className="text-5xl font-extrabold tracking-tight">₹{order.amount}</p>
            <div className="mt-4 flex justify-center gap-6 text-sm opacity-90 font-bold uppercase tracking-tighter">
              <span>📍 {order.distance} km</span>
              <span>⏱ ~{calcTime(order.distance)} min</span>
              <span>💳 {order.paymentMode}</span>
            </div>
          </div>

          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 p-6 text-center shadow-inner">
            <p className="text-xs text-brand-500 uppercase font-black tracking-[0.2em] mb-3">Your Security OTP</p>
            <p className="text-6xl font-mono font-black text-brand-600 dark:text-brand-300 tracking-[0.4em]">{order.otp}</p>
          </div>

          <button onClick={() => router.push(`/user/track/${order.id}`)} className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all">Track Order Live 🛰️</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Book Your Kadi Ride</h2>
        <p className="mt-1 text-sm text-gray-500">Go green, go Kadi. Fast e-bikes at your doorstep.</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-8 dark:border-white/[0.05] dark:bg-white/[0.03] shadow-2xl">
        {error && <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 rounded-2xl border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* {step === 0 && (
             <div className="space-y-4">
                <Label>Select Your Profile</Label>
                <select value={selectedCustomerId} onChange={handleSelectCustomer} className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:bg-gray-800 outline-none">
                    <option value="">Choose profile...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
                <button type="button" onClick={() => setStep(1)} className="w-full text-brand-600 font-bold text-sm">Or Enter Manually ↓</button>
             </div>
          )}

          {step === 1 && ( */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={formData.firstName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={formData.lastName} onChange={handleChange} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={formData.phone} onChange={handleChange} required />
            </div>
            <button type="button" onClick={() => setStep(2)} className="w-full py-4 bg-brand-500 text-white font-bold rounded-2xl shadow-lg hover:bg-brand-600 transition-all">Confirm Details →</button>
          </div>
          {/* )} */}

          {step === 2 && (
            <>
              {/* Pickup */}
              <div className="space-y-2">
                <Label>🏫 Pickup Location</Label>
                <Autocomplete
                  apiKey={apiKey}
                  onPlaceSelected={handlePickupSelected}
                  defaultValue={formData.pickupLoc}
                  options={{ types: ["geocode", "establishment"], componentRestrictions: { country: "in" } }}
                  className="w-full h-14 px-5 rounded-2xl border-2 border-gray-100 dark:bg-gray-800 outline-none focus:border-brand-500 transition-all font-medium"
                  placeholder="Where from? Search your area..."
                />
              </div>

              {/* Drop */}
              <div className="space-y-2">
                <Label>📍 Destination Address</Label>
                <Autocomplete
                  apiKey={apiKey}
                  onPlaceSelected={handleDropSelected}
                  defaultValue={formData.dropLoc}
                  options={{ types: ["geocode", "establishment"], componentRestrictions: { country: "in" } }}
                  className="w-full h-14 px-5 rounded-2xl border-2 border-gray-100 dark:bg-gray-800 outline-none focus:border-brand-500 transition-all font-medium"
                  placeholder="Where to? Enter drop point..."
                />
              </div>

              {estimate && (
                <div className="p-6 rounded-3xl bg-brand-500 text-white shadow-xl space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Estimated Fare</p>
                  <div className="flex items-center justify-between">
                    <p className="text-4xl font-black">₹{estimate.fare}</p>
                    <div className="text-right">
                      <p className="text-xs font-bold">{estimate.distance} KM</p>
                      <p className="text-[10px] opacity-70">~{estimate.timeMin} mins</p>
                    </div>
                  </div>
                </div>
              )}

              <select id="paymentMode" value={formData.paymentMode} onChange={handleChange as any} className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:bg-gray-800">
                <option value="Cash">💵 Cash on Delivery</option>
                <option value="UPI">📱 UPI Payment</option>
              </select>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-bold">Back</button>
                <button type="submit" disabled={loading || !formData.pickupLoc || !formData.dropLoc} className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-40">{loading ? "Booking..." : "Confirm Kadi Ride 🚀"}</button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
