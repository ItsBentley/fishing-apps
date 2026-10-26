/* ==========================================================================
   api.js: everything that talks to outside weather and location services
   - postcodes.io: UK postcode lookups
   - Open-Meteo: town search and the weather forecast
   ========================================================================== */

var FORECAST_HOURLY_FIELDS = [
  "temperature_2m", "pressure_msl", "wind_speed_10m",
  "wind_direction_10m", "cloud_cover", "precipitation"
];

// Fetch JSON from a service and surface HTTP failures to the caller.
async function fetchJson(url, errorMessage) {
  var response = await fetch(url);
  if (!response.ok) throw new Error(errorMessage);
  return response.json();
}

// Format a geocoding result consistently for suggestions and direct searches.
function placeName(place) {
  return place.name + (place.admin1 ? ", " + place.admin1 : "");
}

// Return UK town suggestions with the coordinates needed to load a forecast.
async function searchPlaces(query, count) {
  var url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(query) +
            "&count=" + count + "&language=en&countryCode=GB";
  var data = await fetchJson(url, "Place lookup failed");
  return (data.results || []).map(function (place) {
    return {
      name: placeName(place),
      lat: place.latitude,
      lon: place.longitude
    };
  });
}

// Turns a postcode or town name into {name, lat, lon}. Throws if not found.
async function geocode(query) {
  var compact = query.toUpperCase().replace(/\s+/g, "");

  // Full postcode, e.g. CM16 4AB
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) {
    var pc = await fetchJson("https://api.postcodes.io/postcodes/" + compact, "Postcode lookup failed");
    if (pc.status !== 200) throw new Error("Postcode not found");
    return {
      name: query.toUpperCase() + " (" + (pc.result.admin_ward || pc.result.admin_district) + ")",
      lat: pc.result.latitude,
      lon: pc.result.longitude
    };
  }

  // Postcode area only, e.g. CM16
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact)) {
    var oc = await fetchJson("https://api.postcodes.io/outcodes/" + compact, "Postcode lookup failed");
    if (oc.status !== 200) throw new Error("Postcode area not found");
    return { name: compact + " area", lat: oc.result.latitude, lon: oc.result.longitude };
  }

  // Anything else is treated as a town or place name
  var places = await searchPlaces(query, 1);
  if (!places.length) throw new Error("Place not found");
  return places[0];
}

// Finds a friendly name ("Near Theydon Bois") for GPS coordinates
async function nameForCoordinates(lat, lon) {
  try {
    var url = "https://api.postcodes.io/postcodes?lon=" + lon + "&lat=" + lat + "&limit=1";
    var data = await fetchJson(url, "Location lookup failed");
    if (data.result && data.result[0]) {
      return "Near " + (data.result[0].admin_ward || data.result[0].admin_district);
    }
  } catch (e) { /* fall through to the generic name */ }
  return "My location";
}

// Use the app's forecast timezone rather than the device timezone for date boundaries.
function londonDateString(date) {
  var parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  var values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + "-" + values.month + "-" + values.day;
}

