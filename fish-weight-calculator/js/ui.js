
const $ = (id) => document.getElementById(id);

function readNumber(id) {
  const value = $(id).valueAsNumber;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function hasValue(id) {
  return $(id).value.trim() !== '';
}

function renderChips(state, onSelect) {
  const box = $('chips');
  box.innerHTML = '';

  function addChip(id, label) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', state.sel === id);
    b.addEventListener('click', () => onSelect(id));
    box.appendChild(b);
  }

  addChip('custom', 'Custom');
  state.slings.forEach((s) => addChip(s.id, s.name));
}

function renderSlingPanel(state, slingLb) {
  const isCustom = state.sel === 'custom';
  $('custom').hidden = !isCustom;
  $('picked').hidden = isCustom;
  if (!isCustom) $('picked').textContent = formatWeight(slingLb);
}

function renderSlingList(state, onDelete) {
  const list = $('list');
  list.innerHTML = '';

  if (!state.slings.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No saved slings yet. Add one below.';
    list.appendChild(p);
  }

  state.slings.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'item';

    const name = document.createElement('span');
    name.textContent = s.name;

    const weight = document.createElement('em');
    weight.textContent = formatWeight(s.lb);

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', 'Delete ' + s.name);
    del.addEventListener('click', () => onDelete(s.id));

    row.appendChild(name);
    row.appendChild(weight);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function showResult(mainText, altText) {
  $('out').textContent = mainText;
  $('alt').textContent = altText;
}

function showMessage(text, isError) {
  const msg = $('msg');
  msg.className = isError ? 'hint err' : 'hint';
  msg.textContent = text;
}

function toggleManager() {
  const mgr = $('mgr');
  mgr.hidden = !mgr.hidden;
  $('manage').setAttribute('aria-expanded', !mgr.hidden);
  $('manage').textContent = mgr.hidden ? 'Edit saved slings' : 'Done editing';
}
