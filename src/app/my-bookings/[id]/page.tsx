import { Link, useParams } from "react-router-dom";

export default function BookingDetailPage() {
  const { id } = useParams();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/my-bookings" className="text-sm font-medium text-brand-600 hover:underline">
        ← My Bookings
      </Link>
      <p className="mt-6 text-slate-600">Booking {id} was not found.</p>
    </div>
  );
}
