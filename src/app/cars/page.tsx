import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CarListing } from "@/components/cars/CarListing";
import { fetchVehiclesIndex } from "@/lib/auth/laravel-client";
import type { Car } from "@/types/database";

export default function CarsPage() {
  const [params] = useSearchParams();
  const [cars, setCars] = useState<Car[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchVehiclesIndex().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        setCars([]);
      } else {
        setCars(result.vehicles);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CarListing
      initialCars={cars}
      loadError={loadError}
      initialQuery={params.get("name") ?? ""}
      initialLocation={params.get("location") ?? ""}
      initialFrom={params.get("from") ?? ""}
      initialTo={params.get("to") ?? ""}
    />
  );
}
