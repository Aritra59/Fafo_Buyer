const BASE = "https://nominatim.openstreetmap.org";

/**
 * Nominatim usage policy: identify the application; debounce requests.
 * @param {string} query
 * @param {AbortSignal} [signal]
 */
export async function searchPlaces(query, signal) {
  const q = query.trim();
  if (!q) return [];

  const url = new URL(`${BASE}/search`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });

  if (!res.ok) {
    throw new Error("Location search failed. Try again.");
  }

  /** @type {Array<{ lat: string, lon: string, display_name: string }>} */
  const data = await res.json();
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    label: item.display_name,
  }));
}
