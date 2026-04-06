"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { VEHICLE_STATUS } from "@/lib/constants";

interface Vehicle {
  id: number;
  regNumber: string;
  model: string;
  type: string;
  battery: number;
  status: string;
  image: string | null;
  _count: { trips: number };
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-transparent dark:text-white/90";

const EMPTY_FORM = {
  regNumber: "",
  model: "",
  type: "electric",
  battery: "100",
  status: VEHICLE_STATUS.AVAILABLE,
};

export default function EbikesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVehicles = async () => {
    try {
      const res = await fetch("/api/vehicles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVehicles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const resetImageState = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    resetImageState();
    setDrawerOpen(true);
  };

  const openEdit = async (id: number) => {
    setEditId(id);
    setFormError("");
    resetImageState();
    const res = await fetch(`/api/vehicles/${id}`);
    const data = await res.json();
    setForm({
      regNumber: data.regNumber,
      model: data.model,
      type: data.type,
      battery: String(data.battery),
      status: data.status,
    });
    if (data.image) setExistingImage(data.image);
    setDrawerOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image must be less than 5MB");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExistingImage(null); // override existing
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return existingImage; // keep existing if no new file

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.url;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      // 1. Upload image first if new file selected
      const imageUrl = await uploadImage();

      // 2. Save vehicle with image URL
      const method = editId ? "PUT" : "POST";
      const url = editId ? `/api/vehicles/${editId}` : "/api/vehicles";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          battery: parseInt(form.battery),
          image: imageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchVehicles();
      setDrawerOpen(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this vehicle?")) return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusColor = (status: any) =>
    (status === VEHICLE_STATUS.AVAILABLE || status === "available") ? "success" : (status === VEHICLE_STATUS.IN_USE || status === "in_use") ? "warning" : "dark";

  const getStatusLabel = (status: any) => {
    if (status === VEHICLE_STATUS.AVAILABLE || status === "available") return "Available";
    if (status === VEHICLE_STATUS.IN_USE || status === "in_use") return "In Use";
    if (status === VEHICLE_STATUS.MAINTENANCE || status === "maintenance") return "Maintenance";
    return String(status).replace("_", " ");
  };

  const batteryColor = (pct: number) =>
    pct >= 60 ? "text-success-600" : pct >= 30 ? "text-warning-500" : "text-error-500";

  if (loading) return <div className="p-6">Loading vehicles...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">E-Bikes List</h2>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Add New E-Bike
        </button>
      </div>

      {error && <div className="p-4 rounded-lg bg-error-50 text-error-600 text-sm">{error}</div>}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[950px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  {["Image", "ID", "Reg. Number", "Model", "Type", "Battery", "Status", "Actions"].map((h) => (
                    <TableCell key={h} isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    {/* Image thumbnail */}
                    <TableCell className="px-5 py-3 text-start">
                      {v.image ? (
                        <div className="relative h-12 w-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img
                            src={v.image}
                            alt={v.model}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      #{v.id}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start font-medium text-brand-600 text-theme-sm dark:text-brand-400">
                      {v.regNumber}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-600 text-theme-sm dark:text-gray-300">
                      {v.model}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400 capitalize">
                      {v.type}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${v.battery >= 60 ? "bg-success-500" : v.battery >= 30 ? "bg-warning-400" : "bg-error-500"}`}
                            style={{ width: `${v.battery}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${batteryColor(v.battery)}`}>
                          {v.battery}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge size="sm" color={statusColor(v.status)}>
                        {getStatusLabel(v.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(v.id)} className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(v.id)} className="text-error-500 hover:text-error-600 text-sm font-medium">
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {vehicles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="px-5 py-12 text-center text-gray-400">
                      No vehicles found. Add your first E-Bike!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Slide-in Drawer */}
      <div className={`fixed inset-0 z-[100] ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button
          aria-label="Close drawer"
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setDrawerOpen(false)}
        />
        <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-white p-6 shadow-xl transition-transform duration-300 dark:bg-gray-900 overflow-y-auto ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {editId ? "Edit E-Bike" : "Add New E-Bike"}
            </h3>
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]"
            >
              Close
            </button>
          </div>

          {formError && (
            <div className="mb-4 rounded-lg bg-error-50 border border-error-200 p-3 text-sm text-error-600">
              {formError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Vehicle Image
              </label>

              {/* Preview */}
              {(imagePreview || existingImage) && (
                <div className="relative mb-3 h-40 w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <img
                    src={imagePreview || existingImage!}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => { resetImageState(); }}
                    className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Upload zone */}
              {!imagePreview && !existingImage && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                >
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Click to upload image</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · Max 5MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />

              {imagePreview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs text-brand-500 hover:text-brand-600 font-medium"
                >
                  Change image
                </button>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Registration Number <span className="text-error-500">*</span>
              </label>
              <input value={form.regNumber} onChange={(e) => setForm({ ...form, regNumber: e.target.value })} required placeholder="e.g. MH-01-AB-1234" className={inputCls} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Model <span className="text-error-500">*</span>
              </label>
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required placeholder="e.g. Ather 450X" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Battery (%)</label>
                <input type="number" min="0" max="100" value={form.battery} onChange={(e) => setForm({ ...form, battery: e.target.value })} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: Number(e.target.value) })} className={inputCls}>
                <option value={VEHICLE_STATUS.AVAILABLE}>Available</option>
                <option value={VEHICLE_STATUS.IN_USE}>In Use</option>
                <option value={VEHICLE_STATUS.MAINTENANCE}>Maintenance</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]">
                Cancel
              </button>
              <button type="submit" disabled={saving || uploading} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                {uploading ? "Uploading..." : saving ? "Saving..." : editId ? "Save Changes" : "Add E-Bike"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
