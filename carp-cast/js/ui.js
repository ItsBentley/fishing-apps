/* ==========================================================================
   ui.js: everything that draws on the page
   ========================================================================== */

function setPlace(name) {
  $("place").textContent = name;
}

function showMessage(text) {
  $("msg").textContent = text;
}

function scoreColour(score) {
  return "var(--score-" + verdict(score).toLowerCase() + ")";
}

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

function sunIcon(sunset) {
  var arrow = sunset
    ? '<path d="M27 3v7m0 0-2.5-2.5M27 10l2.5-2.5"></path>'
    : '<path d="M27 10V3m0 0-2.5 2.5M27 3l2.5 2.5"></path>';
  return '<svg class="sun-icon" viewBox="0 0 30 24" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 16a7 7 0 0 1 14 0"></path><path d="M12 2v2M4.9 5.9l1.4 1.4M19.1 5.9l-1.4 1.4M2 16h20"></path>' + arrow + '</svg>';
}

function formatHour(hour) {
  return (hour < 10 ? '0' : '') + hour + ':00';
}

function pressureChart(hours) {
  var pressures = hours.map(function (hour) { return hour.p; });
  var min = Math.min.apply(null, pressures);
  var max = Math.max.apply(null, pressures);
  var range = Math.max(max - min, 1);
  var points = pressures.map(function (pressure, index) {
    var x = pressures.length === 1 ? 330 : 50 + index * 530 / (pressures.length - 1);
    var y = 105 - (pressure - min) / range * 85;
    return Math.round(x) + ',' + Math.round(y);
  }).join(' ');
  var labels = [
    { pressure: max, y: 20 },
    { pressure: min + range * 0.5, y: 62.5 },
    { pressure: min, y: 105 }
  ].map(function (label) {
    return '<text x="48" y="' + Math.round(label.y) + '" text-anchor="end" dominant-baseline="middle" class="chart-axis-value">' + Math.round(label.pressure) + '</text>';
  }).join('');
  var gridLines = [20, 62.5, 105].map(function (y) {
    return '<line x1="50" y1="' + Math.round(y) + '" x2="580" y2="' + Math.round(y) + '" class="chart-grid-line"></line>';
  }).join('');
  var labelHours = [0, 6, 12, 18, 23].filter(function (hour) {
    return hours.some(function (item) { return item.hr === hour; });
  });
  var timeLabels = labelHours.map(function (hour) {
    var index = hours.map(function (item) { return item.hr; }).indexOf(hour);
    var x = hours.length === 1 ? 300 : 50 + index * 530 / (hours.length - 1);
    var anchor = index === 0 ? "start" : index === hours.length - 1 ? "end" : "middle";
    return '<text x="' + Math.round(x) + '" y="132" dominant-baseline="hanging" class="chart-axis-label" text-anchor="' + anchor + '">' + formatHour(hour) + '</text>';
  }).join('');
  return '<svg class="line-chart" viewBox="0 0 600 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Hourly pressure chart">' +
    gridLines + labels + '<polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
    timeLabels + '</svg>';
}

function rainfallChart(hours) {
  return '<div class="rain-chart-scroll"><div class="rain-chart" role="img" aria-label="Hourly rainfall and rain probability chart">' +
    hours.map(function (hour, index) {
      var probability = Number.isFinite(hour.rp) ? Math.max(0, Math.min(100, hour.rp)) : 0;
      return '<div class="rain-chart-hour' + (index % 2 === 0 ? ' show-rain-percent' : '') + (index % 6 === 0 ? ' show-rain-time' : '') + '" title="' + formatHour(hour.hr) + ': ' + hour.r.toFixed(1) + ' mm, ' + probability + '% chance">' +
        '<div class="rain-chart-bar" style="height:' + probability + '%"><span>' + probability + '%</span><i></i></div>' +
        '<small>' + formatHour(hour.hr) + '</small></div>';
    }).join('') + '</div></div>';
}

