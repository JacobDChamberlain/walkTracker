// distance.js — great-circle distance math and unit formatting.
// Pure functions, no DOM or map dependencies, so the math is easy to test.

const EARTH_RADIUS_M = 6371008.8; // mean Earth radius in meters (IUGG)
const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Haversine great-circle distance between two {lat, lng} points, in meters.
 * Accurate for the short, walking-scale segments this app deals with.
 */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Total distance in meters along an ordered array of {lat, lng} waypoints.
 * Returns 0 for 0 or 1 points.
 */
export function totalDistance(waypoints) {
  let meters = 0;
  for (let i = 1; i < waypoints.length; i++) {
    meters += haversine(waypoints[i - 1], waypoints[i]);
  }
  return meters;
}

/**
 * Format a meter distance into display strings, each rounded to one decimal.
 * e.g. format(3900) -> { miles: "2.4 mi", km: "3.9 km", miValue: 2.4, kmValue: 3.9 }
 */
export function format(meters) {
  const miValue = meters / METERS_PER_MILE;
  const kmValue = meters / METERS_PER_KM;
  return {
    miValue,
    kmValue,
    miles: `${miValue.toFixed(1)} mi`,
    km: `${kmValue.toFixed(1)} km`,
  };
}
