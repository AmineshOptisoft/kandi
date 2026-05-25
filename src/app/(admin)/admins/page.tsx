import type { Metadata } from "next";
import AdminsList from "@/components/admins/AdminsList";

export const metadata: Metadata = {
  title: "Admin Management | TePay Admin",
  description: "Create and manage system administrators and roles",
};

export default function AdminsPage() {
  return <AdminsList />;
}
