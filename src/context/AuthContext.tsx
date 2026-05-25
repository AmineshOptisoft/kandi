"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "agent" | "company";

export type UserSession = {
  id: string;
  username: string;
  role: UserRole;
  companyId?: number;
  agentId?: number;
  adminRole?: "SUPER_ADMIN" | "ADMIN";
};

type AuthContextValue = {
  user: UserSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setUser({
            id: data.role === "admin" ? "admin" : data.role === "agent" ? String(data.agentId) : String(data.companyId),
            username: data.username || "",
            role: data.role,
            companyId: data.companyId,
            agentId: data.agentId,
            adminRole: data.adminRole,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return { user: null, loading: false, refresh: async () => {} };
  }
  return ctx;
}