// Do date arithmetic at UTC noon to avoid daylight-saving and timezone rollover.
function addDaysToDate(dateString, days) {
  var date = new Date(dateString + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isValidDateString(dateString) {
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  var date = new Date(dateString + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}

function weatherUrl(isHistorical, location, startDate, endDate) {
  var host = isHistorical ? "archive-api.open-meteo.com" : "api.open-meteo.com";
  var endpoint = isHistorical ? "archive" : "forecast";
  return "https://" + host + "/v1/" + endpoint +
    "?latitude=" + location.lat + "&longitude=" + location.lon +
    "&hourly=" + FORECAST_HOURLY_FIELDS.join(",") +
    "&daily=sunrise,sunset&wind_speed_unit=mph&timezone=Europe%2FLondon" +
    "&start_date=" + startDate + "&end_date=" + endDate;
}

// Convert the API's parallel arrays into the per-day structure used by scoring:
// [{ date, hours: [{hr, t, p, w, d, c, r}, ...], sunrise, sunset }, ...]
// t = temp (C), p = pressure (mb), w = wind (mph), d = wind direction (degrees),
// c = cloud (%), r = rain (mm)
function groupWeatherByDay(forecast) {
  var h = forecast.hourly;
  var daily = forecast.daily;
  if (!h || !daily || !Array.isArray(h.time) || !h.time.length ||
      !Array.isArray(daily.time) || !daily.time.length ||
      !Array.isArray(daily.sunrise) || !Array.isArray(daily.sunset) ||
      daily.sunrise.length !== daily.time.length ||
      daily.sunset.length !== daily.time.length) {
    throw new Error("Weather data is incomplete");
  }
  FORECAST_HOURLY_FIELDS.forEach(function (field) {
    if (!Array.isArray(h[field]) || h[field].length !== h.time.length ||
        !h[field].every(Number.isFinite)) {
      throw new Error("Weather data is incomplete");
    }
  });

  // Index sun times by date once so each forecast day can be joined in constant time.
  var byDate = Object.create(null);
  var sunTimesByDate = Object.create(null);
  daily.time.forEach(function (date, i) {
    sunTimesByDate[date] = { sunrise: daily.sunrise[i], sunset: daily.sunset[i] };
  });
  h.time.forEach(function (time, i) {
    var date = time.slice(0, 10);
    // Compact property names keep each hourly record small; see the shape above.
    (byDate[date] = byDate[date] || []).push({
      hr: +time.slice(11, 13),
      t: h.temperature_2m[i],
      p: h.pressure_msl[i],
      w: h.wind_speed_10m[i],
      d: h.wind_direction_10m[i],
      c: h.cloud_cover[i],
      r: h.precipitation[i]
    });
  });

  var days = Object.keys(byDate).map(function (date) {
    var sunTimes = sunTimesByDate[date];
    if (!sunTimes || !sunTimes.sunrise || !sunTimes.sunset) {
      throw new Error("Sunrise and sunset data is missing");
    }
    return {
      date: date,
      hours: byDate[date],
      sunrise: sunTimes.sunrise,
      sunset: sunTimes.sunset
    };
  });
  if (!days.length) throw new Error("Weather data is incomplete");
  return days;
}

// Historical dates use the archive API; today and later use the forecast API.
async function fetchForecast(location, startDate) {
  var today = londonDateString(new Date());
  var latestStart = addDaysToDate(today, MAX_FORECAST_DAYS - FORECAST_DAYS);
  if (!isValidDateString(startDate) ||
      startDate < "1940-01-01" || startDate > latestStart) {
    throw new Error("Choose a start date between 1940-01-01 and " + latestStart);
  }
  var endDate = addDaysToDate(startDate, FORECAST_DAYS - 1);
  var requests = [];

  // Split ranges that cross today so past days come from the archive and future days from forecast.
  if (startDate < today) {
    var historicalEnd = endDate < today ? endDate : addDaysToDate(today, -1);
    requests.push(fetchJson(
      weatherUrl(true, location, startDate, historicalEnd),
      "Historical weather service error"
    ).then(groupWeatherByDay));
  }

  if (endDate >= today) {
    var forecastStart = startDate > today ? startDate : today;
    requests.push(fetchJson(
      weatherUrl(false, location, forecastStart, endDate),
      "Weather service error"
    ).then(groupWeatherByDay));
  }

  // Preserve chronological order and reject API responses with missing days.
  var days = (await Promise.all(requests)).reduce(function (all, range) {
    return all.concat(range);
  }, []).sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
  var completeRange = days.length === FORECAST_DAYS &&
    days.every(function (day, index) {
      return day.date === addDaysToDate(startDate, index);
    });
  if (!completeRange || days[0].date !== startDate || days[days.length - 1].date !== endDate) {
    throw new Error("Weather data is not available for the entire selected date range");
  }
  return days;
}
