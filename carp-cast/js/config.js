/* ==========================================================================
   config.js: settings you may want to change
   ========================================================================== */

// Default forecast location, used before a location is chosen or when GPS fails.
var DEFAULT_LOCATION = {
  name: "Stollies Lake, Theydon Mount",
  lat: 51.6749,
  lon: 0.1527
};

// localStorage keys for the last selected location and its GPS/manual mode.
var STORAGE_KEYS = {
  location: "fwloc",
  mode: "fwmode"   // "gps" = use device location, "manual" = use a typed place
};

// Forecast horizon returned by Open-Meteo.
var FORECAST_DAYS = 7;
// Open-Meteo's forecast endpoint supports up to 16 days from today.
var MAX_FORECAST_DAYS = 16;

// Pressure trend is measured between these hours (24-hour local time).
var PRESSURE_START_HOUR = 6;
var PRESSURE_END_HOUR = 21;

// Daylight hours used to summarise daily wind, cloud and rainfall.
var DAYTIME_START_HOUR = 6;
var DAYTIME_END_HOUR = 20;
