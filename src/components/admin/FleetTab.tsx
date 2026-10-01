"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  PlusCircle,
  Edit3,
  Upload,
  Trash2,
  MapPin,
  Users,
  Fuel,
  Settings2,
  X,
  Check,
  ImageIcon,
  Maximize2,
  RefreshCw,
  Zap,
  ZapOff,
} from "lucide-react";
import type { Car } from "@/types/database";
import { CAR_CATEGORIES } from "@/types/database";
import { updateVehicle, fetchVehicle, deleteVehicle, activateVehicle, deactivateVehicle, createAttachment, fetchAttachment, deleteAttachment } from "@/lib/auth/laravel-client";
import type { Attachment } from "@/types/attachment";
import { useUserSession } from "@/components/providers/user-session-provider";

type Props = { initialCars: Car[]; onAddCar: () => void };

const categoryLabel = (val: string | null | undefined) => {
  const c = CAR_CATEGORIES.find((x) => x.value === val);
  return c ? `${c.icon} ${c.label}` : "—";
};

const categoryColor = (val: string | null | undefined) => {
  switch (val) {
    case "small_car": return "bg-blue-50 text-blue-600 border-blue-100";
    case "mid_sized_car": return "bg-violet-50 text-violet-600 border-violet-100";
    case "suv": return "bg-brand-50 text-brand-900 border-brand-200";
    case "luxury": return "bg-amber-50 text-brand-600 border-brand-200";
    case "corporate_group": return "bg-teal-50 text-teal-600 border-teal-100";
    default: return "bg-slate-50 text-slate-600 border-slate-100";
  }
};

// Extra vehicle fields not on the Car type (from the Laravel API)
type VehicleExtras = {
  name: string;
  slug: string;
  engine: number | "";
  max_speed: number | "";
  insurance: string;
  keyless_entry: boolean;
  gps: boolean;
  rear_camera: boolean;
  daily_rate_per_day: number | "";
  weekly_rate_per_day: number | "";
  monthly_rate_per_day: number | "";
  is_active: boolean;
};

const defaultExtras = (car: Car): VehicleExtras => ({
  name: `${car.make} ${car.model}`,
  slug: car.slug ?? "",
  engine: "",
  max_speed: "",
  insurance: "",
  keyless_entry: false,
  gps: false,
  rear_camera: false,
  daily_rate_per_day: car.price_per_day,
  weekly_rate_per_day: car.price_per_week ?? "",
  monthly_rate_per_day: car.price_per_month ?? "",
  is_active: true,
});

