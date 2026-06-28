# Walk Tracker

A simple, slick, mobile-friendly web app for measuring walks. Open it, find your
area on the map (or search for another), tap to trace the route you walked, and
watch the total distance update live in **miles and kilometers** to one decimal
place. Runs entirely in the browser — no backend, no build step, no API keys,
nothing to pay for.

## Features

- **Map of your area** — centers on your current location by default (with a
  graceful fallback if you deny location access).
- **Place search** — find and jump to any address or place (OpenStreetMap
  Nominatim geocoder).
- **Use my location** — recenter on your GPS position any time.
- **Trace a route** — tap the map to drop waypoints; a glowing path connects
  them. Drag any point to fine-tune. Undo the last point or clear everything.
- **Live distance** — shown big and bold as `2.4 mi · 3.9 km`, recalculated on
  every change using proper great-circle (haversine) math. Tap the readout to
  switch which unit is emphasized.
- **Dark, mobile-first UI** — large touch targets, safe-area aware, the glowing
  path designed to pop against dark map tiles.

## Running it locally

It's just static files, but geolocation and the geocoder work best over
`http://localhost` (not `file://`), so serve the folder:

```bash
# from the project directory
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

> Any static server works (e.g. `npx serve`). On first use the browser will ask
> for location permission — allow it to center on where you are.

## How it's built

Plain HTML/CSS/vanilla JS (ES modules) with [Leaflet](https://leafletjs.com/)
for the map. No framework, no bundler.

```
index.html          App shell + Leaflet CDN links
styles.css          Dark, mobile-first theme + path glow
js/
  app.js            Entry point — wires the UI to everything below
  mapProvider.js    Map adapter (the provider swap boundary — see below)
  route.js          Waypoint state, markers, polyline, distance updates
  distance.js       Haversine + miles/km formatting (pure functions)
  geocode.js        Nominatim search (debounced, auto-cancelling)
  geolocate.js      Geolocation wrapper with fallback
```

### The provider swap boundary

All Leaflet-specific code lives in `js/mapProvider.js`, which exposes a small,
provider-agnostic interface (`setView`, `onMapClick`, `addDraggableMarker`,
`drawPath`, etc.) and passes plain `{ lat, lng }` objects across that boundary.
Swapping to a different map provider means reimplementing that one file against
the same interface — no other module should need to change.

## Future considerations

- **Swap Leaflet/OpenStreetMap for Google Maps.** Google's tiles and geocoding
  are slicker and stronger, but require an API key and a billing account (even
  the free tier needs a card on file). Thanks to the swap boundary above, this
  is largely a single-file change in `js/mapProvider.js`.
- **Accounts + a walk logbook.** Add (optional) login so walks can be saved, and
  a "logbook" view listing every past walk with its date, distance, and route —
  turning the tracker from a one-off measuring tool into a personal history.

## Attribution

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors. Default tiles © [CARTO](https://carto.com/attributions).
Geocoding by [Nominatim](https://nominatim.org/), subject to its
[usage policy](https://operations.osmfoundation.org/policies/nominatim/).
