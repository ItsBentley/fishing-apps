
function formatLbOz(lb) {
  const totalOz = Math.round(lb * 16 * 10) / 10;
  let pounds = Math.floor(totalOz / 16 + 1e-9);
  let ounces = Math.round((totalOz - pounds * 16) * 10) / 10;
  if (ounces >= 16) { pounds += 1; ounces = 0; }
  return pounds + ' lb ' + ounces + ' oz';
}

function formatWeight(lb) {
  return formatLbOz(lb);
}
