"use client";
import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";

function LogoBrand() {
  const [imgError, setImgError] = useState(false);

  return (
    <Link href="/" className="block mb-4 flex items-center gap-3">
      {imgError ? (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white text-3xl font-extrabold shadow-lg">
          K
        </span>
      ) : (
        <img
          width={150}
          height={40}
          src="/images/logo/kandi-logo.png"
          alt="Logo"
          className="object-contain"
          onError={() => setImgError(true)}
        />
      )}
    </Link>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col dark:bg-gray-900 sm:p-0">
          {children}
          <div className="lg:w-1/2 w-full h-full bg-[#006600] dark:bg-[#003300] lg:grid items-center hidden">
            <div className="relative items-center justify-center flex z-1">
              <GridShape />
              <div className="flex flex-col items-center max-w-xs">
                <LogoBrand />
                <p className="text-center text-gray-400 dark:text-white/60">
                  Kadi E-bike Delivery Management System
                </p>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
