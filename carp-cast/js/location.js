
var state = {
  location: DEFAULT_LOCATION,
  mode: "gps",
  gpsNote: ""
};

function restoreState() {
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.location) || "null");
    if (saved && typeof saved.name === "string" &&
        Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
      state.location = saved;
    }
    var mode = localStorage.getItem(STORAGE_KEYS.mode);
    if (mode === "gps" || mode === "manual") state.mode = mode;
  } catch {}
}

function setLocation(location, mode) {
  state.location = location;
  state.mode = mode || "manual";
  state.gpsNote = "";
  try {
    localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(location));
    localStorage.setItem(STORAGE_KEYS.mode, state.mode);
  } catch {}
  loadForecast();
}

var savedLocations = [];
var savedLocationMap = null;
var savedLocationMarker = null;
var pendingSavedLocation = null;

function restoreSavedLocations() {
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.savedLocations) || "[]");
    savedLocations = Array.isArray(saved) ? saved.filter(function (location) {
      return location && typeof location.name === "string" && Number.isFinite(location.lat) && Number.isFinite(location.lon);
    }) : [];
  } catch (e) {
    savedLocations = [];
  }
}

function persistSavedLocations() {
  try {
    localStorage.setItem(STORAGE_KEYS.savedLocations, JSON.stringify(savedLocations));
  } catch {}
}

function renderSavedLocations() {
  restoreSavedLocations();
  var list = $("saved-locations-list");
  list.replaceChildren();
  if (!savedLocations.length) {
    var empty = document.createElement("p");
    empty.className = "saved-locations-empty";
    empty.textContent = "No saved locations yet.";
    list.appendChild(empty);
    return;
  }

  savedLocations.forEach(function (location, index) {
    var item = document.createElement("div");
    item.className = "saved-location";

    var select = document.createElement("button");
    select.type = "button";
    select.className = "saved-location-select";
    select.textContent = location.name;
    select.onclick = function () {
      $("locations-dialog").close();
      setLocation({ name: location.name, lat: location.lat, lon: location.lon }, "manual");
    };

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "saved-location-remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + location.name);
    remove.onclick = function () {
      savedLocations.splice(index, 1);
      persistSavedLocations();
      renderSavedLocations();
    };

    item.append(select, remove);
    list.appendChild(item);
  });
}

function setMapPin(lat, lon) {
  pendingSavedLocation = { lat: lat, lon: lon };
  if (savedLocationMarker) savedLocationMarker.setLatLng([lat, lon]);
  else savedLocationMarker = L.marker([lat, lon]).addTo(savedLocationMap);
}

function initSavedLocationMap() {
  if (!window.L) {
    showMessage("The map couldn’t load. Check your internet connection and try again.");
    return;
  }
  if (!savedLocationMap) {
    savedLocationMap = L.map("location-map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(savedLocationMap);
    savedLocationMap.on("click", function (event) {
      setMapPin(event.latlng.lat, event.latlng.lng);
    });
  }

  var current = state.location;
  savedLocationMap.setView([current.lat, current.lon], 13);
  setMapPin(current.lat, current.lon);
  setTimeout(function () { savedLocationMap.invalidateSize(); }, 0);
}

function openLocationPicker() {
  $("location-picker").hidden = false;
  $("add-location-btn").hidden = true;
  $("location-name").value = "";
  initSavedLocationMap();
}

function closeLocationPicker() {
  $("location-picker").hidden = true;
  $("add-location-btn").hidden = false;
  $("location-name").value = "";
  pendingSavedLocation = null;
}

function useDeviceLocation(auto) {
  if (!navigator.geolocation) {
    state.gpsNote = " · location not available here";
    if (auto) loadForecast();
    else showMessage("Location isn’t available on this device.");
    return;
  }

  showMessage("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    async function (pos) {
      var name = await nameForCoordinates(pos.coords.latitude, pos.coords.longitude);
      setLocation({ name: name, lat: pos.coords.latitude, lon: pos.coords.longitude }, "gps");
    },
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
