
function $(id) {
  return document.getElementById(id);
}

function mean(numbers) {
  if (!numbers.length) throw new Error("Cannot calculate the mean of an empty list");
  return numbers.reduce(function (sum, n) { return sum + n; }, 0) / numbers.length;
}
