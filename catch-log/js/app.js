/* Catch form, photo handling, on-device list, and backup import/export. */
const $ = (id) => document.getElementById(id);
const MAX_PHOTO_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PHOTO_EDGE = 1600;
const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;
const GEOCODING_MIN_INTERVAL_MS = 1100;
const LOCATION_SEARCH_DELAY_MS = 350;
let currentPhoto = null;
let pendingPhoto = null;
let previewUrl = null;
let photoLoadPromise = null;
let photoRequest = 0;
let locationEditedByUser = false;
let locationSearchTimer = 0;
let locationSearchRequest = 0;
let locationSearchController = null;
let locationSuggestions = [];
let activeLocationSuggestion = -1;
let geocodingQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;
const geocodingCache = new Map();
let catches = [];
let savedVenues = [];

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function normalizeCatch(record) {
  const legacyVenue = !record.caughtAt && typeof record.venue === 'string' ? record.venue : '';
  return {
    ...record,
    caughtAt: record.caughtAt || (record.date ? record.date + 'T12:00' : ''),
    venue: record.caughtAt ? record.venue || '' : '',
    location: record.location || legacyVenue
  };
}

function currentLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function newCatchId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function formatDateTime(dateTime) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateTime));
}

function formatWeight(weightLb) {
  if (weightLb === null) return '';
  const totalOunces = Math.round(weightLb * 16 * 10) / 10;
  const pounds = Math.floor(totalOunces / 16);
  const ounces = Math.round((totalOunces - pounds * 16) * 10) / 10;
  return pounds + ' lb ' + ounces + ' oz';
}

function setStatus(element, message, isError) {
  element.textContent = message;
  element.classList.toggle('error', Boolean(isError));
}

function formatCoordinates(gps) {
  return gps.latitude.toFixed(5) + ', ' + gps.longitude.toFixed(5);
}

function formatGeocodedLocation(result) {
  const address = result.address || {};
  const featureClass = result.class || result.category;
  const featureName = ['leisure', 'natural', 'waterway', 'water', 'tourism', 'sport', 'man_made']
    .includes(featureClass) && typeof result.name === 'string'
    ? result.name
    : '';
  const locality = address.village || address.town || address.city || address.hamlet ||
    address.municipality || address.suburb || address.city_district || address.county || '';
  const region = address.county && address.county !== locality
    ? address.county
    : address.state && address.state !== locality ? address.state : '';
  return [...new Set([featureName, locality, region].filter(Boolean))].slice(0, 3).join(', ');
}

function formatPhotonLocation(feature) {
  const place = feature.properties || {};
  const street = [place.housenumber, place.street].filter(Boolean).join(' ');
  const locality = place.city || place.town || place.village || place.locality;
  const parts = [place.name, street, place.district, locality, place.county]
    .filter((part) => typeof part === 'string' && part.trim());
  return [...new Set(parts)].filter((part, index, all) =>
    all.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index
  ).join(', ');
}

function closeLocationSuggestions() {
  $('location-suggestions').hidden = true;
  $('location-suggestions').replaceChildren();
  $('location').setAttribute('aria-expanded', 'false');
  $('location').removeAttribute('aria-activedescendant');
  locationSuggestions = [];
  activeLocationSuggestion = -1;
}

function updateVenueOptions(venues) {
  const options = new Map();
  venues.forEach((venue) => {
    const name = typeof venue === 'string' ? venue : venue.name;
    if (typeof name === 'string' && name.trim()) {
      const normalized = name.trim();
      const key = normalized.toLocaleLowerCase();
      const lastUsed = typeof venue === 'string' ? 0 : venue.lastUsed || 0;
      if (!options.has(key) || options.get(key).lastUsed < lastUsed) {
        options.set(key, { name: normalized, lastUsed });
      }
    }
  });
  const datalist = $('venue-options');
  datalist.replaceChildren();
  Array.from(options.values())
    .sort((a, b) => b.lastUsed - a.lastUsed || a.name.localeCompare(b.name))
    .forEach(({ name }) => {
      const option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
    });
}

function selectLocationSuggestion(index) {
  const suggestion = locationSuggestions[index];
  if (!suggestion) return;
  $('location').value = suggestion.label;
  locationEditedByUser = true;
  $('location-status').textContent = '';
  closeLocationSuggestions();
}

