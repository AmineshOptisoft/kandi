import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js SignIn Page | Kadi - E-bike Delivery Admin Panel",
  description: "This is Next.js SignIn Page for Kadi Admin Dashboard Template",
};

export default function SignIn() {
  return <SignInForm />;
}
