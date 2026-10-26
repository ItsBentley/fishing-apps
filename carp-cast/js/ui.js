/* ==========================================================================
   ui.js: everything that draws on the page
   ========================================================================== */

// Shows the place name above the forecast
function setPlace(name) {
  $("place").textContent = name;
}

// Shows a status message (loading, errors, last updated)
function showMessage(text) {
  $("msg").textContent = text;
}

// Score colours match the verdict bands
function scoreColour(score) {
  return "var(--score-" + verdict(score).toLowerCase() + ")";
}

// Inline SVG keeps forecast icons crisp without extra image or icon dependencies.
function weatherIcon(sky) {
  var icon = sky === "Clear"
    ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>'
    : sky === "Rain" || sky === "Wet"
      ? '<path d="M7 16.5a4.5 4.5 0 0 1-.2-9A6 6 0 0 1 18.4 9a3.8 3.8 0 0 1 .1 7.5H7Z"></path><path d="m9 19-1 2m6-2-1 2m6-2-1 2"></path>'
      : sky === "Partly cloudy"
        ? '<path d="M12 3v2m-6.36.64 1.42 1.42M3 12h2m14 0h2"></path><path d="M8 15.5a4 4 0 0 1-.2-8A5.5 5.5 0 0 1 18.5 9a3.3 3.3 0 0 1 .1 6.5H8Z"></path>'
        : '<path d="M7 17a4.5 4.5 0 0 1-.2-9A6 6 0 0 1 18.4 9a4 4 0 0 1 .1 8H7Z"></path>';
  return '<svg class="weather-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    icon + '</svg>';
}

function moonIcon(phase) {
  var light = "#d8e1e8";
  var dark = "var(--card)";
  var shape;
  if (phase === "New moon") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + dark + '" stroke="currentColor" stroke-width="1.5"></circle>';
  } else if (phase === "Waxing crescent") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + light + '"></circle><circle cx="7" cy="10" r="8" fill="' + dark + '"></circle>';
  } else if (phase === "First quarter") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + dark + '"></circle><path d="M12 3a9 9 0 0 1 0 18Z" fill="' + light + '"></path>';
  } else if (phase === "Waxing gibbous") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + light + '"></circle><circle cx="7" cy="10" r="7" fill="' + dark + '"></circle>';
  } else if (phase === "Full moon") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + light + '"></circle>';
  } else if (phase === "Waning gibbous") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + light + '"></circle><circle cx="17" cy="10" r="7" fill="' + dark + '"></circle>';
  } else if (phase === "Last quarter") {
    shape = '<circle cx="12" cy="12" r="9" fill="' + dark + '"></circle><path d="M12 3a9 9 0 0 0 0 18Z" fill="' + light + '"></path>';
  } else {
    shape = '<circle cx="12" cy="12" r="9" fill="' + light + '"></circle><circle cx="17" cy="10" r="8" fill="' + dark + '"></circle>';
  }
  return '<svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true">' + shape + '</svg>';
}

function windArrow(degrees) {
  if (!Number.isFinite(degrees)) return "";
  // Meteorological directions point toward where wind comes from; rotate to downwind.
  var downwindDegrees = (degrees + 180) % 360;
  return '<svg class="wind-arrow" viewBox="0 0 24 24" aria-label="Arrow points downwind" ' +
    'style="transform:rotate(' + downwindDegrees + 'deg)" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 21V4m0 0-6 6m6-6 6 6"></path></svg>';
}

function pressureIcon() {
  return '<svg class="pressure-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 19a9 9 0 1 1 16 0H4Z"></path><path d="m12 14 4-5m-8 10h8"></path></svg>';
}

function windIcon() {
  return '<svg class="metric-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 8h13a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h7"></path></svg>';
}

function moonLabelIcon() {
  return '<svg class="metric-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
    '<path d="M20.2 15.6A8.5 8.5 0 0 1 8.4 3.8 8.5 8.5 0 1 0 20.2 15.6Z"></path></svg>';
}

// Render a scored week. Forecast values are prepared by summariseDay before reaching here.
function renderForecast(days) {
  var best = days.reduce(function (a, b) { return b.score > a.score ? b : a; });

  // Best day summary
  $("best").hidden = false;
  $("best").innerHTML =
    '<div>Best day in this range</div>' +
    '<div class="big">' + best.label + '</div>' +
    '<p>' + verdict(best.score) + ' (' + best.score + '/100) · pressure ' + best.trend +
    ' at ' + best.p1 + ' mb, ' + best.sky.toLowerCase() + ', ' + best.hi + '°C</p>';

  // Daily cards
  $("list").innerHTML = days.map(function (d) {
    var colour = scoreColour(d.score);
    var rainfall = d.rain >= 0.2
      ? '<div class="rainfall">Rainfall <strong>' + d.rain.toFixed(1) + ' mm</strong></div>'
      : "";
    var fishingTime = d.fishingWindow
      ? d.fishingWindow.name + " · " + d.fishingWindow.start + "–" + d.fishingWindow.end
      : "No suitable forecast window available";
    var bank = d.bankDirection
      ? d.bankDirection + " side, if accessible"
      : "No clear wind-based side";

    return '<article class="row' + (d === best ? ' top' : '') + '">' +
      '<div class="forecast-header">' +
        '<div class="forecast-main">' +
          '<div class="day">' + d.label + '</div>' +
          '<div class="forecast-condition">' + weatherIcon(d.sky) + d.sky + '</div>' +
          '<div class="temperature">High ' + d.hi + '° <span>·</span> Low ' + d.lo + '°C</div>' +
          rainfall +
        '</div>' +
        '<div class="sc" style="color:' + colour + '">' +
          d.score + '<small>' + verdict(d.score) + '</small>' +
        '</div>' +
      '</div>' +
      '<div class="weather-metrics">' +
        '<div class="metric"><span class="metric-label">' + windIcon() +
          ' Wind</span><strong class="wind-value">' +
          windArrow(d.windDirectionDegrees) + d.wind + ' mph</strong><small>' +
          d.windDirection + '</small></div>' +
        '<div class="metric"><span class="metric-label">' + pressureIcon() +
          ' Pressure</span><strong>' + d.p1 + ' mb</strong><small>' +
          d.trend + '</small></div>' +
        '<div class="metric"><span class="metric-label">' + moonLabelIcon() +
          ' Moon phase</span><strong class="moon-value">' +
          moonIcon(d.moon) + d.moon + '</strong></div>' +
      '</div>' +
      '<div class="sun-times"><span>Sunrise <strong>' + d.sunrise.slice(11, 16) +
        '</strong></span><span>Sunset <strong>' + d.sunset.slice(11, 16) + '</strong></span></div>' +
      '<div class="fishing-advice">' +
        '<div><span>Best time</span><strong>' + fishingTime + '</strong></div>' +
        '<div><span>Bank to try</span><strong>' + bank + '</strong></div>' +
      '</div>' +
      '<div class="bar"><i style="width:' + d.score + '%;background:' + colour + '"></i></div>' +
      '</article>';
  }).join("");
}
