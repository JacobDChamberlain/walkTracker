// geocode.js — address/place search via OpenStreetMap Nominatim (free, keyless).
//
// Nominatim usage policy: <=1 request/second and a meaningful identifier.
// We debounce input and only fire after the user pauses typing. Browsers don't
// let us set a custom User-Agent on fetch, but the Referer (this page) is sent
// automatically, which satisfies the identification requirement for light use.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Search for a place. Returns a promise resolving to an array of
 * { label, lat, lng } results (possibly empty). Throws on network failure.
 */
export async function search(query, { limit = 6, signal } = {}) {
  const q = query.trim();
  if (!q) return [];

  const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=0&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);

  const data = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

/**
 * Wrap an async function with debouncing + automatic cancellation of the
 * in-flight request (via AbortController) so only the latest query matters.
 * Returns a function that resolves with the latest result.
 */
export function debouncedSearch(delay = 400) {
  let timer = null;
  let controller = null;

  return (query) =>
    new Promise((resolve, reject) => {
      if (timer) clearTimeout(timer);
      if (controller) controller.abort();

      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          resolve(await search(query, { signal: controller.signal }));
        } catch (err) {
          if (err.name === "AbortError") return; // superseded — ignore
          reject(err);
        }
      }, delay);
    });
}
