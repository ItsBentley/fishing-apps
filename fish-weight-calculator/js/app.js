const state = {
  sel: 'custom',
  slings: [],
  custom: { lb: '', oz: '' }
};

function getScaleLb() {
  return readNumber('glb') + readNumber('goz') / 16;
}

function getSlingLb() {
  if (state.sel === 'custom') {
    return readNumber('slb') + readNumber('soz') / 16;
  }
  const found = state.slings.find((s) => s.id === state.sel);
  return found ? found.lb : 0;
}

function updateResult() {
  const hasReading = hasValue('glb') || hasValue('goz');

  if (!hasReading) {
    showResult('\u2013', 'Enter the scale reading to see the result.');
    return;
  }

  let fishLb = getScaleLb() - getSlingLb();

  if (fishLb < -1e-9) {
    showResult('Check numbers', 'The sling weighs more than the scale reading.');
    return;
  }
  if (fishLb < 0) fishLb = 0;

  const decimalLb = Math.round(fishLb * 100) / 100;
  showResult(formatLbOz(fishLb), decimalLb + ' lb');
}

function render() {
  renderChips(state, selectSling);
  renderSlingPanel(state, getSlingLb());
  renderSlingList(state, deleteSling);
}

function refresh() {
  saveState(state);
  render();
  updateResult();
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

function addSling() {
  const name = $('aname').value.trim();
  const lb = readNumber('alb') + readNumber('aoz') / 16;

  if (!name) { showMessage('Enter a name for the sling.', true); return; }
  if (lb <= 0) { showMessage('Enter the sling weight.', true); return; }

  const id = 's' + Date.now();
  state.slings.push({ id, name, lb });
  state.sel = id;

  ['aname', 'alb', 'aoz'].forEach((field) => { $(field).value = ''; });
  showMessage('Saved ' + name + '.', false);
  refresh();

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) activeElement.blur();
}

function clearReading() {
  ['glb', 'goz'].forEach((id) => { $(id).value = ''; });
  updateResult();
  $('glb').focus();
}

function onCustomSlingInput() {
  state.custom = { lb: $('slb').value, oz: $('soz').value };
  saveState(state);
  updateResult();
}

function wireEvents() {
  $('manage').addEventListener('click', toggleManager);
  $('clear').addEventListener('click', clearReading);

  ['glb', 'goz'].forEach((id) => $(id).addEventListener('input', updateResult));

  ['slb', 'soz'].forEach((id) => $(id).addEventListener('input', onCustomSlingInput));

  $('save').addEventListener('click', addSling);
}

loadState(state);
$('slb').value = state.custom.lb || '';
$('soz').value = state.custom.oz || '';
wireEvents();
render();
updateResult();