function updateActiveLocationSuggestion(index) {
  const options = $('location-suggestions').querySelectorAll('[role="option"]');
  if (!options.length) return;
  activeLocationSuggestion = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const active = optionIndex === activeLocationSuggestion;
    option.setAttribute('aria-selected', String(active));
    if (active) {
      $('location').setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
}

function renderLocationSuggestions(features) {
  const list = $('location-suggestions');
  list.replaceChildren();
  const seenLabels = new Set();
  locationSuggestions = features.map((feature) => ({
    label: formatPhotonLocation(feature)
  })).filter((suggestion) => {
    const key = suggestion.label.toLocaleLowerCase();
    if (!key || seenLabels.has(key)) return false;
    seenLabels.add(key);
    return true;
  });
  locationSuggestions.forEach((suggestion, index) => {
    const option = document.createElement('li');
    option.id = 'location-option-' + index;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.textContent = suggestion.label;
    option.addEventListener('mousedown', (event) => event.preventDefault());
    option.addEventListener('click', () => selectLocationSuggestion(index));
    list.appendChild(option);
  });
  list.hidden = locationSuggestions.length === 0;
  $('location').setAttribute('aria-expanded', String(locationSuggestions.length > 0));
  $('location-status').textContent = locationSuggestions.length
    ? locationSuggestions.length + ' location suggestions available.'
    : 'No matching places found.';
}

async function searchLocations(query, requestId) {
  if (locationSearchController) locationSearchController.abort();
  locationSearchController = new AbortController();
  const controller = locationSearchController;
  const url = new URL('https://photon.komoot.io/api/');
  url.search = new URLSearchParams({
    q: query,
    limit: '6',
    lang: 'en',
    countrycode: 'GB'
  });

  try {
    $('location-status').textContent = 'Searching places...';
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Location search failed.');
    const result = await response.json();
    if (requestId !== locationSearchRequest || query !== $('location').value.trim()) return;
    renderLocationSuggestions(Array.isArray(result.features) ? result.features : []);
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== locationSearchRequest) return;
    console.error('Unable to search locations:', error);
    closeLocationSuggestions();
    $('location-status').textContent = 'Could not load location suggestions. You can still enter a location.';
  }
}

function handleLocationInput() {
  locationEditedByUser = true;
  window.clearTimeout(locationSearchTimer);
  const requestId = ++locationSearchRequest;
  if (locationSearchController) locationSearchController.abort();
  const query = $('location').value.trim();
  closeLocationSuggestions();

  if (query.length < 3) {
    $('location-status').textContent = '';
    return;
  }
  locationSearchTimer = window.setTimeout(() => searchLocations(query, requestId), LOCATION_SEARCH_DELAY_MS);
}

function reverseGeocode(gps) {
  const key = formatCoordinates(gps);
  if (geocodingCache.has(key)) return geocodingCache.get(key);

  const request = geocodingQueue.then(async () => {
    const wait = Math.max(0, GEOCODING_MIN_INTERVAL_MS - (Date.now() - lastGeocodingRequestAt));
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
    lastGeocodingRequestAt = Date.now();

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({
      lat: String(gps.latitude),
      lon: String(gps.longitude),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '13',
      layer: 'address,poi,natural',
      'accept-language': 'en-GB'
    });
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('OpenStreetMap location lookup failed.');
    const result = await response.json();
    const location = formatGeocodedLocation(result);
    if (!location) throw new Error('No nearby place name was found.');
    return location;
  });
  geocodingQueue = request.catch(() => {});
  geocodingCache.set(key, request);
  request.catch(() => {
    if (geocodingCache.get(key) === request) geocodingCache.delete(key);
  });
  return request;
}

function updateSpeciesOtherField() {
  const isOther = $('species').value === '__other__';
  $('species-other-row').hidden = !isOther;
  $('species-other').required = isOther;
  if (!isOther) $('species-other').value = '';
}

function selectSpecies(value) {
  const matchingOption = Array.from($('species').options).find((option) =>
    option.value && option.value !== '__other__' &&
    option.value.toLocaleLowerCase() === value.toLocaleLowerCase()
  );
  $('species').value = matchingOption ? matchingOption.value : '__other__';
  $('species-other').value = matchingOption ? '' : value;
  updateSpeciesOtherField();
}

function fileToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read the photo.'));
    reader.readAsDataURL(blob);
  });
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read the backup file.'));
    reader.readAsText(file);
  });
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,/.test(dataUrl)) {
    throw new Error('The backup contains an unsupported photo.');
  }
  const [header, encoded] = dataUrl.split(',');
  const bytes = atob(encoded);
  const array = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) array[index] = bytes.charCodeAt(index);
  return new Blob([array], { type: header.slice(5, header.indexOf(';')) });
}

// Resize uploaded photos before storing them to limit browser storage use.
function loadPhoto(file) {
  if (!file) return Promise.resolve(null);
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Choose an image file.'));
  if (file.size > MAX_PHOTO_FILE_BYTES) return Promise.reject(new Error('Choose a photo smaller than 20 MB.'));

  const loadWithImageElement = () => new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => resolve({ image, cleanup: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the selected photo.'));
    };
    image.src = url;
  });
  const imagePromise = typeof createImageBitmap === 'function'
    ? createImageBitmap(file)
      .then((image) => ({ image, cleanup: () => image.close() }))
      .catch(() => loadWithImageElement())
    : loadWithImageElement();

  return imagePromise.then(({ image, cleanup }) => {
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      cleanup();
      throw new Error('This browser could not process the photo.');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    cleanup();
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not process the photo.'));
      }, 'image/jpeg', 0.82);
    });
  });
}

function resetForm() {
  $('catch-form').reset();
  updateSpeciesOtherField();
  locationEditedByUser = false;
  window.clearTimeout(locationSearchTimer);
  locationSearchRequest++;
  if (locationSearchController) locationSearchController.abort();
  closeLocationSuggestions();
  $('location-status').textContent = '';
  $('catch-id').value = '';
  $('caught-at').value = currentLocalDateTime();
  $('form-heading').textContent = 'Log a catch';
  $('save-catch').textContent = 'Save catch';
  $('cancel-edit').hidden = true;
  $('remove-photo-row').hidden = true;
  $('photo-preview').hidden = true;
  $('photo-preview').removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  currentPhoto = null;
  pendingPhoto = null;
  photoLoadPromise = null;
  photoRequest++;
}

// Revoke the previous preview URL whenever a different photo is displayed.
function showPhotoPreview(blob) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob);
  $('photo-preview').src = previewUrl;
  $('photo-preview').hidden = false;
}

function createCatchCard(record) {
  const article = document.createElement('article');
  article.className = 'catch-card';

  if (record.photo) {
    const image = document.createElement('img');
    image.className = 'catch-photo';
    image.src = URL.createObjectURL(record.photo);
    image.alt = 'Photo of ' + record.species;
    image.loading = 'lazy';
    image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
    image.addEventListener('error', () => URL.revokeObjectURL(image.src), { once: true });
    article.appendChild(image);
  }

  const content = document.createElement('div');
  content.className = 'catch-content';
  const titleRow = document.createElement('div');
  titleRow.className = 'catch-title-row';
  const title = document.createElement('h3');
  title.className = 'catch-title';
  title.textContent = record.species;
  titleRow.appendChild(title);

  if (record.weightLb !== null) {
    const weight = document.createElement('span');
    weight.className = 'catch-weight';
    weight.textContent = formatWeight(record.weightLb);
    titleRow.appendChild(weight);
  }
  content.appendChild(titleRow);

  const meta = document.createElement('div');
  meta.className = 'catch-meta';
  const date = document.createElement('time');
  date.dateTime = record.caughtAt;
  date.textContent = formatDateTime(record.caughtAt);
  meta.appendChild(date);
  if (record.venue) {
    const venue = document.createElement('span');
    venue.textContent = record.venue;
    meta.appendChild(venue);
  }
  if (record.location) {
    const location = document.createElement('span');
    location.textContent = record.location;
    meta.appendChild(location);
  }
  content.appendChild(meta);

  if (record.notes) {
    const notes = document.createElement('p');
    notes.className = 'catch-notes';
    notes.textContent = record.notes;
    content.appendChild(notes);
  }

  const actions = document.createElement('div');
  actions.className = 'catch-actions';
  const edit = document.createElement('button');
  edit.className = 'secondary';
  edit.type = 'button';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => editCatch(record));
  const remove = document.createElement('button');
  remove.className = 'delete-catch';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteCatch(record));
  actions.append(edit, remove);
  content.appendChild(actions);
  article.appendChild(content);
  return article;
}

