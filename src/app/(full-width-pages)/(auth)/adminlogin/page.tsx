import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login | Kadi - E-bike Delivery Admin Panel",
  description: "Admin login for Kadi delivery management dashboard.",
};

export default function AdminLoginPage() {
  return <SignInForm />;
}
