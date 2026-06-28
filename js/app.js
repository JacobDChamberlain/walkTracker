// app.js — entry point. Wires the DOM controls to the map, route, geocoder
// and geolocation modules. This is the only place that touches both the DOM
// and the (provider-agnostic) map interface.

import { createMapProvider } from "./mapProvider.js";
import { createRoute } from "./route.js";
import { format } from "./distance.js";
import { debouncedSearch } from "./geocode.js";
import { getCurrentPosition, DEFAULT_LOCATION } from "./geolocate.js";

const DEFAULT_ZOOM = 16;

// --- DOM references --------------------------------------------------------
const els = {
  map: document.getElementById("map"),
  searchInput: document.getElementById("search-input"),
  searchClear: document.getElementById("search-clear"),
  searchResults: document.getElementById("search-results"),
  locateBtn: document.getElementById("locate-btn"),
  distMiles: document.getElementById("dist-miles"),
  distKm: document.getElementById("dist-km"),
  distanceWrap: document.querySelector(".distance"),
  undoBtn: document.getElementById("undo-btn"),
  clearBtn: document.getElementById("clear-btn"),
  hint: document.getElementById("hint"),
  toast: document.getElementById("toast"),
};

// --- Transient toast -------------------------------------------------------
let toastTimer = null;
function showToast(message, ms = 3200) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  // force reflow so the opacity transition runs even on rapid re-show
  void els.toast.offsetWidth;
  els.toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
    setTimeout(() => (els.toast.hidden = true), 250);
  }, ms);
}

// --- Map + route setup -----------------------------------------------------
const map = createMapProvider(els.map, {
  center: DEFAULT_LOCATION,
  zoom: DEFAULT_ZOOM,
});

const route = createRoute(map, { onChange: onRouteChange, onLongJump: onLongJump });

// Sarcastic nudges for when a dot lands 50+ miles from the last one.
const SARCASM = [
  "Bold of you to call that a walk.",
  "Did you teleport? That's over {mi} miles in one step.",
  "{mi} miles between two dots. Hope you stretched.",
  "That's not a walk, that's a road trip.",
  "Olympic long jump record: ~29 feet. You: {mi} miles. Impressive.",
  "I admire the confidence, but {mi} miles is a flight, not a stroll.",
  "{mi} miles. Your Fitbit just filed for overtime.",
  "Sure, let me just add your {mi}-mile sprint to the books.",
  "Either you've got rocket shoes or that's a typo. {mi} miles?",
  "Marathon: 26.2 miles. You: {mi} miles. Between two dots. Casually.",
  "{mi} miles? I'll alert the Guinness people.",
  "Walking {mi} miles in one step is certainly... a choice.",
  "That dot's in a different time zone. {mi} miles, really?",
  "Cool, cool. Just {mi} miles. Totally normal walk stuff.",
  "{mi} miles between dots. Did you walk or get deported?",
  "Ah yes, the classic {mi}-mile afternoon constitutional.",
  "Your legs called. They're suing over {mi} miles.",
  "{mi} miles? Even Forrest Gump took breaks.",
  "I've seen flights shorter than {mi} miles.",
  "{mi} miles in one step. NASA would like a word.",
  "That's a {mi}-mile gap. Were you dragged by a plane?",
  "Pics or it didn't happen. {mi} miles, sure.",
  "{mi} miles. Your shoes deserve hazard pay.",
  "Strava is going to have so many questions about these {mi} miles.",
  "{mi} miles between two dots — bold storytelling.",
  "You walked {mi} miles? And I'm the unreliable narrator.",
  "{mi} miles. I'd ask if you're okay, but clearly you're a machine.",
  "Hot take: {mi} miles is not a 'quick loop.'",
];

function onLongJump({ miValue }) {
  const pick = SARCASM[Math.floor(Math.random() * SARCASM.length)];
  showToast(pick.replaceAll("{mi}", miValue.toFixed(1)));
}

// Tap the map to drop a waypoint.
map.onMapClick(({ lat, lng }) => route.addPoint({ lat, lng }));

function onRouteChange({ meters, count }) {
  const { miles, km } = format(meters);
  els.distMiles.textContent = miles;
  els.distKm.textContent = km;

  const hasPoints = count > 0;
  els.undoBtn.disabled = !hasPoints;
  els.clearBtn.disabled = !hasPoints;

  if (count === 0) els.hint.textContent = "Tap the map to start tracing your walk.";
  else if (count === 1) els.hint.textContent = "Keep tapping to extend your route.";
  else els.hint.textContent = "Drag any point to fine-tune your route.";
}

// Tapping the distance readout swaps which unit is emphasized.
els.distanceWrap.addEventListener("click", () => {
  els.distanceWrap.classList.toggle("km-primary");
});

// --- Path controls ---------------------------------------------------------
els.undoBtn.addEventListener("click", () => route.undo());
els.clearBtn.addEventListener("click", () => route.clear());

// --- Geolocation -----------------------------------------------------------
async function locate({ silentOnError = false } = {}) {
  els.locateBtn.classList.add("locating");
  try {
    const pos = await getCurrentPosition();
    map.setView(pos.lat, pos.lng, DEFAULT_ZOOM);
  } catch (err) {
    if (!silentOnError) showToast(err.message);
    else showToast(`${err.message} Showing ${DEFAULT_LOCATION.label}.`);
  } finally {
    els.locateBtn.classList.remove("locating");
  }
}

els.locateBtn.addEventListener("click", () => locate());

// On load, try to center on the user; fall back quietly to the default.
locate({ silentOnError: true });

// --- Location search -------------------------------------------------------
const runSearch = debouncedSearch(400);
let activeIndex = -1; // keyboard navigation within results

function clearResults() {
  els.searchResults.innerHTML = "";
  els.searchResults.hidden = true;
  activeIndex = -1;
}

function renderResults(results) {
  els.searchResults.innerHTML = "";
  activeIndex = -1;

  if (!results.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No matches found.";
    els.searchResults.appendChild(li);
    els.searchResults.hidden = false;
    return;
  }

  results.forEach((r) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.textContent = r.label;
    li.addEventListener("click", () => selectResult(r));
    els.searchResults.appendChild(li);
  });
  els.searchResults.hidden = false;
}

function selectResult(result) {
  map.setView(result.lat, result.lng, DEFAULT_ZOOM);
  els.searchInput.value = result.label.split(",")[0];
  els.searchInput.blur();
  clearResults();
}

els.searchInput.addEventListener("input", async () => {
  const q = els.searchInput.value;
  els.searchClear.hidden = q.length === 0;

  if (q.trim().length < 3) {
    clearResults();
    return;
  }
  try {
    renderResults(await runSearch(q));
  } catch {
    showToast("Search failed — check your connection.");
  }
});

// Keyboard support for the results list.
els.searchInput.addEventListener("keydown", (e) => {
  const items = [...els.searchResults.querySelectorAll('li[role="option"]')];
  if (!items.length) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex =
      e.key === "ArrowDown"
        ? (activeIndex + 1) % items.length
        : (activeIndex - 1 + items.length) % items.length;
    items.forEach((li, i) =>
      li.setAttribute("aria-selected", i === activeIndex ? "true" : "false")
    );
  } else if (e.key === "Enter") {
    e.preventDefault();
    (items[activeIndex] || items[0]).click();
  } else if (e.key === "Escape") {
    clearResults();
    els.searchInput.blur();
  }
});

els.searchClear.addEventListener("click", () => {
  els.searchInput.value = "";
  els.searchClear.hidden = true;
  clearResults();
  els.searchInput.focus();
});

// Dismiss results when tapping elsewhere.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) clearResults();
});