function renderCatches() {
  const list = $('catch-list');
  list.replaceChildren();
  // Keep future catches visible without losing the order they were entered.
  const sorted = catches.slice().sort((a, b) => b.caughtAt.localeCompare(a.caughtAt) || b.createdAt - a.createdAt);
  sorted.forEach((record) => list.appendChild(createCatchCard(record)));
  $('catch-count').textContent = catches.length + (catches.length === 1 ? ' catch' : ' catches');
  $('empty-state').hidden = catches.length > 0;
}

function editCatch(record) {
  closeLocationSuggestions();
  $('location-status').textContent = '';
  $('catch-id').value = record.id;
  selectSpecies(record.species);
  $('caught-at').value = record.caughtAt;
  $('venue').value = record.venue;
  $('location').value = record.location;
  locationEditedByUser = Boolean(record.location);
  $('weight-lb').value = record.weightLb === null ? '' : String(Math.floor(record.weightLb));
  $('weight-oz').value = record.weightLb === null ? '' : String(Math.round((record.weightLb % 1) * 160) / 10);
  $('notes').value = record.notes;
  currentPhoto = record.photo;
  pendingPhoto = null;
  $('photo').value = '';
  $('photo-preview').hidden = !record.photo;
  if (record.photo) showPhotoPreview(record.photo);
  $('remove-photo-row').hidden = !record.photo;
  $('remove-photo').checked = false;
  $('form-heading').textContent = 'Edit catch';
  $('save-catch').textContent = 'Update catch';
  $('cancel-edit').hidden = false;
  $('form-status').textContent = '';
  $('catch-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteCatch(record) {
  if (!window.confirm('Delete this ' + record.species + ' catch? This cannot be undone.')) return;
  try {
    await catchStore.remove(record.id);
    catches = catches.filter((item) => item.id !== record.id);
    renderCatches();
    setStatus($('form-status'), 'Catch deleted.', false);
  } catch (error) {
    console.error('Unable to delete catch:', error);
    setStatus($('form-status'), 'Could not delete this catch. Please try again.', true);
  }
}

async function saveCatch(event) {
  event.preventDefault();
  const status = $('form-status');
  const saveButton = $('save-catch');
  saveButton.disabled = true;

  try {
    if (photoLoadPromise) await photoLoadPromise;
    const poundsInput = $('weight-lb').value;
    const ouncesInput = $('weight-oz').value;
    const hasWeight = poundsInput !== '' || ouncesInput !== '';
    const pounds = poundsInput === '' ? 0 : Number(poundsInput);
    const ounces = ouncesInput === '' ? 0 : Number(ouncesInput);
    if (hasWeight && (!Number.isFinite(pounds) || !Number.isFinite(ounces) || pounds < 0 || ounces < 0 || ounces >= 16)) {
      throw new Error('Enter a valid weight; ounces must be less than 16.');
    }

    const previous = catches.find((record) => record.id === $('catch-id').value);
    let photo = currentPhoto;
    if ($('remove-photo').checked) photo = null;
    if (pendingPhoto) photo = pendingPhoto;

    const record = {
      id: previous ? previous.id : newCatchId(),
      createdAt: previous ? previous.createdAt : Date.now(),
      species: ($('species').value === '__other__' ? $('species-other').value : $('species').value).trim(),
      caughtAt: $('caught-at').value,
      venue: $('venue').value.trim(),
      location: $('location').value.trim(),
      weightLb: hasWeight ? pounds + ounces / 16 : null,
      notes: $('notes').value.trim(),
      photo
    };
    if (!record.species || !record.caughtAt) throw new Error('Enter a species and catch date and time.');

    await catchStore.save(record);
    catches = catches.filter((item) => item.id !== record.id).concat(record);
    if (record.venue) savedVenues = savedVenues.concat({ name: record.venue, lastUsed: Date.now() });
    updateVenueOptions(savedVenues);
    renderCatches();
    resetForm();
    setStatus(status, previous ? 'Catch updated.' : 'Catch saved on this device.', false);
  } catch (error) {
    console.error('Unable to save catch:', error);
    setStatus(status, error.message || 'Could not save this catch. Please try again.', true);
  } finally {
    saveButton.disabled = false;
  }
}

async function exportBackup() {
  const status = $('backup-status');
  try {
    const records = await catchStore.readAll();
    const venues = await catchStore.readVenues();
    const backupRecords = await Promise.all(records.map(async (storedRecord) => {
      const record = normalizeCatch(storedRecord);
      return {
        id: record.id,
        createdAt: record.createdAt,
        species: record.species,
        caughtAt: record.caughtAt,
        venue: record.venue,
        location: record.location,
        weightLb: record.weightLb,
        notes: record.notes,
        photo: record.photo ? await fileToDataUrl(record.photo) : null
      };
    }));
    const backup = {
      format: 'bentleys-catch-log',
      version: 3,
      exportedAt: new Date().toISOString(),
      venues: venues.map((venue) => venue.name),
      catches: backupRecords
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    if (blob.size > MAX_BACKUP_FILE_BYTES) {
      throw new Error('This backup exceeds the 100 MB import limit.');
    }
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'catch-log-backup-' + localDateString(new Date()) + '.json';
    document.body.appendChild(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(status, 'Backup exported.', false);
  } catch (error) {
    console.error('Unable to export catch backup:', error);
    setStatus(status, 'Could not export the backup. Please try again.', true);
  }
}

function validateBackupRecord(record, version) {
  const caughtAt = version === 1 && typeof record?.date === 'string'
    ? record.date + 'T12:00'
    : record?.caughtAt;
  const match = typeof caughtAt === 'string' &&
    caughtAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  const validDateTime = match &&
    Number(match[4]) < 24 && Number(match[5]) < 60 &&
    isValidDate(match[1], match[2], match[3]);
  const validVenueAndLocation = version === 1
    ? typeof record?.venue === 'string'
    : version === 2
      ? typeof record?.location === 'string'
      : typeof record?.venue === 'string' && typeof record?.location === 'string';
  if (!record || typeof record.id !== 'string' || !record.id ||
      typeof record.species !== 'string' || !record.species.trim() ||
      !validDateTime ||
      !validVenueAndLocation ||
      typeof record.notes !== 'string' ||
      !(record.weightLb === null || (Number.isFinite(record.weightLb) && record.weightLb >= 0))) {
    throw new Error('The backup contains an invalid catch record.');
  }
  return {
    id: record.id,
    createdAt: Number.isFinite(record.createdAt) ? record.createdAt : Date.now(),
    species: record.species.trim(),
    caughtAt,
    venue: version === 3 ? record.venue.trim() : '',
    location: version === 1 ? record.venue : record.location,
    weightLb: record.weightLb,
    notes: record.notes,
    photo: record.photo ? dataUrlToBlob(record.photo) : null
  };
}

function isValidDate(year, month, day) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
}

async function importBackup(file) {
  const status = $('backup-status');
  if (!file) return;
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    setStatus(status, 'Backup file is too large (maximum 100 MB).', true);
    $('backup-file').value = '';
    return;
  }

  try {
    const backup = JSON.parse(await readFileText(file));
    if (backup.format !== 'bentleys-catch-log' ||
        ![1, 2, 3].includes(backup.version) || !Array.isArray(backup.catches) ||
        (backup.version === 3 && (!Array.isArray(backup.venues) ||
          backup.venues.some((venue) => typeof venue !== 'string')))) {
      throw new Error('This file is not a supported Catch Log backup.');
    }
    const imported = backup.catches.map((record) => validateBackupRecord(record, backup.version));
    const importedVenues = backup.version === 3 ? backup.venues : [];
    if (!window.confirm('Import ' + imported.length + ' catches? Matching records will be updated; other catches will be kept.')) return;

    await catchStore.merge(imported, importedVenues);
    catches = (await catchStore.readAll()).map(normalizeCatch);
    savedVenues = savedVenues.concat(
      importedVenues.map((name) => ({ name, lastUsed: Date.now() })),
      imported.filter((record) => record.venue).map((record) => ({ name: record.venue, lastUsed: Date.now() }))
    );
    updateVenueOptions(savedVenues.concat(catches.map((record) => record.venue)));
    renderCatches();
    setStatus(status, imported.length + (imported.length === 1 ? ' catch imported.' : ' catches imported.') +
      (backup.version === 1 ? ' Older backup dates were imported at 12:00.' : ''), false);
  } catch (error) {
    console.error('Unable to import catch backup:', error);
    setStatus(status, error.message || 'Could not import this backup.', true);
  } finally {
    $('backup-file').value = '';
  }
}

// Form actions save locally; backup controls are the only import/export path.
$('catch-form').addEventListener('submit', saveCatch);
$('species').addEventListener('change', updateSpeciesOtherField);
$('location').addEventListener('input', handleLocationInput);
$('location').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' && !$('location-suggestions').hidden) {
    event.preventDefault();
    updateActiveLocationSuggestion(activeLocationSuggestion + 1);
  } else if (event.key === 'ArrowUp' && !$('location-suggestions').hidden) {
    event.preventDefault();
    updateActiveLocationSuggestion(activeLocationSuggestion < 0
      ? locationSuggestions.length - 1
      : activeLocationSuggestion - 1);
  } else if (event.key === 'Enter' && activeLocationSuggestion >= 0) {
    event.preventDefault();
    selectLocationSuggestion(activeLocationSuggestion);
  } else if (event.key === 'Escape') {
    closeLocationSuggestions();
  }
});
$('location').addEventListener('blur', () => {
  window.setTimeout(closeLocationSuggestions, 150);
});
$('cancel-edit').addEventListener('click', resetForm);
$('photo').addEventListener('change', () => {
  const file = $('photo').files[0];
  if (!file) return;
  const request = ++photoRequest;
  photoLoadPromise = loadPhoto(file).then((previewBlob) => {
    if (request !== photoRequest) return;
    pendingPhoto = previewBlob;
    showPhotoPreview(previewBlob);
    $('remove-photo-row').hidden = true;
    $('remove-photo').checked = false;
    return readPhotoMetadata(file).catch((error) => {
      console.warn('Could not read photo metadata:', error);
      return {};
    }).then((metadata) => {
      if (request !== photoRequest) return;
      if (metadata.caughtAt) $('caught-at').value = metadata.caughtAt;
      const found = [];
      if (metadata.caughtAt) found.push('date and time');
      if (metadata.gps && !locationEditedByUser) {
        const coordinates = formatCoordinates(metadata.gps);
        $('location').value = coordinates;
        found.push('GPS coordinates');
        setStatus(
          $('form-status'),
          'Photo ready. Looking up a place name with OpenStreetMap; the GPS coordinates are sent to that service.',
          false
        );
        return reverseGeocode(metadata.gps).then((location) => {
          if (request !== photoRequest) return;
          if (!locationEditedByUser) $('location').value = location;
          setStatus(
            $('form-status'),
            locationEditedByUser
              ? 'Photo ready. Found ' + location + ' nearby; kept your location entry.'
              : 'Photo ready. Added ' + (found.includes('date and time') ? 'date and time and ' : '') +
                'nearby location: ' + location + '. Check or edit before saving.',
            false
          );
        }).catch((error) => {
          console.warn('Could not look up photo GPS location:', error);
          if (request !== photoRequest) return;
          setStatus(
            $('form-status'),
            'Photo ready. Could not look up a place name; GPS coordinates are shown instead. You can enter a location manually.',
            false
          );
        });
      }
      if (metadata.gps) found.push('GPS location');
      setStatus(
        $('form-status'),
        found.length
          ? 'Photo ready. Added ' + found.join(' and ') + ' from its metadata; check or edit before saving.'
          : 'Photo ready. No capture date, time, or GPS metadata found; enter them if known.',
        false
      );
    });
  }).catch((error) => {
    if (request !== photoRequest) return;
    photoLoadPromise = null;
    $('photo').value = '';
    setStatus($('form-status'), error.message, true);
    throw error;
  });
  photoLoadPromise.catch(() => {});
});
$('remove-photo').addEventListener('change', () => {
  if ($('remove-photo').checked) {
    currentPhoto = null;
    pendingPhoto = null;
    $('photo-preview').hidden = true;
    $('photo-preview').removeAttribute('src');
  } else if (!$('photo').files[0] && $('catch-id').value) {
    const record = catches.find((item) => item.id === $('catch-id').value);
    if (record && record.photo) {
      currentPhoto = record.photo;
      showPhotoPreview(record.photo);
    }
  }
});
$('export-backup').addEventListener('click', exportBackup);
$('import-backup').addEventListener('click', () => $('backup-file').click());
$('backup-file').addEventListener('change', () => importBackup($('backup-file').files[0]));

$('caught-at').value = currentLocalDateTime();
Promise.all([catchStore.readAll(), catchStore.readVenues()]).then(([records, venues]) => {
  catches = records.map(normalizeCatch);
  savedVenues = venues;
  updateVenueOptions(savedVenues.concat(catches.map((record) => record.venue)));
  renderCatches();
}).catch((error) => {
  console.error('Unable to load catches:', error);
  setStatus($('form-status'), 'Could not open saved catches or venues. Check that this browser supports website data storage.', true);
});
