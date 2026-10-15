import AdminDashboardClient from "./AdminDashboardClient";

export default function AdminPage() {
  return (
    <AdminDashboardClient
      bookings={[]}
      cars={[]}
      leaseRequests={[]}
      reviews={[]}
    />
  );
}
