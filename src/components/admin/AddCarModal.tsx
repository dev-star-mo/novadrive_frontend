"use client";

import { useState } from "react";
import { CAR_CATEGORIES } from "@/types/database";
import { createVehicle } from "@/lib/auth/laravel-client";
import type { Car } from "@/types/database";

type Props = { onClose: () => void; onAdded: (car: Car) => void };

const DEFAULTS = {
  name: "",
  slug: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  category: "small_car" as string,
  transmission: "automatic",
  fuel_type: "petrol",
  seats: 5,
  engine: "" as string | number,
  max_speed: "" as string | number,
  location: "",
  insurance: "",
  keyless_entry: false,
  gps: false,
  rear_camera: false,
  description: "",
  daily_rate_per_day: "" as string | number,
  weekly_rate_per_day: "" as string | number,
  monthly_rate_per_day: "" as string | number,
  image_url: "",
  units: 1,
  available: true,
  is_active: true,
};

export function AddCarModal({ onClose, onAdded }: Props) {
  const [form, setForm] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof DEFAULTS>(key: K, val: (typeof DEFAULTS)[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  // Auto-generate name and slug from make + model
  const handleMakeModel = (key: "make" | "model", val: string) => {
    setForm((p) => {
      const make = key === "make" ? val : p.make;
      const model = key === "model" ? val : p.model;
      const name = [make, model].filter(Boolean).join(" ");
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      return { ...p, [key]: val, name, slug };
    });
  };

  const submit = async () => {
    if (!form.make || !form.model || !form.daily_rate_per_day || !form.location) {
      setErr("Please fill in Make, Model, Location and Daily rate."); return;
    }
    setBusy(true); setErr(null);

    const result = await createVehicle({
      name: form.name || `${form.make} ${form.model}`,
      slug: form.slug || `${form.make}-${form.model}`.toLowerCase().replace(/\s+/g, "-"),
      make: form.make,
      model: form.model,
      category: form.category,
      transmission: form.transmission,
      fuel_type: form.fuel_type,
      seats: Number(form.seats),
      engine: form.engine !== "" ? Number(form.engine) : null,
      max_speed: form.max_speed !== "" ? Number(form.max_speed) : null,
      location: form.location,
      insurance: form.insurance || null,
      keyless_entry: form.keyless_entry,
      gps: form.gps,
      rear_camera: form.rear_camera,
      description: form.description || null,
      daily_rate_per_day: Number(form.daily_rate_per_day),
      weekly_rate_per_day: form.weekly_rate_per_day !== "" ? Number(form.weekly_rate_per_day) : null,
      monthly_rate_per_day: form.monthly_rate_per_day !== "" ? Number(form.monthly_rate_per_day) : null,
      featured_image: form.image_url
        ? { thumbnail_url: form.image_url, original_image_url: form.image_url }
        : null,
      gallery: [],
      units: Number(form.units),
      available: form.available,
      is_active: form.is_active,
    });

    setBusy(false);

    if (!result.ok) {
      setErr(result.error);
      return;
    }

    onAdded(result.vehicle);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 text-xl">✕</button>
        <h2 className="text-lg font-bold text-slate-900 pr-8">Register new vehicle</h2>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

        {/* ── Identity ── */}
        <Section title="Identity">
          <Field label="Make *">
            <input className={inp} value={form.make} onChange={(e) => handleMakeModel("make", e.target.value)} placeholder="e.g. Toyota" />
          </Field>
          <Field label="Model *">
            <input className={inp} value={form.model} onChange={(e) => handleMakeModel("model", e.target.value)} placeholder="e.g. RAV4" />
          </Field>
          <Field label="Name (auto-filled)">
            <input className={inp} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Slug (URL)">
            <input className={inp} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="e.g. toyota-rav4" />
          </Field>
          <Field label="Category *" className="col-span-2">
            <select className={inp} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CAR_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Location *" className="col-span-2">
            <input className={inp} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Westlands, Nairobi" />
          </Field>
        </Section>

        {/* ── Specs ── */}
        <Section title="Specifications">
          <Field label="Seats">
            <input type="number" className={inp} value={form.seats} min={1} onChange={(e) => set("seats", Number(e.target.value))} />
          </Field>
          <Field label="Transmission">
            <select className={inp} value={form.transmission} onChange={(e) => set("transmission", e.target.value)}>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Fuel type">
            <select className={inp} value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)}>
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="electric">Electric</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </Field>
          <Field label="Engine (cc)">
            <input type="number" className={inp} value={form.engine} onChange={(e) => set("engine", e.target.value)} placeholder="e.g. 2500" />
          </Field>
          <Field label="Max speed (km/h)">
            <input type="number" className={inp} value={form.max_speed} onChange={(e) => set("max_speed", e.target.value)} placeholder="e.g. 180" />
          </Field>
          <Field label="Insurance">
            <input className={inp} value={form.insurance} onChange={(e) => set("insurance", e.target.value)} placeholder="e.g. Fully Covered" />
          </Field>
        </Section>

        {/* ── Pricing ── */}
        <Section title="Pricing">
          <Field label="Daily rate (KES) *">
            <input type="number" className={inp} value={form.daily_rate_per_day} onChange={(e) => set("daily_rate_per_day", e.target.value)} />
          </Field>
          <Field label="Weekly rate (KES)">
            <input type="number" className={inp} value={form.weekly_rate_per_day} onChange={(e) => set("weekly_rate_per_day", e.target.value)} />
          </Field>
          <Field label="Monthly rate (KES)" className="col-span-2">
            <input type="number" className={inp} value={form.monthly_rate_per_day} onChange={(e) => set("monthly_rate_per_day", e.target.value)} />
          </Field>
        </Section>

        {/* ── Features ── */}
        <Section title="Features">
          <Field label="Keyless entry" className="col-span-1">
            <Toggle checked={form.keyless_entry} onChange={(v) => set("keyless_entry", v)} />
          </Field>
          <Field label="GPS" className="col-span-1">
            <Toggle checked={form.gps} onChange={(v) => set("gps", v)} />
          </Field>
          <Field label="Rear camera" className="col-span-1">
            <Toggle checked={form.rear_camera} onChange={(v) => set("rear_camera", v)} />
          </Field>
        </Section>

        {/* ── Availability & Media ── */}
        <Section title="Availability & Media">
          <Field label="Units in stock">
            <input type="number" className={inp} value={form.units} min={0} onChange={(e) => set("units", Number(e.target.value))} />
          </Field>
          <Field label="Available">
            <Toggle checked={form.available} onChange={(v) => set("available", v)} />
          </Field>
          <Field label="Active listing">
            <Toggle checked={form.is_active} onChange={(v) => set("is_active", v)} />
          </Field>
          <Field label="Featured image URL" className="col-span-2">
            <input className={inp} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Description" className="col-span-2">
            <textarea className={inp} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </Section>

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {busy ? "Registering vehicle…" : "Register vehicle"}
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ── */
const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mt-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <span className="text-sm text-slate-600">{checked ? "Yes" : "No"}</span>
    </label>
  );
}
