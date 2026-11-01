
const STORAGE_KEY = 'fishweights';
const OLD_STORAGE_KEY = 'sling';
let storageWarningShown = false;

function warnStorage(message, error) {
  if (storageWarningShown) return;
  storageWarningShown = true;
  console.warn(message, error);
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    warnStorage('Unable to save calculator settings in this browser.', error);
  }
}

function loadState(state) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      state.sel = saved.sel || 'custom';
      state.slings = Array.isArray(saved.slings) ? saved.slings : [];
      const custom = saved.custom || saved.c || state.custom;
      state.custom = { lb: custom.lb || '', oz: custom.oz || custom.soz || '' };
      return;
    }

    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null');
    if (old) {
      state.custom = { lb: old.slb || '', oz: old.soz || '' };
    }
  } catch (error) {
    warnStorage('Unable to load saved calculator settings; starting with defaults.', error);
  }
}
