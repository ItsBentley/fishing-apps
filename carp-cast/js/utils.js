/* ==========================================================================
   utils.js: small helpers used across the app
   ========================================================================== */

// Short DOM lookup used by the UI and event handlers.
function $(id) {
  return document.getElementById(id);
}

// Arithmetic mean. Callers should provide at least one numeric value.
function mean(numbers) {
  if (!numbers.length) throw new Error("Cannot calculate the mean of an empty list");
  return numbers.reduce(function (sum, n) { return sum + n; }, 0) / numbers.length;
}
