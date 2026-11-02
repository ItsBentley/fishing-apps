
var FORECAST_HOURLY_FIELDS = [
  "temperature_2m", "pressure_msl", "wind_speed_10m",
  "wind_direction_10m", "cloud_cover", "precipitation", "precipitation_probability"
];

async function fetchJson(url, errorMessage) {
  var attempts = 3;

  for (var attempt = 0; attempt < attempts; attempt++) {
    try {
      var response = await fetch(url);
      if (response.ok) return response.json();
      if (response.status !== 429 && response.status !== 502 &&
          response.status !== 503 && response.status !== 504) {
        throw new Error(errorMessage);
      }
    } catch (error) {
      if (error.message === errorMessage) throw error;
    }

    if (attempt < attempts - 1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 750 * Math.pow(2, attempt));
      });
    }
  }

  throw new Error(errorMessage + " (the service is temporarily unavailable)");
}

function placeName(place) {
  return place.name + (place.admin1 ? ", " + place.admin1 : "");
}

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

async function geocode(query) {
  var compact = query.toUpperCase().replace(/\s+/g, "");

  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) {
    var pc = await fetchJson("https://api.postcodes.io/postcodes/" + compact, "Postcode lookup failed");
    if (pc.status !== 200) throw new Error("Postcode not found");
    return {
      name: query.toUpperCase() + " (" + (pc.result.admin_ward || pc.result.admin_district) + ")",
      lat: pc.result.latitude,
      lon: pc.result.longitude
    };
  }

  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact)) {
    var oc = await fetchJson("https://api.postcodes.io/outcodes/" + compact, "Postcode lookup failed");
    if (oc.status !== 200) throw new Error("Postcode area not found");
    return { name: compact + " area", lat: oc.result.latitude, lon: oc.result.longitude };
  }

  var places = await searchPlaces(query, 1);
  if (!places.length) throw new Error("Place not found");
  return places[0];
}

async function nameForCoordinates(lat, lon) {
  try {
    var url = "https://api.postcodes.io/postcodes?lon=" + lon + "&lat=" + lat + "&limit=1";
    var data = await fetchJson(url, "Location lookup failed");
    if (data.result && data.result[0]) {
      return "Near " + (data.result[0].admin_ward || data.result[0].admin_district);
    }
  } catch {}
  return "My location";
}

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
    if (field !== "precipitation_probability" &&
        (!Array.isArray(h[field]) || h[field].length !== h.time.length ||
        !h[field].every(Number.isFinite))) {
      throw new Error("Weather data is incomplete");
    }
  });

  var byDate = Object.create(null);
  var sunTimesByDate = Object.create(null);
  daily.time.forEach(function (date, i) {
    sunTimesByDate[date] = { sunrise: daily.sunrise[i], sunset: daily.sunset[i] };
  });
  h.time.forEach(function (time, i) {
    var date = time.slice(0, 10);
    (byDate[date] = byDate[date] || []).push({
      hr: +time.slice(11, 13),
      t: h.temperature_2m[i],
      p: h.pressure_msl[i],
      w: h.wind_speed_10m[i],
      d: h.wind_direction_10m[i],
      c: h.cloud_cover[i],
      r: h.precipitation[i],
      rp: Array.isArray(h.precipitation_probability) ? h.precipitation_probability[i] : null
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

async function fetchForecast(location, startDate) {
  var today = londonDateString(new Date());
  var latestStart = addDaysToDate(today, MAX_FORECAST_DAYS - FORECAST_DAYS);
  if (!isValidDateString(startDate) ||
      startDate < "1940-01-01" || startDate > latestStart) {
    throw new Error("Choose a start date between 1940-01-01 and " + latestStart);
  }
  var endDate = addDaysToDate(startDate, FORECAST_DAYS - 1);
  var requests = [];

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
