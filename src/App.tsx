import { Route, Routes } from "react-router-dom";
import { SiteShell } from "@/components/layout/SiteShell";
import HomePage from "@/app/page";
import CarsPage from "@/app/cars/page";
import CarDetailPage from "@/app/cars/[id]/page";
import CheckoutPage from "@/app/checkout/page";
import CheckoutSuccessPage from "@/app/checkout/success/page";
import ContractPage from "@/app/contract/page";
import SentPage from "@/app/contract/sent/page";
import LeasePage from "@/app/lease/page";
import MyBookingsPage from "@/app/my-bookings/page";
import BookingDetailPage from "@/app/my-bookings/[id]/page";
import MyLeasesPage from "@/app/my-leases/page";
import ServicesPage from "@/app/services/page";
import AdminLayout from "@/app/admin/layout";
import AdminPage from "@/app/admin/page";
import AuthLayout from "@/app/auth/layout";
import LoginPage from "@/app/auth/login/page";
import VerifyEmailPage from "@/app/auth/verify-email/page";
import ResetPasswordPage from "@/app/auth/reset-password/page";
import UpdatePasswordPage from "@/app/auth/update-password/page";
import GoogleCallbackPage from "@/app/auth/google/callback/page";

export default function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
      <Route path="/auth/verify-email" element={<AuthLayout><VerifyEmailPage /></AuthLayout>} />
      <Route path="/auth/reset-password" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
      <Route path="/auth/update-password" element={<AuthLayout><UpdatePasswordPage /></AuthLayout>} />
      <Route path="/auth/google/callback" element={<AuthLayout><GoogleCallbackPage /></AuthLayout>} />

      <Route element={<SiteShell />}>
        <Route index element={<HomePage />} />
        <Route path="cars" element={<CarsPage />} />
        <Route path="cars/:id" element={<CarDetailPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="contract" element={<ContractPage />} />
        <Route path="contract/sent" element={<SentPage />} />
        <Route path="lease" element={<LeasePage />} />
        <Route path="my-bookings" element={<MyBookingsPage />} />
        <Route path="my-bookings/:id" element={<BookingDetailPage />} />
        <Route path="my-leases" element={<MyLeasesPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="admin" element={<AdminLayout><AdminPage /></AdminLayout>} />
      </Route>
    </Routes>
  );
}
