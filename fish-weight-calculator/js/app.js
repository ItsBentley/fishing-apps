/* ==========================================================
   Application state, weight calculations, user actions, and
   event wiring. UI rendering helpers live in ui.js.
   ========================================================== */

/* The app keeps weights in pounds; custom fields retain the user's entries. */
const state = {
  unit: 'lb', // Selected input and display units.
  sel: 'custom', // "custom" or the id of the selected saved sling.
  slings: [], // Saved sling records: { id, name, lb }.
  custom: { lb: '', oz: '', kg: '' } // Raw custom-field values, kept for restoration.
};

/* Read the combined fish-and-sling scale reading as pounds. */
function getScaleLb() {
  return state.unit === 'kg'
    ? kgToLb(readNumber('gkg'))
    : readNumber('glb') + readNumber('goz') / 16;
}

/* Read the selected saved or custom sling weight as pounds. */
function getSlingLb() {
  if (state.sel === 'custom') {
    return state.unit === 'kg'
      ? kgToLb(readNumber('skg'))
      : readNumber('slb') + readNumber('soz') / 16;
  }
  const found = state.slings.find((s) => s.id === state.sel);
  return found ? found.lb : 0;
}

/* Subtract the sling from the scale reading and update the result. */
function updateResult() {
  const hasReading = state.unit === 'lb'
    ? (hasValue('glb') || hasValue('goz'))
    : hasValue('gkg');

  if (!hasReading) {
    showResult('\u2013', 'Enter the scale reading to see the result.');
    return;
  }

  let fishLb = getScaleLb() - getSlingLb();

  if (fishLb < -1e-9) {
    showResult('Check numbers', 'The sling weighs more than the scale reading.');
    return;
  }
  if (fishLb < 0) fishLb = 0; // Ignore tiny floating-point rounding errors.

  if (state.unit === 'lb') {
    const decimalLb = Math.round(fishLb * 100) / 100;
    const kg = Math.round(lbToKg(fishLb) * 1000) / 1000;
    showResult(formatLbOz(fishLb), decimalLb + ' lb  \u2022  ' + kg + ' kg');
  } else {
    showResult(lbToKg(fishLb).toFixed(3) + ' kg', formatLbOz(fishLb));
  }
}


/* ---------- Render and persist state ---------- */
function render() {
  renderUnits(state);
  renderChips(state, selectSling);
  renderSlingPanel(state, getSlingLb());
  renderSlingList(state, deleteSling);
}

/* Persist settings, redraw dependent UI, and recalculate the fish weight. */
function refresh() {
  saveState(state);
  render();
  updateResult();
}


/* ---------- User actions ---------- */

function setUnit(unit) {
  state.unit = unit;
  refresh();
}

function selectSling(id) {
  state.sel = id;
  refresh();
}

function deleteSling(id) {
  state.slings = state.slings.filter((s) => s.id !== id);
  if (state.sel === id) state.sel = 'custom';
  refresh();
}

/* Adds a new named sling from the "add a sling" form */
function addSling() {
  const name = $('aname').value.trim();
  const lb = state.unit === 'kg'
    ? kgToLb(readNumber('akg'))
    : readNumber('alb') + readNumber('aoz') / 16;

  if (!name) { showMessage('Enter a name for the sling.', true); return; }
  if (lb <= 0) { showMessage('Enter the sling weight.', true); return; }

  const id = 's' + Date.now();
  state.slings.push({ id, name, lb });
  state.sel = id;

  ['aname', 'alb', 'aoz', 'akg'].forEach((field) => { $(field).value = ''; });
  showMessage('Saved ' + name + '.', false);
  refresh();

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) activeElement.blur();
}

/* Clear only the scale reading, then focus the active unit's first field. */
function clearReading() {
  ['glb', 'goz', 'gkg'].forEach((id) => { $(id).value = ''; });
  updateResult();
  (state.unit === 'lb' ? $('glb') : $('gkg')).focus();
}

/* Keep custom entries in saved settings even when another sling is selected. */
function onCustomSlingInput() {
  state.custom = { lb: $('slb').value, oz: $('soz').value, kg: $('skg').value };
  saveState(state);
  updateResult();
}


/* ---------- Event wiring ---------- */
function wireEvents() {
  $('u-lb').addEventListener('click', () => setUnit('lb'));
  $('u-kg').addEventListener('click', () => setUnit('kg'));
  $('manage').addEventListener('click', toggleManager);
  $('clear').addEventListener('click', clearReading);

  // Scale readings affect the result immediately.
  ['glb', 'goz', 'gkg'].forEach((id) => $(id).addEventListener('input', updateResult));

  // Custom sling edits are saved and included in the live calculation.
  ['slb', 'soz', 'skg'].forEach((id) => $(id).addEventListener('input', onCustomSlingInput));

  $('save').addEventListener('click', addSling);
}


/* Restore settings and input values before the first render. */
loadState(state);
$('slb').value = state.custom.lb || '';
$('soz').value = state.custom.oz || '';
$('skg').value = state.custom.kg || '';
wireEvents();
render();
updateResult();
