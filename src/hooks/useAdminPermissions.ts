"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { allPermissionsGranted, noPermissionsGranted } from "@/lib/admin-permissions";
import type { AdminPermissions } from "@/lib/admin-permissions";

export type AdminPermissionsState = {
  permissions: AdminPermissions;
  isSuperAdmin: boolean;
  loading: boolean;
  /** Quick helper: returns true if super-admin OR the specific permission is granted */
  can: (perm: keyof AdminPermissions) => boolean;
};

export function useAdminPermissions(): AdminPermissionsState {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermissions>(noPermissionsGranted());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // Not an admin session — no permissions
    if (!user || user.role !== "admin") {
      setPermissions(noPermissionsGranted());
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    // SUPER_ADMIN — grant everything immediately from the client-side role flag
    if (user.adminRole === "SUPER_ADMIN") {
      setPermissions(allPermissionsGranted());
      setIsSuperAdmin(true);
      setLoading(false);
      return;
    }

    // Regular ADMIN — fetch their specific permission map
    let cancelled = false;
    setLoading(true);

    fetch("/api/admin/me/permissions", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; isSuperAdmin?: boolean; permissions?: AdminPermissions }) => {
        if (cancelled) return;
        if (data.ok && data.permissions) {
          setPermissions(data.permissions);
          setIsSuperAdmin(data.isSuperAdmin ?? false);
        } else {
          setPermissions(noPermissionsGranted());
          setIsSuperAdmin(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPermissions(noPermissionsGranted());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const can = (perm: keyof AdminPermissions) => isSuperAdmin || permissions[perm] === true;

  return { permissions, isSuperAdmin, loading, can };
}
