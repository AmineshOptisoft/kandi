import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js SignUp Page | Kadi - E-bike Delivery Admin Panel",
  description: "This is Next.js SignUp Page for Kadi Admin Dashboard Template",
};

export default function SignUp() {
  return <SignUpForm />;
}
