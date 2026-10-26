/* ==========================================================
   Save and load settings in browser localStorage.
   Storage can be unavailable (for example, in private browsing),
   so failures are reported once without stopping calculations.
   ========================================================== */

const STORAGE_KEY = 'fishweights';
const OLD_STORAGE_KEY = 'sling';
let storageWarningShown = false;

/* Avoid repeating storage warnings when every subsequent save also fails. */
function warnStorage(message, error) {
  if (storageWarningShown) return;
  storageWarningShown = true;
  console.warn(message, error);
}

/* Save the complete calculator state as JSON. */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    warnStorage('Unable to save calculator settings in this browser.', error);
  }
}

/* Restore saved settings into the initial state object. */
function loadState(state) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      state.unit = saved.unit === 'kg' ? 'kg' : 'lb';
      state.sel = saved.sel || 'custom';
      state.slings = Array.isArray(saved.slings) ? saved.slings : [];
      // Older saved states used "c" for the custom sling fields.
      state.custom = saved.custom || saved.c || state.custom;
      return;
    }

    // Migrate the original single-sling format if no current state exists.
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null');
    if (old) {
      state.unit = old.unit === 'kg' ? 'kg' : 'lb';
      state.custom = { lb: old.slb || '', oz: old.soz || '', kg: old.skg || '' };
    }
  } catch (error) {
    warnStorage('Unable to load saved calculator settings; starting with defaults.', error);
  }
}
