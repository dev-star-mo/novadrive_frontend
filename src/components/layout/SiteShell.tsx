"use client";

import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AppUIProvider } from "@/components/providers/app-ui-provider";
import { AuthModal } from "@/components/auth/AuthModal";
import { BookingModal } from "@/components/booking/BookingModal";
import { WhatsAppFAB } from "@/components/layout/WhatsAppFAB";

export function SiteShell() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("denied") === "admin") {
      params.delete("denied");
      const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  return (
    <AppUIProvider>
      <SiteHeader />
      <main><Outlet /></main>
      <SiteFooter />
      <AuthModal />
      <BookingModal />
      <WhatsAppFAB />
    </AppUIProvider>
  );
}
