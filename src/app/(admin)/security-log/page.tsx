import type { Metadata } from "next";
import SecurityLog from "@/components/security-log/SecurityLog";

export const metadata: Metadata = {
  title: "Security Deposit Log | TePay Admin",
  description: "Track all security deposit additions and deductions",
};

export default function SecurityLogPage() {
  return <SecurityLog />;
}
