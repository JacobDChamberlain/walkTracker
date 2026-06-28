// geolocate.js — thin wrapper around the browser Geolocation API.

// Fallback when geolocation is denied/unavailable: central San Francisco.
export const DEFAULT_LOCATION = { lat: 37.7749, lng: -122.4194, label: "San Francisco" };

/**
 * Resolve the user's current position as { lat, lng }.
 * Rejects with an Error (message suitable for a toast) on denial/timeout/unsupported.
 */
export function getCurrentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location isn't supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: "Location permission denied.",
          2: "Couldn't determine your location.",
          3: "Location request timed out.",
        };
        reject(new Error(messages[err.code] || "Couldn't get your location."));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  });
}
