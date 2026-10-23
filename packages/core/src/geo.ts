// Geography helpers for premises (BR-8). Framework-free.

/** Mozambique bounding box, with a small margin for border premises. */
export const MOZ_BBOX = { minLat: -27.0, maxLat: -9.9, minLng: 29.9, maxLng: 41.1 } as const;

export const insideMozambique = (lat: number, lng: number) =>
  lat >= MOZ_BBOX.minLat && lat <= MOZ_BBOX.maxLat && lng >= MOZ_BBOX.minLng && lng <= MOZ_BBOX.maxLng;

const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (Haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
