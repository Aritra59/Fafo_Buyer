/**
 * Normalize any supported location shape to { lat, lng } or null.
 * @param {unknown} loc
 * @returns {{ lat: number, lng: number } | null}
 */
export function normalizeLocation(loc) {
  if (loc == null) return null;

  if (typeof loc === "object") {
    if (typeof loc.lat === "number" && typeof loc.lng === "number") {
      if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
        return { lat: loc.lat, lng: loc.lng };
      }
    }
    if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
        return { lat: loc.latitude, lng: loc.longitude };
      }
    }
  }

  if (Array.isArray(loc) && loc.length >= 2) {
    const lat = Number(loc[0]);
    const lng = Number(loc[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  if (typeof loc === "string") {
    const match = loc.match(/([\d.+-]+).*?([\d.+-]+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}