export function FleetTab({ initialCars, onAddCar }: Props) {
  const { isAdmin } = useUserSession();
  const [cars, setCars] = useState<Car[]>(initialCars);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Car>>({});
  const [extras, setExtras] = useState<VehicleExtras>(defaultExtras(initialCars[0] ?? {} as Car));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  // Local active-state map (Car type doesn't carry is_active; seeded from extras on edit)
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  // Per-vehicle attachments uploaded this session
  const [attachmentMap, setAttachmentMap] = useState<Record<string, Attachment[]>>({});
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const startEdit = (car: Car) => {
    setEditingId(car.id);
    setEditForm({ ...car });
    setExtras(defaultExtras(car));
    setErr(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const refreshVehicle = async (id: string) => {
    setRefreshing(id);
    setErr(null);
    const result = await fetchVehicle(id);
    setRefreshing(null);
    if (!result.ok) { setErr(result.error); return; }
    setCars((prev) => prev.map((c) => (c.id === id ? result.vehicle : c)));
  };

  const handleActivate = async (id: string) => {
    setActivating(id);
    setErr(null);
    const result = await activateVehicle(id);
    setActivating(null);
    if (!result.ok) { setErr(result.error); return; }
    setCars((prev) => prev.map((c) => (c.id === id ? result.vehicle : c)));
    setActiveMap((prev) => ({ ...prev, [id]: true }));
  };

  const handleDeactivate = async (id: string) => {
    setDeactivating(id);
    setErr(null);
    const result = await deactivateVehicle(id);
    setDeactivating(null);
    if (!result.ok) { setErr(result.error); return; }
    setCars((prev) => prev.map((c) => (c.id === id ? result.vehicle : c)));
    setActiveMap((prev) => ({ ...prev, [id]: false }));
  };

  const setExtra = <K extends keyof VehicleExtras>(key: K, val: VehicleExtras[K]) =>
    setExtras((p) => ({ ...p, [key]: val }));

  const saveEdit = async (id: string) => {
    setSaving(true);
    setErr(null);

    const result = await updateVehicle(id, {
      name: extras.name,
      slug: extras.slug,
      make: editForm.make,
      model: editForm.model,
      category: editForm.category ?? undefined,
      transmission: editForm.transmission,
      fuel_type: editForm.fuel_type,
      seats: editForm.seats,
      engine: extras.engine !== "" ? Number(extras.engine) : null,
      max_speed: extras.max_speed !== "" ? Number(extras.max_speed) : null,
      location: editForm.location,
      insurance: extras.insurance || null,
      keyless_entry: extras.keyless_entry,
      gps: extras.gps,
      rear_camera: extras.rear_camera,
      description: editForm.description ?? null,
      daily_rate_per_day: extras.daily_rate_per_day !== "" ? Number(extras.daily_rate_per_day) : Number(editForm.price_per_day),
      weekly_rate_per_day: extras.weekly_rate_per_day !== "" ? Number(extras.weekly_rate_per_day) : null,
      monthly_rate_per_day: extras.monthly_rate_per_day !== "" ? Number(extras.monthly_rate_per_day) : null,
      featured_image: editForm.image_url
        ? { thumbnail_url: editForm.image_url, original_image_url: editForm.image_url }
        : null,
      gallery: [],
      units: editForm.units_available,
      available: editForm.available,
      is_active: extras.is_active,
    });

    setSaving(false);

    if (!result.ok) {
      setErr(result.error);
      return;
    }

    setCars((prev) => prev.map((c) => (c.id === id ? result.vehicle : c)));
    setActiveMap((prev) => ({ ...prev, [id]: extras.is_active }));
    setEditingId(null);
  };

  const deleteCar = async (id: string) => {
    if (!confirm("Confirm vehicle decommissioning? This action is irreversible.")) return;
    setDeleting(id);
    setErr(null);
    const result = await deleteVehicle(id);
    setDeleting(null);
    if (!result.ok) { setErr(result.error); return; }
    setCars((prev) => prev.filter((c) => c.id !== id));
  };

  const uploadImage = async (id: string, file: File) => {
    setUploading(id);
    setErr(null);

    const result = await createAttachment({
      file,
      attachable_type: "App\\Models\\Vehicle",
      attachable_id: id,
      name: file.name,
    });

    setUploading(null);

    if (!result.ok) { setErr(result.error); return; }

    const attachment = result.attachment;
    const url = attachment.thumbnail_url ?? attachment.url;

    // Add to per-vehicle attachment list
    setAttachmentMap((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), attachment],
    }));

    // Keep Car.images / Car.image_url in sync for the gallery preview
    setCars((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, images: [...(c.images ?? []), url], image_url: c.image_url ?? url }
          : c
      )
    );
  };

  const attachmentIdForUrl = (vehicleId: string, src: string): string | null => {
    const list = attachmentMap[vehicleId] ?? [];
    const found = list.find(
      (a) => a.url === src || a.thumbnail_url === src || a.original_image_url === src
    );
    return found?.id ?? null;
  };

  const showAttachment = async (vehicleId: string, src: string) => {
    const id = attachmentIdForUrl(vehicleId, src);
    setPreviewError(null);

    if (!id) {
      setPreview({
        id: "",
        name: null,
        file_name: null,
        mime_type: null,
        url: src,
        thumbnail_url: src,
        original_image_url: src,
        size: null,
        attachable_type: null,
        attachable_id: vehicleId,
        created_at: "",
      });
      return;
    }

    setPreviewLoading(true);
    const result = await fetchAttachment(id);
    setPreviewLoading(false);

    if (!result.ok) {
      setPreviewError(result.error);
      setPreview({
        id,
        name: null,
        file_name: null,
        mime_type: null,
        url: src,
        thumbnail_url: src,
        original_image_url: src,
        size: null,
        attachable_type: null,
        attachable_id: vehicleId,
        created_at: "",
      });
      return;
    }

    setPreview(result.attachment);
    setAttachmentMap((prev) => ({
      ...prev,
      [vehicleId]: (prev[vehicleId] ?? []).map((a) =>
        a.id === result.attachment.id ? result.attachment : a
      ),
    }));
  };

  const removeImage = async (vehicleId: string, imageUrl: string) => {
    if (!confirm("Delete this asset image?")) return;

    const attachmentId = attachmentIdForUrl(vehicleId, imageUrl);
    if (!attachmentId) {
      setErr("This image has no attachment ID yet. Re-upload it, then delete.");
      return;
    }

    setUploading(vehicleId);
    setErr(null);

    const result = await deleteAttachment(attachmentId);
    setUploading(null);

    if (!result.ok) {
      setErr(result.error);
      return;
    }

    setAttachmentMap((prev) => ({
      ...prev,
      [vehicleId]: (prev[vehicleId] ?? []).filter((a) => a.id !== attachmentId),
    }));

    setCars((prev) =>
      prev.map((c) => {
        if (c.id !== vehicleId) return c;
        const images = (c.images ?? []).filter((img) => img !== imageUrl);
        return {
          ...c,
          images,
          image_url: c.image_url === imageUrl ? (images[0] ?? null) : c.image_url,
        };
      })
    );

    if (preview?.id === attachmentId) {
      setPreview(null);
      setPreviewError(null);
    }
  };

  const setField = (key: keyof Car, val: unknown) =>
    setEditForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="pb-20">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-8 bg-brand-600 rounded-full" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Inventory Status: <span className="text-onyx-950">{cars.length} Fleet Assets</span></p>
        </div>
      </div>

      {err && (
        <div className="mb-8 rounded-2xl bg-red-50 border border-red-100 p-5 text-sm font-bold text-red-600 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <Maximize2 className="h-4 w-4 rotate-45" /> {err}
        </div>
      )}

      {(preview || previewLoading) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close preview"
            onClick={() => { setPreview(null); setPreviewError(null); }}
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {preview?.name || preview?.file_name || "Attachment"}
              </p>
              <button
                type="button"
                onClick={() => { setPreview(null); setPreviewError(null); }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative aspect-video bg-slate-50">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400">
                  Loading…
                </div>
              ) : (
                preview && (
                  <Image
                    src={preview.original_image_url ?? preview.url ?? preview.thumbnail_url ?? ""}
                    alt={preview.name ?? "Attachment"}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                )
              )}
            </div>
            {previewError && (
              <p className="px-6 py-3 text-sm text-red-600">{previewError}</p>
            )}
            {preview && !previewLoading && (
              <div className="grid grid-cols-2 gap-3 px-6 py-4 text-xs text-slate-500">
                {preview.id && <p><span className="font-bold uppercase tracking-widest text-slate-400">ID</span> {preview.id}</p>}
                {preview.mime_type && <p><span className="font-bold uppercase tracking-widest text-slate-400">Type</span> {preview.mime_type}</p>}
                {preview.size != null && <p><span className="font-bold uppercase tracking-widest text-slate-400">Size</span> {preview.size} bytes</p>}
                {preview.created_at && <p><span className="font-bold uppercase tracking-widest text-slate-400">Added</span> {preview.created_at}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {cars.map((car) => {
          const img = car.image_url ?? car.images?.[0] ?? null;
          const isEditing = editingId === car.id;

          return (
            <div key={car.id} className="group relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-50 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl">
              {/* Image Preview Tier */}
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-50">
                {img ? (
                  <Image src={img} alt={`${car.make} ${car.model}`} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-300">
                    <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">No Visual Assets</span>
                  </div>
                )}

                {/* Overlay Badges */}
                <div className="absolute inset-x-4 top-4 flex items-center justify-between pointer-events-none">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md bg-white/90 shadow-sm ${categoryColor(car.category)}`}>
                    {categoryLabel(car.category)}
                  </span>
                  {(car.images?.length ?? 0) > 1 && (
                    <span className="rounded-full bg-onyx-950/80 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                      {car.images!.length} Portfolio Shots
                    </span>
                  )}
                  {(attachmentMap[car.id]?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-brand-600/90 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                      +{attachmentMap[car.id].length} new
                    </span>
                  )}
                </div>
              </div>

              <div className="p-8">
                {isEditing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">

                      {/* Identity */}
                      <p className={`${labelStyle} col-span-2`}>Identity</p>
                      <div className="space-y-1 col-span-2">
                        <label className={labelStyle}>Make / Model</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input className={editInp} placeholder="Make" value={editForm.make ?? ""} onChange={(e) => setField("make", e.target.value)} />
                          <input className={editInp} placeholder="Model" value={editForm.model ?? ""} onChange={(e) => setField("model", e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Name</label>
                        <input className={editInp} value={extras.name} onChange={(e) => setExtra("name", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Slug</label>
                        <input className={editInp} value={extras.slug} onChange={(e) => setExtra("slug", e.target.value)} />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className={labelStyle}>Category</label>
                        <select className={`${editInp} appearance-none cursor-pointer`} value={editForm.category ?? "small_car"} onChange={(e) => setField("category", e.target.value)}>
                          {CAR_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className={labelStyle}>Operating Location</label>
                        <input className={editInp} value={editForm.location ?? ""} onChange={(e) => setField("location", e.target.value)} />
                      </div>

                      {/* Specs */}
                      <p className={`${labelStyle} col-span-2 pt-2`}>Specifications</p>
                      <div className="space-y-1">
                        <label className={labelStyle}>Seats</label>
                        <input type="number" className={editInp} value={editForm.seats ?? ""} onChange={(e) => setField("seats", Number(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Transmission</label>
                        <select className={`${editInp} appearance-none cursor-pointer`} value={editForm.transmission ?? "automatic"} onChange={(e) => setField("transmission", e.target.value)}>
                          <option value="automatic">Automatic</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Fuel Type</label>
                        <select className={`${editInp} appearance-none cursor-pointer`} value={editForm.fuel_type ?? "petrol"} onChange={(e) => setField("fuel_type", e.target.value)}>
                          <option value="petrol">Petrol</option>
                          <option value="diesel">Diesel</option>
                          <option value="electric">Electric</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Engine (cc)</label>
                        <input type="number" className={editInp} value={extras.engine} onChange={(e) => setExtra("engine", e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 2500" />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Max speed (km/h)</label>
                        <input type="number" className={editInp} value={extras.max_speed} onChange={(e) => setExtra("max_speed", e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 180" />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Insurance</label>
                        <input className={editInp} value={extras.insurance} onChange={(e) => setExtra("insurance", e.target.value)} placeholder="e.g. Fully Covered" />
                      </div>

                      {/* Pricing */}
                      <p className={`${labelStyle} col-span-2 pt-2`}>Pricing</p>
                      <div className="space-y-1">
                        <label className={labelStyle}>Daily rate</label>
                        <input type="number" className={editInp} value={extras.daily_rate_per_day} onChange={(e) => setExtra("daily_rate_per_day", e.target.value === "" ? "" : Number(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Weekly rate</label>
                        <input type="number" className={editInp} value={extras.weekly_rate_per_day} onChange={(e) => setExtra("weekly_rate_per_day", e.target.value === "" ? "" : Number(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Monthly rate</label>
                        <input type="number" className={editInp} value={extras.monthly_rate_per_day} onChange={(e) => setExtra("monthly_rate_per_day", e.target.value === "" ? "" : Number(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Units in stock</label>
                        <input type="number" min={0} className={editInp} value={editForm.units_available ?? 0} onChange={(e) => setField("units_available", Number(e.target.value))} />
                      </div>

                      {/* Features */}
                      <p className={`${labelStyle} col-span-2 pt-2`}>Features & Status</p>
                      <div className="col-span-2 grid grid-cols-3 gap-3">
                        {([
                          { key: "keyless_entry", label: "Keyless" },
                          { key: "gps", label: "GPS" },
                          { key: "rear_camera", label: "Rear Camera" },
                        ] as { key: keyof VehicleExtras; label: string }[]).map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer text-slate-500">
                            <input type="checkbox" className="h-4 w-4 rounded-md border-slate-200 text-brand-600 focus:ring-brand-600" checked={Boolean(extras[key])} onChange={(e) => setExtra(key, e.target.checked as VehicleExtras[typeof key])} />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 col-span-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer text-slate-500">
                          <input type="checkbox" className="h-4 w-4 rounded-md border-slate-200 text-brand-600 focus:ring-brand-600" checked={editForm.available ?? true} onChange={(e) => setField("available", e.target.checked)} />
                          Available
                        </label>
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer text-slate-500">
                          <input type="checkbox" className="h-4 w-4 rounded-md border-slate-200 text-brand-600 focus:ring-brand-600" checked={extras.is_active} onChange={(e) => setExtra("is_active", e.target.checked)} />
                          Active listing
                        </label>
                      </div>

                      <div className="space-y-1 col-span-2">
                        <label className={labelStyle}>Description</label>
                        <textarea rows={3} className={`${editInp} resize-none`} value={editForm.description ?? ""} onChange={(e) => setField("description", e.target.value)} />
                      </div>
                    </div>

                    {/* Image Gallery in Edit Mode */}
                    {(car.images?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className={`${labelStyle} mb-2`}>Portfolio Images</p>
                        <div className="grid grid-cols-4 gap-2">
                          {(car.images ?? []).slice(0, 8).map((src) => (
                            <div key={src} className="group/img relative aspect-square overflow-hidden rounded-xl bg-slate-50 ring-2 ring-transparent hover:ring-brand-600/20 transition-all">
                              <button
                                type="button"
                                onClick={() => void showAttachment(car.id, src)}
                                className="absolute inset-0 z-0"
                                aria-label="View attachment"
                              >
                                <Image src={src} alt="Portfolio" fill className="object-cover" unoptimized />
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeImage(car.id, src)}
                                disabled={uploading === car.id}
                                className="absolute right-1 top-1 z-10 rounded-lg bg-red-600/90 p-1.5 text-white opacity-0 transition-opacity group-hover/img:opacity-100 disabled:opacity-0"
                                aria-label="Delete image"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => fileRefs.current[car.id]?.click()}
                          disabled={uploading === car.id}
                          className="mt-2 w-full rounded-xl border border-dashed border-slate-200 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:border-brand-600 hover:text-brand-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="h-3 w-3" /> Upload New Image
                        </button>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-50">
                      <button onClick={() => void saveEdit(car.id)} disabled={saving} className="flex-1 rounded-2xl bg-brand-600 py-4 text-[10px] font-bold uppercase tracking-widest text-white shadow-xl hover:bg-brand-700 transition-all disabled:opacity-50">
                        {saving ? "Updating..." : "Commit Changes"}
                      </button>
                      <button onClick={cancelEdit} className="flex-1 rounded-2xl border border-slate-100 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-display text-xl font-bold text-onyx-950 group-hover:text-brand-600 transition-colors">{car.make} {car.model}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                          <MapPin className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{car.location}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${car.available && (car.units_available ?? 0) > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                          {car.available && (car.units_available ?? 0) > 0 ? "In Stock" : "Reserved"}
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                          {car.units_available ?? 0} Inventory
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Pricing</span>
                      <span className="text-xl font-bold text-onyx-950 px-2">$ {Number(car.price_per_day).toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/ 24H</span>
                    </div>

                    {/* Quick Portfolio Preview */}
                    {(car.images?.length ?? 0) > 0 && (
                      <div className="mb-8 grid grid-cols-4 gap-2">
                        {(car.images ?? []).slice(0, 4).map((src) => (
                          <div key={src} className="group/img relative aspect-square overflow-hidden rounded-xl bg-slate-50 ring-2 ring-transparent hover:ring-brand-600/20 transition-all">
                            <button
                              type="button"
                              onClick={() => void showAttachment(car.id, src)}
                              className="absolute inset-0 z-0"
                              aria-label="View attachment"
                            >
                              <Image src={src} alt="Portfolio" fill className="object-cover" unoptimized />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeImage(car.id, src)}
                              disabled={uploading === car.id}
                              className="absolute right-1 top-1 z-10 rounded-lg bg-red-600/90 p-1.5 text-white opacity-0 transition-opacity group-hover/img:opacity-100 disabled:opacity-0"
                              aria-label="Delete image"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => startEdit(car)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-100 px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-onyx-950 transition-all hover:border-brand-600 hover:text-brand-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Modify
                      </button>

                      <div className="flex gap-2">
                        {/* Activate / Deactivate toggle — admin only */}
                        {isAdmin && (
                          activeMap[car.id] === false
                            ? (
                              <button
                                onClick={() => void handleActivate(car.id)}
                                disabled={activating === car.id}
                                title="Activate vehicle"
                                className="h-11 w-11 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 hover:bg-brand-600 hover:text-white transition-all border border-brand-100 disabled:opacity-50"
                              >
                                <Zap className={`h-4 w-4 ${activating === car.id ? "animate-pulse" : ""}`} />
                              </button>
                            ) : (
                              <button
                                onClick={() => void handleDeactivate(car.id)}
                                disabled={deactivating === car.id}
                                title="Deactivate vehicle"
                                className="h-11 w-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-all border border-slate-100 disabled:opacity-50"
                              >
                                <ZapOff className={`h-4 w-4 ${deactivating === car.id ? "animate-pulse" : ""}`} />
                              </button>
                            )
                        )}
                        <button
                          onClick={() => void refreshVehicle(car.id)}
                          disabled={refreshing === car.id}
                          title="Refresh from API"
                          className="h-11 w-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-onyx-950 hover:text-brand-600 transition-all border border-slate-100 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshing === car.id ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          onClick={() => fileRefs.current[car.id]?.click()}
                          disabled={uploading === car.id}
                          className="h-11 w-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-onyx-950 hover:text-brand-600 transition-all border border-slate-100 disabled:opacity-50"
                        >
                          <Upload className="h-4 w-4" />
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => { fileRefs.current[car.id] = el; }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(car.id, f); e.target.value = ""; }}
                        />
                        <button
                          onClick={() => void deleteCar(car.id)}
                          disabled={deleting === car.id}
                          className="h-11 w-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-600 hover:text-white transition-all border border-red-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Bar for uploads */}
              {uploading === car.id && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-brand-600 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {cars.length === 0 && (
        <div className="py-32 text-center rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/50">
          <div className="mx-auto h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-6">
            <Settings2 className="h-10 w-10" />
          </div>
          <h3 className="font-display text-2xl font-bold text-onyx-950 tracking-tight">Fleet Depleted</h3>
          <p className="mt-2 text-slate-500 font-medium">No refined automotive assets currently registered.</p>
          <button onClick={onAddCar} className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-2xl hover:bg-brand-700 transition-all hover:-translate-y-1">
            <PlusCircle className="h-4 w-4" /> Register First Asset
          </button>
        </div>
      )}
    </div>
  );
}

const editInp = "w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-600 transition-all";
const labelStyle = "text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1";
