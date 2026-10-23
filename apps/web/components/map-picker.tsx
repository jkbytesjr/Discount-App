"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "./i18n";

// Google Maps JavaScript API + Places Autocomplete (BR-8). Without a key the form still works with typed coordinates.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const MAPUTO = { lat: -25.9692, lng: 32.5732 };

interface LatLng { lat: number; lng: number }
let loader: Promise<any> | undefined;
export const MAPS_KEY = KEY;
export function loadMaps(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY!)}&v=weekly&loading=async&libraries=places`;
    s.async = true;
    s.onload = () => resolve(w.google.maps);
    s.onerror = () => { loader = undefined; reject(new Error("maps")); };
    document.head.appendChild(s);
  });
  return loader;
}

export function MapPicker({ value, onPick, disabled }: { value: LatLng | null; onPick: (p: LatLng & { address?: string; city?: string }) => void; disabled?: boolean }) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const api = useRef<{ map: any; marker: any; geocoder: any } | null>(null);
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!KEY || !box.current) return;
    let dead = false;
    loadMaps().then(async (maps) => {
      if (dead || !box.current) return;
      const start = value ?? MAPUTO;
      const map = new maps.Map(box.current, { center: start, zoom: value ? 16 : 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
      const marker = new maps.Marker({ map, position: value ?? undefined, draggable: !disabled, visible: !!value });
      const geocoder = new maps.Geocoder();
      api.current = { map, marker, geocoder };
      const place = (p: LatLng, reverse: boolean) => {
        marker.setPosition(p); marker.setVisible(true); map.panTo(p);
        if (!reverse) { onPickRef.current(p); return; }
        geocoder.geocode({ location: p }, (res: any[] | null) => {
          const r = res?.[0];
          const city = r?.address_components?.find((c: any) => c.types.includes("locality"))?.long_name;
          onPickRef.current({ ...p, address: r?.formatted_address, city });
        });
      };
      if (!disabled) {
        map.addListener("click", (e: any) => place({ lat: e.latLng.lat(), lng: e.latLng.lng() }, true));
        marker.addListener("dragend", () => { const q = marker.getPosition(); place({ lat: q.lat(), lng: q.lng() }, true); });
        if (search.current) {
          const ac = new maps.places.Autocomplete(search.current, { componentRestrictions: { country: "mz" }, fields: ["geometry", "formatted_address", "address_components"] });
          ac.addListener("place_changed", () => {
            const pl = ac.getPlace(); if (!pl?.geometry?.location) return;
            const p = { lat: pl.geometry.location.lat(), lng: pl.geometry.location.lng() };
            marker.setPosition(p); marker.setVisible(true); map.panTo(p); map.setZoom(17);
            const city = pl.address_components?.find((c: any) => c.types.includes("locality"))?.long_name;
            onPickRef.current({ ...p, address: pl.formatted_address, city });
          });
        }
      }
    }).catch(() => setFailed(true));
    return () => { dead = true; };
    // The map is created once; later value changes are applied by the effect below.
  }, []);

  useEffect(() => {
    const a = api.current; if (!a || !value) return;
    a.marker.setPosition(value); a.marker.setVisible(true);
  }, [value?.lat, value?.lng]);

  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const a = api.current;
      if (a) { a.marker.setPosition(p); a.marker.setVisible(true); a.map.panTo(p); a.map.setZoom(17); }
      onPick(p);
    });
  }

  if (!KEY) return <p className="hint" role="note">{t("prem.mapNoKey")}</p>;
  if (failed) return <p className="error-text" role="alert">{t("prem.mapError")}</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="sr-only" htmlFor="map-search">{t("prem.mapSearch")}</label>
      <input id="map-search" ref={search} className="input" type="search" placeholder={t("prem.mapSearch")} disabled={disabled} />
      <div ref={box} role="application" aria-label={t("prem.mapLabel")} style={{ height: 280, borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }} />
      <div className="row"><button type="button" className="btn secondary sm" onClick={locate} disabled={disabled}>{t("prem.useMyLocation")}</button><span className="hint">{t("prem.mapHint")}</span></div>
    </div>
  );
}
