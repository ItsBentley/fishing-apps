/* ==========================================================================
   location.js: which place we are showing, and how it is chosen
   ========================================================================== */

// Current location, selection mode, and any GPS fallback note shown to the user.
var state = {
  location: DEFAULT_LOCATION,
  mode: "gps",     // "gps" = follow the device location, "manual" = typed place
  gpsNote: ""      // small note added to the status message (e.g. location blocked)
};

// Restore only valid saved values so stale or malformed storage cannot break startup.
function restoreState() {
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.location) || "null");
    if (saved && typeof saved.name === "string" &&
        Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
      state.location = saved;
    }
    var mode = localStorage.getItem(STORAGE_KEYS.mode);
    if (mode === "gps" || mode === "manual") state.mode = mode;
  } catch (e) { /* storage unavailable: keep defaults */ }
}

// Select a location, persist it when storage is available, then reload the forecast.
function setLocation(location, mode) {
  state.location = location;
  state.mode = mode || "manual";
  state.gpsNote = "";
  try {
    localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(location));
    localStorage.setItem(STORAGE_KEYS.mode, state.mode);
  } catch (e) { /* storage unavailable: carry on without saving */ }
  loadForecast();
}

// Ask the browser for GPS. Automatic checks fall back to the saved/default location.
function useDeviceLocation(auto) {
  if (!navigator.geolocation) {
    state.gpsNote = " · location not available here";
    if (auto) loadForecast();
    else showMessage("Location isn’t available on this device.");
    return;
  }

  showMessage("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    // Success: name the spot and show its forecast
    async function (pos) {
      var name = await nameForCoordinates(pos.coords.latitude, pos.coords.longitude);
      setLocation({ name: name, lat: pos.coords.latitude, lon: pos.coords.longitude }, "gps");
    },
    // Blocked or failed
    function () {
      if (auto) {
        state.gpsNote = " · location blocked, showing " + state.location.name;
        loadForecast();
      } else {
        showMessage("Couldn’t get your location. Check location permission, or type a postcode.");
      }
    },
    { timeout: 10000, maximumAge: 600000 }
  );
}
