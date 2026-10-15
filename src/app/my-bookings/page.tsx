import { MyBookingsClient } from "@/components/booking/MyBookingsClient";

export default function MyBookingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">My bookings</h1>
      <p className="mt-2 text-slate-600">Track reservations and continue payment if needed.</p>

      <MyBookingsClient
        initialBookings={[]}
        carMap={{}}
        initialReviews={[]}
      />
    </div>
  );
}
