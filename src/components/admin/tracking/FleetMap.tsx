"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default marker icons in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const riderIconFree = L.divIcon({
  html: `<div class="relative"><div class="h-5 w-5 rounded-full bg-green-500 border-2 border-white shadow-xl animate-pulse"></div><div class="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[8px] font-bold text-gray-800 bg-white/80 px-1 rounded">Rider</div></div>`,
  className: "custom-div-icon",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const riderIconBusy = L.divIcon({
  html: `<div class="relative"><div class="h-5 w-5 rounded-full bg-orange-500 border-2 border-white shadow-xl"></div><div class="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[8px] font-bold text-gray-800 bg-white/80 px-1 rounded">On Trip</div></div>`,
  className: "custom-div-icon",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface Rider {
  riderId: number;
  lat: number;
  lng: number;
  status: "free" | "busy";
  vehicleId?: number;
}

// Sub-component to auto-refocus map on update
function MapUpdater({ riders }: { riders: Rider[] }) {
  const map = useMap();
  useEffect(() => {
    if (riders.length > 0) {
      const bounds = L.latLngBounds(riders.map(r => [r.lat, r.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [riders, map]);
  return null;
}

export default function FleetMap({ riders }: { riders: Rider[] }) {
  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-white/[0.05] shadow-xl z-0">
      <MapContainer 
        center={[28.6139, 77.2090]} // New Delhi default
        zoom={12} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Night mode map provider shortcut
          // url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {riders.map((rider) => (
          <Marker 
            key={rider.riderId} 
            position={[rider.lat, rider.lng]}
            icon={rider.status === "free" ? riderIconFree : riderIconBusy}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <p className="font-bold text-sm">Rider ID: #RID-{rider.riderId}</p>
                <p className="text-xs text-gray-500">Vehicle: #VEC-{rider.vehicleId || 'N/A'}</p>
                <p className="text-xs">Status: <span className={rider.status === 'free' ? 'text-green-600' : 'text-orange-600'}>● {rider.status.toUpperCase()}</span></p>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapUpdater riders={riders} />
      </MapContainer>
    </div>
  );
}
