/* ==========================================================================
   main.js: app startup, forecast loading, and search/location event handlers
   ========================================================================== */

var forecastRequest = 0;

// Run the data pipeline: download -> summarise -> render, then report its status.
async function loadForecast() {
  var request = ++forecastRequest;
  setPlace(state.location.name);
  showMessage("Loading forecast…");
  try {
    var days = (await fetchForecast(state.location, $("start-date").value)).map(summariseDay);
    if (request !== forecastRequest) return;
    renderForecast(days);
    var time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    showMessage("Updated " + time + state.gpsNote);
  } catch (e) {
    if (request !== forecastRequest) return;
    showMessage("Couldn’t load weather: " + e.message + ". Try Refresh or choose another date.");
  }
}

// Default to today, while preventing future windows that exceed the API's range.
var today = londonDateString(new Date());
$("start-date").value = today;
$("start-date").min = "1940-01-01";
$("start-date").max = addDaysToDate(today, MAX_FORECAST_DAYS - FORECAST_DAYS);
$("start-date").onchange = loadForecast;

var suggestionsTimer;
var suggestionsRequest = 0;
var activeSuggestion = -1;
var placeSuggestions = [];
var selectedPlace = null;

// Close suggestions and invalidate any search request that is still in flight.
function hideSuggestions() {
  suggestionsRequest++;
  placeSuggestions = [];
  $("search-suggestions").hidden = true;
  $("search-input").setAttribute("aria-expanded", "false");
  $("search-input").removeAttribute("aria-activedescendant");
  activeSuggestion = -1;
}

function showSuggestionMessage(message) {
  var list = $("search-suggestions");
  var item = document.createElement("li");
  item.className = "suggestion-message";
  item.setAttribute("role", "presentation");
  item.textContent = message;
  list.replaceChildren(item);
  list.hidden = false;
  $("search-input").setAttribute("aria-expanded", "true");
  $("search-input").removeAttribute("aria-activedescendant");
  activeSuggestion = -1;
}

// Build suggestion options with textContent to keep API text as plain text.
function renderSuggestions(places) {
  var list = $("search-suggestions");
  placeSuggestions = places;
  activeSuggestion = -1;
  list.replaceChildren();
  places.forEach(function (place, index) {
    var option = document.createElement("li");
    option.id = "search-suggestion-" + index;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.dataset.index = index;
    option.textContent = place.name;
    list.appendChild(option);
  });
  list.hidden = places.length === 0;
  $("search-input").setAttribute("aria-expanded", places.length > 0 ? "true" : "false");
  $("search-input").removeAttribute("aria-activedescendant");
}

function setActiveSuggestion(index) {
  activeSuggestion = index;
  Array.prototype.forEach.call($("search-suggestions").querySelectorAll('[role="option"]'), function (option, i) {
    option.setAttribute("aria-selected", i === index ? "true" : "false");
  });
  if (index >= 0) {
    $("search-input").setAttribute("aria-activedescendant", "search-suggestion-" + index);
  } else {
    $("search-input").removeAttribute("aria-activedescendant");
  }
}

async function updateSuggestions(query) {
  var request = ++suggestionsRequest;
  var normalized = query.trim();
  var compact = normalized.replace(/\s+/g, "");
  selectedPlace = null;

  if (normalized.length < 2 || /^[A-Z]{1,2}\d/i.test(compact)) {
    placeSuggestions = [];
    hideSuggestions();
    return;
  }

  showSuggestionMessage("Searching towns…");
  try {
    var places = await searchPlaces(normalized, 5);
    // Ignore an older response if the user has typed or submitted a newer query.
    if (request !== suggestionsRequest || $("search-input").value.trim() !== normalized) return;
    if (places.length) {
      renderSuggestions(places);
    } else {
      placeSuggestions = [];
      showSuggestionMessage("No towns found");
    }
  } catch (error) {
    if (request !== suggestionsRequest) return;
    placeSuggestions = [];
    showSuggestionMessage("Suggestions unavailable. You can still search.");
  }
}

// Resolve a search or selected suggestion, switch location, and load weather.
async function submitLocation(query, place) {
  clearTimeout(suggestionsTimer);
  showMessage("Finding " + query + "…");
  hideSuggestions();
  try {
    setLocation(place || await geocode(query));
    $("search-input").value = "";
    selectedPlace = null;
  } catch (error) {
    showMessage(error.message + ". Try a full postcode or a nearby town.");
  }
}

// ---- Search box: postcode or town ----
$("search-form").onsubmit = async function (event) {
  event.preventDefault();
  var query = $("search-input").value.trim();
  if (!query) return;
  submitLocation(query, selectedPlace && selectedPlace.name === query ? selectedPlace : null);
};

$("search-input").oninput = function () {
  clearTimeout(suggestionsTimer);
  placeSuggestions = [];
  selectedPlace = null;
  hideSuggestions();
  var query = this.value;
  suggestionsTimer = setTimeout(function () {
    updateSuggestions(query);
  }, 250);
};

$("search-input").onkeydown = function (event) {
  if (event.key === "ArrowDown" && placeSuggestions.length) {
    event.preventDefault();
    setActiveSuggestion((activeSuggestion + 1) % placeSuggestions.length);
  } else if (event.key === "ArrowUp" && placeSuggestions.length) {
    event.preventDefault();
    setActiveSuggestion((activeSuggestion - 1 + placeSuggestions.length) % placeSuggestions.length);
  } else if (event.key === "Escape") {
    hideSuggestions();
  } else if (event.key === "Enter" && activeSuggestion >= 0) {
    event.preventDefault();
    selectedPlace = placeSuggestions[activeSuggestion];
    this.value = selectedPlace.name;
    hideSuggestions();
  }
};

$("search-suggestions").onclick = function (event) {
  var option = event.target.closest('[role="option"]');
  if (!option) return;
  selectedPlace = placeSuggestions[Number(option.dataset.index)];
  $("search-input").value = selectedPlace.name;
  hideSuggestions();
  $("search-input").focus();
};

// ---- "Use my location" button ----
$("gps-btn").onclick = function () { useDeviceLocation(false); };

// ---- "Refresh" button: re-checks device location if that is the current mode ----
$("refresh-btn").onclick = function () {
  if (state.mode === "gps") useDeviceLocation(true);
  else loadForecast();
};

// ---- Start-up: restore saved place, then follow the device location if allowed ----
restoreState();
if (state.mode === "gps") useDeviceLocation(true);
else loadForecast();