function renderForecast(days) {
  var best = days.reduce(function (a, b) { return b.score > a.score ? b : a; });
  var bestPeriod = best.periods && best.periods.length
    ? best.periods.reduce(function (a, b) { return b.score > a.score ? b : a; })
    : null;

  $("best").hidden = false;
  $("best").innerHTML =
    '<div class="best-heading">' +
      '<div><div>Best day in this range</div><div class="big">' + best.label + '</div></div>' +
      (bestPeriod ? '<div class="best-period-weather">' + weatherIcon(bestPeriod.sky) +
        '<span><strong>' + bestPeriod.name + '</strong>' + bestPeriod.sky + '</span></div>' : '') +
    '</div>' +
    '<p class="best-details">' + verdict(best.score) + ' (' + best.score + '/100) · pressure ' + best.trend +
    ' at ' + best.p1 + ' mb, ' + best.sky.toLowerCase() + ', ' + best.hi + '°C</p>' +
    (bestPeriod ? '<div class="best-period-score">' +
      '<div class="best-period-copy"><span>Best time</span><strong>' + bestPeriod.name + '</strong></div>' +
      '<div class="best-period-number"><b>' + bestPeriod.score + '</b>' +
      '<small>/100 · ' + verdict(bestPeriod.score) + '</small></div></div>' : '');

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
          '<div class="temperature">High ' + d.hi + '° <span>·</span> Low ' + d.lo + '°C</div>' +
          rainfall +
        '</div>' +
        '<div class="forecast-condition forecast-condition-right">' +
          weatherIcon(d.sky) + d.sky +
        '</div>' +
      '</div>' +
      '<div class="period-scores">' + d.periods.map(function (period) {
        var periodColour = scoreColour(period.score);
        return '<div class="period-score"><span>' + period.name + '</span>' +
          '<strong style="color:' + periodColour + '">' + period.score + '</strong>' +
          '<small>' + verdict(period.score) + '</small></div>';
      }).join("") + '</div>' +
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
      '<div class="sun-times">' +
        '<span>' + sunIcon(false) + '<span class="sun-time-label">Sunrise <strong>' + d.sunrise.slice(11, 16) + '</strong></span></span>' +
        '<span>' + sunIcon(true) + '<span class="sun-time-label">Sunset <strong>' + d.sunset.slice(11, 16) + '</strong></span></span>' +
      '</div>' +
      '<div class="fishing-advice">' +
        '<div><span>Best time</span><strong>' + fishingTime + '</strong></div>' +
        '<div><span>Bank to try</span><strong>' + bank + '</strong></div>' +
      '</div>' +
      '<details class="forecast-details">' +
        '<summary>Hourly forecast, rain and pressure</summary>' +
        '<div class="detail-content">' +
          '<div class="detail-section"><h3>Hour by hour</h3><div class="hourly-list">' +
            '<div class="hourly-row hourly-header"><strong>Time</strong>' +
              '<span>Temp</span><span>Wind</span><span>Rain</span><span>Pressure</span></div>' +
            d.hours.map(function (hour) {
              return '<div class="hourly-row"><strong>' + formatHour(hour.hr) + '</strong>' +
                '<span>' + hour.t + '°C</span><span>' + hour.w + ' mph</span>' +
                '<span>' + hour.r.toFixed(1) + ' mm</span><span>' + hour.p + ' mb</span></div>';
            }).join('') + '</div></div>' +
          '<div class="detail-section"><h3>Rainfall</h3>' + rainfallChart(d.hours) + '</div>' +
          '<div class="detail-section"><h3>Pressure</h3>' + pressureChart(d.hours) + '</div>' +
        '</div>' +
      '</details>' +
      '<div class="bar"><i style="width:' + d.score + '%;background:' + colour + '"></i></div>' +
      '</article>';
  }).join("");

  Array.prototype.forEach.call($("list").querySelectorAll(".row"), function (row) {
    row.addEventListener("click", function (event) {
      if (event.target.closest(".forecast-details, a, button, input, select, textarea")) return;
      var details = row.querySelector(".forecast-details");
      details.open = !details.open;
    });
  });
}
