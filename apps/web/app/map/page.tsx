"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import "leaflet/dist/leaflet.css";
import { SUPPORTED_LOCALES, type Locale, type MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { setLocaleCookie, useT } from "@/components/i18n";
import { Badge, EmptyState, Icon } from "@/components/ui";
import { MAPS_KEY, loadMaps } from "@/components/map-picker";

// BR-11: public map. Chips filter server-side; the list beside the map is always available (also the no-key fallback).
interface Row { scope: string; label: string; cardProductName: string | null; issuerName: string | null; walletName: string | null; cardType: string | null; minSpendMzn: number | null; maxDiscountMzn: number | null; comment: string | null; matched: boolean }
interface Offer { id: string; title: string; businessName: string; terms: string | null; redemption: string | null; validTo: string | null; days: string[]; from: string | null; to: string | null; rows: Row[] }
interface Summary { id: string; name: string; categoryId: string; lat: number | null; lng: number | null; address: string | null; city: string | null; offerCount: number; best: { label: string } | null; distanceM?: number }
interface Detail extends Summary { phone: string | null; openingHours: string | null; offers: Offer[] }
interface Chips { issuers: { id: string; name: string }[]; wallets: { id: string; name: string }[]; cardTypes: string[]; segments: string[]; categories: { id: string; name: string }[]; general: boolean }
type Group = "issuer" | "wallet" | "cardType" | "segment" | "category";
interface Sel { issuer: string[]; wallet: string[]; cardType: string[]; segment: string[]; category: string[]; general: boolean }
const NONE: Sel = { issuer: [], wallet: [], cardType: [], segment: [], category: [], general: false };
const MAPUTO = { lat: -25.9692, lng: 32.5732 };
const WHOLE_COUNTRY = "29.9,-27,41.1,-9.9";

const qs = (s: Sel, extra: Record<string, string>) => {
  const p = new URLSearchParams(extra);
  (["issuer", "wallet", "cardType", "segment", "category"] as const).forEach((g) => { if (s[g].length) p.set(g, s[g].join(",")); });
  if (s.general) p.set("general", "1");
  return p.toString();
};
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

export default function Page() {
  const { t, locale } = useT();
  const router = useRouter();
  const lang = locale === "en" ? "en" : "pt";
  const [chips, setChips] = useState<Chips | null>(null);
  const [sel, setSel] = useState<Sel>(NONE);
  const [places, setPlaces] = useState<Summary[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null); const [radiusKm, setRadiusKm] = useState(2);
  const [status, setStatus] = useState(""); const [mapOk, setMapOk] = useState<boolean | null>(MAPS_KEY ? null : false);
  const box = useRef<HTMLDivElement>(null); const search = useRef<HTMLInputElement>(null);
  const g = useRef<{ map: any; maps: any; markers: Map<string, any>; clusterer: any } | null>(null);
  const lbox = useRef<HTMLDivElement>(null); const lm = useRef<{ map: any; L: any; layer: any } | null>(null); // OpenStreetMap fallback when Google Maps is unavailable
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0); // only the newest request may update the list: an older response arriving late must not overwrite a filtered result
  const selRef = useRef(sel); selRef.current = sel;
  const nearRef = useRef(near); nearRef.current = near;
  const radiusRef = useRef(radiusKm); radiusRef.current = radiusKm;

  useEffect(() => { api<Chips>(`/map/filters?lang=${lang}`).then(setChips).catch(() => {}); }, [lang]);

  const fetchPlaces = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setError("");
    try {
      const nr = nearRef.current;
      if (nr) {
        const r = await api<{ items: { distanceM: number; premise: Summary; discount: Offer }[] }>(`/discounts/nearby?${qs(selRef.current, { lat: String(nr.lat), lng: String(nr.lng), radius: String(radiusRef.current * 1000), lang, limit: "100" })}`);
        const by = new Map<string, Summary>();
        for (const it of r.items) { const p = by.get(it.premise.id) ?? { ...it.premise, offerCount: 0, best: null, distanceM: it.distanceM }; p.offerCount += 1; p.best ??= { label: it.discount.rows.find((x) => x.matched)?.label ?? "" }; by.set(it.premise.id, p); }
        if (mine === seq.current) setPlaces([...by.values()]);
      } else {
        let bbox = WHOLE_COUNTRY;
        const lb = lm.current?.map.getBounds();
        if (lb) bbox = [lb.getWest(), lb.getSouth(), lb.getEast(), lb.getNorth()].map((n: number) => n.toFixed(5)).join(",");
        const b = g.current?.map.getBounds();
        if (b) { const ne = b.getNorthEast(), sw = b.getSouthWest(); bbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()].map((n: number) => n.toFixed(5)).join(","); }
        const r = await api<{ items: Summary[] }>(`/map/premises?${qs(selRef.current, { bbox, lang, limit: "500" })}`);
        if (mine === seq.current) setPlaces(r.items);
      }
    } catch { if (mine === seq.current) setError(t("map.loadError")); }
    if (mine === seq.current) setLoading(false);
  }, [lang, t]);
  const refetchSoon = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => void fetchPlaces(), 250); }, [fetchPlaces]);

  // Create the map once.
  useEffect(() => {
    if (!MAPS_KEY || !box.current) { void fetchPlaces(); return; }
    let dead = false;
    loadMaps().then((maps) => {
      if (dead || !box.current) return;
      const map = new maps.Map(box.current, { center: MAPUTO, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
      g.current = { map, maps, markers: new Map(), clusterer: new MarkerClusterer({ map }) };
      map.addListener("idle", () => { if (!nearRef.current) refetchSoon(); });
      if (search.current) {
        const ac = new maps.places.Autocomplete(search.current, { componentRestrictions: { country: "mz" }, fields: ["geometry"] });
        ac.addListener("place_changed", () => { const loc = ac.getPlace()?.geometry; if (!loc) return; setNear(null); nearRef.current = null; if (loc.viewport) map.fitBounds(loc.viewport); else { map.setCenter(loc.location); map.setZoom(15); } });
      }
      setMapOk(true); void fetchPlaces();
    }).catch((e) => { console.error("[map] could not load Google Maps:", e); setMapOk(false); void fetchPlaces(); });
    return () => { dead = true; };
  }, []);

  useEffect(() => { void fetchPlaces(); }, [sel, near, radiusKm, lang]);

  // Google rejected the key (for example the site is not an allowed referrer): fall back to OpenStreetMap.
  useEffect(() => {
    const onFail = () => { g.current = null; setMapOk(false); };
    window.addEventListener("moz-maps-auth-failed", onFail);
    return () => window.removeEventListener("moz-maps-auth-failed", onFail);
  }, []);
  useEffect(() => {
    if (mapOk !== false || !lbox.current || lm.current) return;
    let dead = false;
    import("leaflet").then((L) => {
      if (dead || !lbox.current) return;
      const map = L.map(lbox.current).setView([MAPUTO.lat, MAPUTO.lng], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      lm.current = { map, L, layer: L.layerGroup().addTo(map) };
      map.on("moveend", () => { if (!nearRef.current) refetchSoon(); });
      void fetchPlaces();
    });
    return () => { dead = true; };
  }, [mapOk]);
  useEffect(() => {
    const m = lm.current; if (!m) return;
    m.layer.clearLayers();
    for (const p of places) {
      if (p.lat === null || p.lng === null) continue;
      m.L.circleMarker([p.lat, p.lng], { radius: 11, color: "#ffffff", weight: 3, fillColor: "#9b5cff", fillOpacity: 1 }).bindTooltip(p.name).on("click", () => void open(p.id)).addTo(m.layer);
    }
  }, [places, mapOk]);

  // Draw markers for the current places.
  useEffect(() => {
    const m = g.current; if (!m) return;
    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue("--accent-solid").trim() || "#9b5cff"; const ink = "#ffffff";
    const icon = { url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="13" fill="${gold}" stroke="${ink}" stroke-width="3"/><circle cx="17" cy="17" r="4" fill="${ink}"/></svg>`)}`, scaledSize: new m.maps.Size(34, 34) };
    m.clusterer.clearMarkers(); m.markers.clear();
    const list: any[] = [];
    for (const p of places) {
      if (p.lat === null || p.lng === null) continue;
      const mk = new m.maps.Marker({ position: { lat: p.lat, lng: p.lng }, title: p.name, icon });
      mk.addListener("click", () => void open(p.id));
      m.markers.set(p.id, mk); list.push(mk);
    }
    m.clusterer.addMarkers(list);
  }, [places, mapOk]);

  async function open(id: string) {
    try { setDetail(await api<Detail>(`/map/premises/${id}?lang=${lang}`)); } catch { setError(t("map.loadError")); }
    const p = places.find((x) => x.id === id);
    if (p?.lat != null && g.current) { g.current.map.panTo({ lat: p.lat, lng: p.lng }); }
    if (p?.lat != null && lm.current) lm.current.map.panTo([p.lat, p.lng]);
  }
  function locate() {
    setStatus(t("map.locating"));
    navigator.geolocation?.getCurrentPosition((pos) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setNear(here); setStatus("");
      g.current?.map.setCenter(here); g.current?.map.setZoom(14); lm.current?.map.setView([here.lat, here.lng], 14);
    }, () => setStatus(t("map.locationDenied")), { enableHighAccuracy: false, timeout: 10_000 });
  }
  const toggle = (grp: Group, id: string) => setSel((s) => ({ ...s, [grp]: s[grp].includes(id) ? s[grp].filter((x) => x !== id) : [...s[grp], id] }));
  const active = sel.general || (Object.keys(NONE) as (keyof Sel)[]).some((k) => k !== "general" && (sel[k] as string[]).length > 0);
  const groups = useMemo(() => !chips ? [] : ([
    ["map.banks", "issuer", chips.issuers.map((x) => ({ id: x.id, name: x.name }))],
    ["map.wallets", "wallet", chips.wallets],
    ["map.cardTypes", "cardType", chips.cardTypes.map((x) => ({ id: x, name: t(`ctype.${x}` as MessageKey) }))],
    ["map.segments", "segment", chips.segments.map((x) => ({ id: x, name: x }))],
    ["map.categories", "category", chips.categories],
  ] as [MessageKey, Group, { id: string; name: string }[]][]).filter(([, , l]) => l.length), [chips, t]);
  const other = SUPPORTED_LOCALES.find((l) => l !== locale) as Locale;

  return (
    <main id="main" className="mapapp">
      <header className="map-head glass">
        <Link href="/" className="brand"><img src="/brand/app-icon.png" alt="" width={32} height={32} /><span>{t("app.name")}</span></Link>
        <div className="grow"><h1 style={{ margin: 0, fontSize: "1.25rem" }}>{t("map.title")}</h1><p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{t("map.sub")}</p></div>
        <button type="button" className="btn ghost sm" onClick={() => { setLocaleCookie(other); router.refresh(); }} lang={other}><Icon name="globe" size={18} />{other === "en" ? "English" : "Português"}</button>
        <Link className="btn secondary sm" href="/login">{t("auth.login")}</Link>
      </header>

      <section className="map-filters glass" aria-label={t("map.filters")}>
        <div className="row">
          <button type="button" className="chip" aria-pressed={!active} onClick={() => setSel(NONE)}>{t("map.showAll")}</button>
          {chips?.general ? <button type="button" className="chip" aria-pressed={sel.general} onClick={() => setSel((s) => ({ ...s, general: !s.general }))}>{t("map.general")}</button> : null}
          <button type="button" className="chip" aria-pressed={!!near} onClick={() => (near ? setNear(null) : locate())}><Icon name="pin" size={16} />{t("map.nearMe")}</button>
          {near ? <label className="radius">{t("map.radius", { km: radiusKm })}<input type="range" min={0.5} max={10} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} aria-label={t("map.radiusLabel")} /></label> : null}
          {MAPS_KEY && mapOk !== false ? <div className="search"><Icon name="search" size={18} /><input ref={search} className="input" type="search" aria-label={t("map.search")} placeholder={t("map.search")} /></div> : null}
        </div>
        {groups.map(([label, grp, items]) => (
          <fieldset key={grp} className="chip-group"><legend>{t(label)}</legend>
            {items.map((it) => <button key={it.id} type="button" className="chip" aria-pressed={sel[grp].includes(it.id)} onClick={() => toggle(grp, it.id)}>{grp === "issuer" || grp === "wallet" ? <span className="mono" aria-hidden="true">{initials(it.name)}</span> : null}{it.name}</button>)}
          </fieldset>
        ))}
        <p className="sr-only" role="status">{status || (loading ? t("common.loading") : t("map.results", { n: places.length }))}</p>
        {status ? <p className="hint" aria-hidden="true">{status}</p> : null}
      </section>

      <div className="map-body">
        {mapOk !== false ? <div ref={box} className="map-canvas" role="application" aria-label={t("map.mapLabel")} /> : <div ref={lbox} className="map-canvas" role="application" aria-label={t("map.mapLabel")} />}
        <aside className="map-side glass glass-dark" aria-label={detail ? t("map.panel") : t("map.list")}>
          {detail ? <Panel d={detail} onClose={() => setDetail(null)} /> : (
            <>
              <h2 style={{ fontSize: "1.05rem" }}>{t("map.list")} <Badge>{t("map.results", { n: places.length })}</Badge></h2>
              {error ? <div className="notice bad" role="alert">{error} <button type="button" className="btn secondary sm" onClick={() => void fetchPlaces()}>{t("common.retry")}</button></div> : null}
              {!loading && !places.length && !error ? <EmptyState title={t("map.noResults")} hint={t("map.noResultsHint")} /> : null}
              <ul className="place-list">
                {places.map((p) => (
                  <li key={p.id}><button type="button" className="place" onClick={() => void open(p.id)}>
                    <strong>{p.name}</strong>
                    <span className="muted">{[p.city, p.distanceM !== undefined ? t("map.distance", { m: p.distanceM }) : null].filter(Boolean).join(" · ")}</span>
                    <span>{p.best?.label}{p.offerCount > 1 ? ` · ${t("map.viewOffers", { n: p.offerCount })}` : ""}</span>
                  </button></li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function who(r: Row, t: ReturnType<typeof useT>["t"]) {
  if (r.scope === "CARD_PRODUCT") return r.cardProductName ?? "";
  if (r.scope === "ISSUER_ANY") return t("map.allCardsOf", { name: r.issuerName ?? "" }) + (r.cardType ? ` (${t(`ctype.${r.cardType}` as MessageKey)})` : "");
  if (r.scope === "WALLET") return r.walletName ?? "";
  if (r.scope === "ANY_BANK_CARD") return t("map.anyCard");
  if (r.scope === "ANY_WALLET") return t("map.anyWallet");
  return t("map.everyone");
}

function Panel({ d, onClose }: { d: Detail; onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [d.id]);
  const dirs = d.lat !== null && d.lng !== null ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}` : null;
  return (
    <div className="stack">
      <div className="row between"><h2 ref={ref} tabIndex={-1} style={{ margin: 0 }}>{d.name}</h2><button type="button" className="btn ghost icon-btn" onClick={onClose} aria-label={t("map.closePanel")}><Icon name="x" /></button></div>
      <p className="muted" style={{ margin: 0 }}>{[d.address, d.city].filter(Boolean).join(", ")}{d.openingHours ? ` · ${d.openingHours}` : ""}</p>
      <div className="row">{dirs ? <a className="btn secondary sm" href={dirs} target="_blank" rel="noopener noreferrer">{t("map.directions")}</a> : null}{d.phone ? <a className="btn secondary sm" href={`tel:${d.phone}`}>{t("map.call")}</a> : null}</div>
      <h3>{t("map.offers")}</h3>
      {!d.offers.length ? <p className="muted">{t("map.noOffers")}</p> : d.offers.map((o) => (
        <article key={o.id} className="phone-card">
          <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{o.businessName}</p>
          <h4 style={{ margin: "2px 0 8px", fontFamily: "var(--font-display)" }}>{o.title}</h4>
          <ul className="elig">
            {o.rows.map((r, i) => <li key={i}><span className="big-benefit" style={{ fontSize: "1.1rem" }}>{r.label}</span> <span>{who(r, t)}</span>
              {r.minSpendMzn ? <small className="muted"> · {t("map.minSpend", { n: r.minSpendMzn })}</small> : null}{r.maxDiscountMzn ? <small className="muted"> · {t("map.maxCap", { n: r.maxDiscountMzn })}</small> : null}
              {r.comment ? <small className="muted"> · {r.comment}</small> : null}</li>)}
          </ul>
          {o.days.length ? <p className="muted" style={{ margin: "8px 0 0" }}>{o.days.map((x) => t(`day.${x}` as MessageKey)).join(", ")}{o.from && o.to ? ` · ${o.from}–${o.to}` : ""}</p> : null}
          {o.validTo ? <p className="muted" style={{ margin: 0 }}>{t("map.validUntil", { date: o.validTo })}</p> : null}
          {o.redemption ? <p style={{ margin: "8px 0 0" }}>{o.redemption}</p> : null}
          {o.terms ? <p className="muted" style={{ margin: "4px 0 0" }}>{o.terms}</p> : null}
        </article>
      ))}
    </div>
  );
}
