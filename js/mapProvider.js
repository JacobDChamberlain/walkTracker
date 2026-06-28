// mapProvider.js — THE provider swap boundary.
//
// Everything Leaflet-specific (`L.*`) lives in this file. The rest of the app
// talks only to the object returned by createMapProvider(), passing plain
// { lat, lng } objects across the boundary — never Leaflet LatLng instances.
//
// To later move to Google Maps, reimplement this one file against the same
// interface; no other module should need to change.
//
// Interface returned:
//   setView(lat, lng, zoom?)
//   onMapClick(cb)                         -> cb({ lat, lng })
//   addDraggableMarker({lat,lng}, opts)    -> markerHandle   (opts: { onDrag, onClick, isStart })
//   updateMarkerStyle(handle, { isStart }) -> void
//   removeMarker(handle)
//   drawPath([{lat,lng}, ...])             -> void  (creates/updates the glowing path)
//   clearPath()
//   fitToPath([{lat,lng}, ...])
//   destroy()

/* global L */

// Tile sources. CARTO Dark Matter is free and matches the dark theme; we fall
// back to standard OSM raster tiles if CARTO fails to load.
const CARTO_DARK_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_LIGHT_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function createMapProvider(containerEl, { center, zoom, theme = "dark" }) {
  const map = L.map(containerEl, {
    center: [center.lat, center.lng],
    zoom,
    zoomControl: false, // mobile-first: we keep the chrome minimal
    attributionControl: true,
    tap: true,
  });

  L.control.zoom({ position: "bottomleft" }).addTo(map);

  // CARTO tiles matching the requested theme, with a graceful fall-back to
  // standard OSM raster tiles if CARTO can't be reached.
  let currentTiles = null;
  function buildTiles(themeName) {
    const url = themeName === "light" ? CARTO_LIGHT_URL : CARTO_DARK_URL;
    const layer = L.tileLayer(url, {
      attribution: CARTO_ATTRIBUTION,
      maxZoom: 20,
      subdomains: "abcd",
    });
    let switchedToFallback = false;
    layer.on("tileerror", () => {
      if (switchedToFallback) return;
      switchedToFallback = true;
      map.removeLayer(layer);
      currentTiles = L.tileLayer(OSM_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
    });
    return layer;
  }
  currentTiles = buildTiles(theme).addTo(map);

  // The glowing path is two stacked polylines: a thick blurred halo beneath a
  // bright thin core. Kept in their own pane so the CSS blur filter applies
  // only to the path, not the whole map.
  map.createPane("walkPath");
  map.getPane("walkPath").classList.add("walk-glow");

  let glowLine = null; // wide, soft underlay
  let coreLine = null; // bright top stroke

  const toLatLngs = (points) => points.map((p) => [p.lat, p.lng]);

  function divIconFor(isStart) {
    return L.divIcon({
      className: "", // avoid Leaflet's default styles
      html: `<div class="waypoint-marker${isStart ? " start" : ""}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  return {
    setView(lat, lng, z) {
      map.setView([lat, lng], z ?? map.getZoom());
    },

    // Swap the basemap tiles between "dark" and "light". Adds the new layer
    // before removing the old one to avoid a flash of empty map.
    setTheme(themeName) {
      const next = buildTiles(themeName).addTo(map);
      if (currentTiles) map.removeLayer(currentTiles);
      currentTiles = next;
    },

    onMapClick(cb) {
      map.on("click", (e) => cb({ lat: e.latlng.lat, lng: e.latlng.lng }));
    },

    addDraggableMarker({ lat, lng }, { onDrag, onClick, isStart } = {}) {
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: divIconFor(isStart),
        keyboard: false,
        autoPan: true,
      }).addTo(map);

      if (onDrag) {
        marker.on("drag", (e) =>
          onDrag({ lat: e.latlng.lat, lng: e.latlng.lng })
        );
      }
      if (onClick) {
        // stop propagation so tapping a marker doesn't also drop a new point
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onClick();
        });
      }
      return marker;
    },

    updateMarkerStyle(marker, { isStart } = {}) {
      if (marker) marker.setIcon(divIconFor(isStart));
    },

    removeMarker(marker) {
      if (marker) map.removeLayer(marker);
    },

    drawPath(points) {
      const latlngs = toLatLngs(points);
      if (latlngs.length < 2) {
        this.clearPath();
        return;
      }
      if (!coreLine) {
        glowLine = L.polyline(latlngs, {
          pane: "walkPath",
          color: "#2dd4bf",
          weight: 10,
          opacity: 0.35,
          lineJoin: "round",
          lineCap: "round",
          interactive: false,
        }).addTo(map);
        coreLine = L.polyline(latlngs, {
          pane: "walkPath",
          color: "#5eead4",
          weight: 4,
          opacity: 1,
          lineJoin: "round",
          lineCap: "round",
          interactive: false,
        }).addTo(map);
      } else {
        glowLine.setLatLngs(latlngs);
        coreLine.setLatLngs(latlngs);
      }
    },

    clearPath() {
      if (glowLine) { map.removeLayer(glowLine); glowLine = null; }
      if (coreLine) { map.removeLayer(coreLine); coreLine = null; }
    },

    fitToPath(points) {
      if (points.length < 2) return;
      map.fitBounds(toLatLngs(points), { padding: [60, 60] });
    },

    destroy() {
      map.remove();
    },
  };
}
