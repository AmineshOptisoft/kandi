"use client";
import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Select from "@/components/form/Select";
import Link from "next/link";

interface Rider {
  id: string;
  name: string;
  phone: string;
  status: "Available" | "Busy" | "Offline";
  totalDeliveries: number;
}

const tableData: Rider[] = [
  {
    id: "RID-001",
    name: "Mike Swift",
    phone: "+1 987 654 321",
    status: "Available",
    totalDeliveries: 156,
  },
  {
    id: "RID-002",
    name: "Leo Bolt",
    phone: "+1 987 654 322",
    status: "Busy",
    totalDeliveries: 89,
  },
  {
    id: "RID-003",
    name: "Sarah Dash",
    phone: "+1 987 654 323",
    status: "Available",
    totalDeliveries: 124,
  },
  {
    id: "RID-004",
    name: "Tom Racer",
    phone: "+1 987 654 324",
    status: "Offline",
    totalDeliveries: 45,
  },
  {
    id: "RID-005",
    name: "Anna Sprint",
    phone: "+1 987 654 325",
    status: "Available",
    totalDeliveries: 210,
  },
];

export default function RiderList() {
  const statusOptions = [
    { value: "Available", label: "Available" },
    { value: "Busy", label: "Busy" },
    { value: "Offline", label: "Offline" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Rider Management
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="w-full sm:w-48">
            <Select
              options={statusOptions}
              placeholder="Filter by Status"
              onChange={(val) => console.log(val)}
            />
          </div>
          <Link
            href="/riders/add"
            className="flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Add New Rider
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Rider ID
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Name
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Phone
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Status
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Total Deliveries
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {tableData.map((rider) => (
                  <TableRow key={rider.id}>
                    <TableCell className="px-5 py-4 text-start font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      {rider.id}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                      {rider.name}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                      {rider.phone}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge
                        size="sm"
                        color={
                          rider.status === "Available"
                            ? "success"
                            : rider.status === "Busy"
                            ? "warning"
                            : "dark"
                        }
                      >
                        {rider.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                      {rider.totalDeliveries}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-end">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          title={`Edit ${rider.name}`}
                          className="text-brand-500 hover:text-brand-600 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/riders/${rider.id}/report`}
                          title={`View report for ${rider.name}`}
                          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
                        >
                          Report
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
