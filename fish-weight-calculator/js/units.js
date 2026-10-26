/* ==========================================================
   Weight conversion and display formatting.
   The calculator stores weights in decimal pounds and converts
   them only for input interpretation or display.
   ========================================================== */

const KG_PER_LB = 0.45359237;

/* Convert pounds to kilograms. */
function lbToKg(lb) {
  return lb * KG_PER_LB;
}

/* Convert kilograms to pounds. */
function kgToLb(kg) {
  return kg / KG_PER_LB;
}

/* Format pounds as lb and oz, rounded to a tenth of an ounce.
   Carry a rounded 16 oz into the next pound. */
function formatLbOz(lb) {
  const totalOz = Math.round(lb * 16 * 10) / 10;
  let pounds = Math.floor(totalOz / 16 + 1e-9);
  let ounces = Math.round((totalOz - pounds * 16) * 10) / 10;
  if (ounces >= 16) { pounds += 1; ounces = 0; }
  return pounds + ' lb ' + ounces + ' oz';
}

/* Format a pounds value in the selected display unit. */
function formatWeight(lb, unit) {
  return unit === 'kg' ? lbToKg(lb).toFixed(3) + ' kg' : formatLbOz(lb);
}
