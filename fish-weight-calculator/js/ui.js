/* ==========================================================
   Screen helpers: read form values and render state supplied
   by app.js. Application decisions and calculations live there.
   ========================================================== */

/* Shorthand for looking up an element by its unique HTML id. */
const $ = (id) => document.getElementById(id);

/* Read a positive number input; empty, invalid, or non-positive values count as 0. */
function readNumber(id) {
  const value = $(id).valueAsNumber;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/* Check whether a number field has been entered, including an explicit zero. */
function hasValue(id) {
  return $(id).value.trim() !== '';
}

/* Update the selected unit buttons and show only matching input fields. */
function renderUnits(state) {
  $('u-lb').setAttribute('aria-pressed', state.unit === 'lb');
  $('u-kg').setAttribute('aria-pressed', state.unit === 'kg');
  document.querySelectorAll('.lb').forEach((el) => { el.hidden = state.unit !== 'lb'; });
  document.querySelectorAll('.kg').forEach((el) => { el.hidden = state.unit !== 'kg'; });
}

/* Render the Custom option and one button for each saved sling. */
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

/* Show custom fields or the selected saved sling's formatted weight. */
function renderSlingPanel(state, slingLb) {
  const isCustom = state.sel === 'custom';
  $('custom').hidden = !isCustom;
  $('picked').hidden = isCustom;
  if (!isCustom) $('picked').textContent = formatWeight(slingLb, state.unit);
}

/* Render saved sling names, weights, and accessible delete buttons. */
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
    weight.textContent = formatWeight(s.lb, state.unit);

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

/* Update the main answer and its alternate-unit text. */
function showResult(mainText, altText) {
  $('out').textContent = mainText;
  $('alt').textContent = altText;
}

/* Show form feedback, styling validation errors distinctly. */
function showMessage(text, isError) {
  const msg = $('msg');
  msg.className = isError ? 'hint err' : 'hint';
  msg.textContent = text;
}

/* Toggle the sling manager and keep its button label and ARIA state in sync. */
function toggleManager() {
  const mgr = $('mgr');
  mgr.hidden = !mgr.hidden;
  $('manage').setAttribute('aria-expanded', !mgr.hidden);
  $('manage').textContent = mgr.hidden ? 'Edit saved slings' : 'Done editing';
}
