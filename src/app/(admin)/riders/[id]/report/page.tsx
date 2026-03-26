import React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import BarChartOne from "@/components/charts/bar/BarChartOne";
import LineChartOne from "@/components/charts/line/LineChartOne";
import type { Metadata } from "next";

type Rider = {
  id: string;
  name: string;
  phone: string;
  status: "Available" | "Busy" | "Offline";
  totalDeliveries: number;
};

type DeliveryStatus = "Delivered" | "In Transit" | "Cancelled";

type Delivery = {
  id: string;
  date: string;
  pickup: string;
  dropoff: string;
  status: DeliveryStatus;
  distanceKm: number;
};

const RIDERS: Record<string, Rider> = {
  "RID-001": {
    id: "RID-001",
    name: "Mike Swift",
    phone: "+1 987 654 321",
    status: "Available",
    totalDeliveries: 156,
  },
  "RID-002": {
    id: "RID-002",
    name: "Leo Bolt",
    phone: "+1 987 654 322",
    status: "Busy",
    totalDeliveries: 89,
  },
  "RID-003": {
    id: "RID-003",
    name: "Sarah Dash",
    phone: "+1 987 654 323",
    status: "Available",
    totalDeliveries: 124,
  },
  "RID-004": {
    id: "RID-004",
    name: "Tom Racer",
    phone: "+1 987 654 324",
    status: "Offline",
    totalDeliveries: 45,
  },
  "RID-005": {
    id: "RID-005",
    name: "Anna Sprint",
    phone: "+1 987 654 325",
    status: "Available",
    totalDeliveries: 210,
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const safeRiderId = id ?? "UNKNOWN";
  const rider = RIDERS[safeRiderId];
  const riderLabel = rider ? `${rider.name} (${rider.id})` : safeRiderId;

  return {
    title: `Rider Report - ${riderLabel} | Kandi`,
    description: `Performance, analytics, and delivery history report for rider ${riderLabel}.`,
  };
}

function statusToBadge(status: DeliveryStatus) {
  switch (status) {
    case "Delivered":
      return { color: "success" as const, variant: "solid" as const };
    case "In Transit":
      return { color: "warning" as const, variant: "solid" as const };
    case "Cancelled":
      return { color: "error" as const, variant: "solid" as const };
  }
}

function buildDeliveryHistory(riderId: string): Delivery[] {
  // Deterministic-ish dummy data so each rider has slightly different values.
  const seed = riderId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = seed % 7;
  const mk = (n: number) => (base + n) * 1.3 + 2.4;
  const fmt = (d: number) =>
    d === 0 ? "2026-03-26" : `2026-03-${String(26 - d).padStart(2, "0")}`;

  return [
    {
      id: `${riderId}-DLV-${100 + base}`,
      date: fmt(0),
      pickup: "Warehouse A",
      dropoff: "Downtown Station",
      status: "Delivered",
      distanceKm: Number(mk(1).toFixed(1)),
    },
    {
      id: `${riderId}-DLV-${101 + base}`,
      date: fmt(1),
      pickup: "Warehouse B",
      dropoff: "North Apartments",
      status: "In Transit",
      distanceKm: Number(mk(2).toFixed(1)),
    },
    {
      id: `${riderId}-DLV-${102 + base}`,
      date: fmt(2),
      pickup: "Warehouse C",
      dropoff: "Central Market",
      status: "Delivered",
      distanceKm: Number(mk(3).toFixed(1)),
    },
    {
      id: `${riderId}-DLV-${103 + base}`,
      date: fmt(3),
      pickup: "Warehouse A",
      dropoff: "Riverside Clinic",
      status: "Cancelled",
      distanceKm: Number(mk(4).toFixed(1)),
    },
    {
      id: `${riderId}-DLV-${104 + base}`,
      date: fmt(4),
      pickup: "Warehouse B",
      dropoff: "University Campus",
      status: "Delivered",
      distanceKm: Number(mk(5).toFixed(1)),
    },
  ];
}

export default async function RiderReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const safeRiderId = id ?? "UNKNOWN";

  const rider = RIDERS[safeRiderId] ?? {
    id: safeRiderId,
    name: "Unknown Rider",
    phone: "-",
    status: "Offline" as const,
    totalDeliveries: 0,
  };

  const history = buildDeliveryHistory(rider.id);

  const deliveredCount = history.filter((d) => d.status === "Delivered").length;
  const inTransitCount = history.filter((d) => d.status === "In Transit").length;
  const cancelledCount = history.filter((d) => d.status === "Cancelled").length;

  const totalDistanceKm = history.reduce((sum, d) => sum + d.distanceKm, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Rider Report
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {rider.name} · {rider.id}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/riders"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-white/90"
          >
            Back to Rider List
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Monthly Deliveries
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Deliveries by month (sample data)
              </p>
            </div>
          </div>
          <div className="mt-4">
            <BarChartOne />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Delivery Efficiency
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              On-time vs completed (sample data)
            </p>
          </div>
          <div className="mt-4">
            <LineChartOne />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Rider Performance Summary
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quick KPIs for deliveries, active routes, and distance covered.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Deliveries</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {rider.totalDeliveries}
          </p>
          <p className="text-xs text-success-500 mt-1">
            {deliveredCount} delivered in recent history
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">In Transit</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {inTransitCount}
          </p>
          <p className="text-xs text-warning-500 mt-1">Currently active routes</p>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cancelled</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {cancelledCount}
          </p>
          <p className="text-xs text-error-500 mt-1">
            {totalDistanceKm.toFixed(1)} km in recent history
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/[0.05]">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Rider Delivery History
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Recent trips for {rider.name} with route status and distance.
          </p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Delivery ID
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Date
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Pickup
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Dropoff
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Status
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                    Distance
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {history.map((d) => {
                  const badge = statusToBadge(d.status);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="px-5 py-4 text-start font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {d.id}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                        {d.date}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                        {d.pickup}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                        {d.dropoff}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <Badge
                          size="sm"
                          variant={badge.variant}
                          color={badge.color}
                        >
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end text-gray-500 text-theme-sm dark:text-gray-400">
                        {d.distanceKm.toFixed(1)} km
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

