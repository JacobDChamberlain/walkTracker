// route.js — manages the walked route: an ordered list of waypoints, their
// draggable markers, the glowing polyline, and the running distance.
//
// It owns no DOM and no Leaflet code directly — it drives the map only through
// the mapProvider interface and reports changes via an onChange callback.

import { totalDistance, haversine, format } from "./distance.js";

// Dropping a new dot farther than this from the previous one is almost
// certainly not a walk — we call it out with a sarcastic message.
const LONG_JUMP_MILES = 50;

export function createRoute(mapProvider, { onChange, onLongJump } = {}) {
  // Parallel arrays: waypoints[i] is the coordinate, markers[i] its handle.
  const waypoints = [];
  const markers = [];

  function notify() {
    if (onChange) {
      onChange({
        meters: totalDistance(waypoints),
        count: waypoints.length,
      });
    }
  }

  function redrawPath() {
    mapProvider.drawPath(waypoints);
  }

  // The first marker is styled distinctly as the "start". Whenever index 0
  // changes (add first / undo / clear) we refresh marker styling.
  function refreshStartStyle() {
    markers.forEach((m, i) => mapProvider.updateMarkerStyle(m, { isStart: i === 0 }));
  }

  return {
    /** Append a waypoint at { lat, lng } and drop a draggable marker for it. */
    addPoint({ lat, lng }) {
      const index = waypoints.length;
      const point = { lat, lng };

      // Flag an implausibly long hop from the previous dot before adding it.
      if (index > 0 && onLongJump) {
        const jump = format(haversine(waypoints[index - 1], point));
        if (jump.miValue > LONG_JUMP_MILES) onLongJump(jump);
      }

      waypoints.push(point);

      const marker = mapProvider.addDraggableMarker(point, {
        isStart: index === 0,
        // Live-update this waypoint's coords as its marker is dragged.
        onDrag: (pos) => {
          const i = markers.indexOf(marker);
          if (i === -1) return;
          waypoints[i] = { lat: pos.lat, lng: pos.lng };
          redrawPath();
          notify();
        },
      });
      markers.push(marker);

      redrawPath();
      notify();
    },

    /** Remove the most recently added waypoint. */
    undo() {
      if (!waypoints.length) return;
      waypoints.pop();
      const marker = markers.pop();
      mapProvider.removeMarker(marker);
      refreshStartStyle();
      redrawPath();
      notify();
    },

    /** Remove every waypoint and the path. */
    clear() {
      markers.forEach((m) => mapProvider.removeMarker(m));
      markers.length = 0;
      waypoints.length = 0;
      mapProvider.clearPath();
      notify();
    },

    get count() {
      return waypoints.length;
    },
  };
}
