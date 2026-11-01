
var DEFAULT_LOCATION = {
  name: "Stollies Lake, Theydon Mount",
  lat: 51.6749,
  lon: 0.1527
};

var STORAGE_KEYS = {
  location: "fwloc",
  mode: "fwmode",
  savedLocations: "carpCastSavedLocations"
};

var FORECAST_DAYS = 7;
var MAX_FORECAST_DAYS = 16;

var PRESSURE_START_HOUR = 6;
var PRESSURE_END_HOUR = 21;

var DAYTIME_START_HOUR = 6;
var DAYTIME_END_HOUR = 20;

var SCORE_PERIODS = [
  { name: "Morning", start: 6, end: 12 },
  { name: "Afternoon", start: 12, end: 18 },
  { name: "Evening", start: 18, end: 22 }
];
