"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom Leaflet icons
const pickupIcon = L.divIcon({
  html: `<div class="p-1 bg-green-500 rounded-full border-2 border-white shadow-xl"><div class="h-4 w-4 text-white flex items-center justify-center font-bold text-[10px]">P</div></div>`,
  className: "custom-div-icon",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const dropIcon = L.divIcon({
  html: `<div class="p-1 bg-red-500 rounded-full border-2 border-white shadow-xl"><div class="h-4 w-4 text-white flex items-center justify-center font-bold text-[10px]">D</div></div>`,
  className: "custom-div-icon",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const riderIcon = L.divIcon({
  html: `<div class="relative"><div class="h-8 w-8 rounded-full bg-brand-500 border-4 border-white shadow-2xl animate-pulse flex items-center justify-center text-lg">🛵</div></div>`,
  className: "custom-div-icon",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Helper component for map refocusing and route fetching
function MapFocus({ riderPos, pickup, drop, setRoute }: any) {
  const map = useMap();

  useEffect(() => {
    // 1. Zoom and fit all relevant points
    const points: [number, number][] = [pickup, drop];
    if (riderPos) points.push([riderPos.lat, riderPos.lng]);
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50] });

    // 2. Fetch OSRM Route
    async function fetchRoute() {
      try {
        const start = riderPos ? `${riderPos.lng},${riderPos.lat}` : `${pickup[1]},${pickup[0]}`;
        const end = `${drop[1]},${drop[0]}`;
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=simplified&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          setRoute(coords);
        }
      } catch (err) {
        console.error("Routing error:", err);
      }
    }
    fetchRoute();
  }, [riderPos, pickup, drop, map, setRoute]);

  return null;
}

interface CustomerTrackMapProps {
  riderPos: { lat: number; lng: number } | null;
  pickup: [number, number];
  drop: [number, number];
  status?: string;
}

export default function CustomerTrackMap({ riderPos, pickup, drop, status }: CustomerTrackMapProps) {
  const [route, setRoute] = useState<[number, number][]>([]);

  return (
    <div className="h-full w-full z-0 overflow-hidden relative">
      <MapContainer 
        center={pickup} 
        zoom={14} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Night mode fallback
          // url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Route Line */}
        {route.length > 0 && (
          <Polyline positions={route} pathOptions={{ color: "#3B82F6", weight: 6, opacity: 0.6, dashArray: '1, 12' }} />
        )}

        {/* Static Markers */}
        <Marker position={pickup} icon={pickupIcon} />
        <Marker position={drop} icon={dropIcon} />

        {/* Live Rider Marker */}
        {riderPos && (
          <Marker 
            position={[riderPos.lat, riderPos.lng]} 
            icon={riderIcon}
            // Smooth marker moves using transition-all CSS in divIcon? 
            // Leaflet standard marker doesn't easily transition, but divIcon does
          />
        )}

        {/* Refocus Helper */}
        <MapFocus riderPos={riderPos} pickup={pickup} drop={drop} setRoute={setRoute} />
      </MapContainer>
    </div>
  );
}
