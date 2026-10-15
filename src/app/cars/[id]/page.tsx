import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CarDetailActions } from "@/components/cars/CarDetailActions";
import { CarImageGallery } from "@/components/cars/CarImageGallery";
import { fetchVehicle, type ShownVehicle, type UpdateVehiclePayload } from "@/lib/auth/laravel-client";

const SHOW_BODY: UpdateVehiclePayload = {
  name: "",
  slug: "",
  make: "",
  model: "",
  category: "",
  transmission: "",
  fuel_type: "",
  seats: 0,
  engine: null,
  max_speed: null,
  location: "",
  insurance: "",
  keyless_entry: false,
  gps: false,
  rear_camera: false,
  description: "",
  daily_rate_per_day: 0,
  weekly_rate_per_day: null,
  monthly_rate_per_day: null,
  featured_image: {},
  gallery: [],
  units: 0,
  available: false,
  is_active: false,
};

export default function CarDetailPage() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<ShownVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError("Vehicle not found.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchVehicle(id, SHOW_BODY).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setVehicle(null);
        setError(result.error);
      } else {
        setVehicle(result.vehicle);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/cars" className="text-sm font-medium text-brand-600 hover:underline">
        ← Back to fleet
      </Link>
      {loading ? <p className="mt-6 text-slate-600">Loading vehicle…</p> : null}
      {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
      {vehicle ? (
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          {vehicle.image_url || vehicle.images?.length ? (
            <CarImageGallery
              make={vehicle.make}
              model={vehicle.model}
              image_url={vehicle.image_url}
              images={vehicle.images}
              soldOut={vehicle.units_available === 0}
            />
          ) : null}
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">
              {vehicle.make} {vehicle.model}
            </h1>
            <p className="mt-1 text-slate-500">{vehicle.name}</p>
            <p className="mt-1 text-slate-500">{vehicle.location}</p>
            <p className="mt-4 text-slate-600">{vehicle.description}</p>
            <dl className="mt-8 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <Row label="Slug" value={vehicle.slug ?? ""} />
              <Row label="Category" value={vehicle.category ?? ""} />
              <Row label="Per day" value={`$ ${Number(vehicle.price_per_day).toLocaleString()}`} />
              {vehicle.price_per_week != null ? (
                <Row label="Per week" value={`$ ${Number(vehicle.price_per_week).toLocaleString()}`} />
              ) : null}
              {vehicle.price_per_month != null ? (
                <Row label="Per month" value={`$ ${Number(vehicle.price_per_month).toLocaleString()}`} />
              ) : null}
              <Row label="Seats / transmission / fuel" value={`${vehicle.seats} · ${vehicle.transmission} · ${vehicle.fuel_type}`} />
              <Row label="Engine" value={vehicle.engine == null ? "" : String(vehicle.engine)} />
              <Row label="Max speed" value={vehicle.max_speed == null ? "" : String(vehicle.max_speed)} />
              <Row label="Insurance" value={vehicle.insurance} />
              <Row label="Keyless entry" value={vehicle.keyless_entry ? "Yes" : "No"} />
              <Row label="GPS" value={vehicle.gps ? "Yes" : "No"} />
              <Row label="Rear camera" value={vehicle.rear_camera ? "Yes" : "No"} />
              <Row label="Units" value={String(vehicle.units_available)} />
              <Row label="Available" value={vehicle.available ? "Yes" : "No"} />
              <Row label="Active" value={vehicle.is_active ? "Yes" : "No"} />
            </dl>
            <CarDetailActions car={vehicle} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-semibold text-right">{value}</dd>
    </div>
  );
}
