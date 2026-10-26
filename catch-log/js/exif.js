/* Read EXIF capture time and GPS coordinates locally from JPEG photos. */
async function readPhotoMetadata(file) {
  if (!file || !/jpe?g$/i.test(file.name) && !/^image\/jpeg$/i.test(file.type)) return {};

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};

  function readAscii(offset, length) {
    let value = '';
    for (let index = 0; index < length; index++) {
      const character = view.getUint8(offset + index);
      if (character === 0) break;
      value += String.fromCharCode(character);
    }
    return value;
  }

  function readIfd(offset, littleEndian, endOffset) {
    const entries = new Map();
    if (offset < 0 || offset + 2 > endOffset) return entries;
    const count = view.getUint16(offset, littleEndian);
    for (let index = 0; index < count; index++) {
      const entry = offset + 2 + index * 12;
      if (entry + 12 > endOffset) break;
      const tag = view.getUint16(entry, littleEndian);
      const type = view.getUint16(entry + 2, littleEndian);
      const itemCount = view.getUint32(entry + 4, littleEndian);
      const valueOffset = entry + 8;
      let value;

      if (type === 2 && itemCount > 0) {
        const stringOffset = itemCount <= 4
          ? valueOffset
          : tiffStart + view.getUint32(valueOffset, littleEndian);
        if (stringOffset >= tiffStart && stringOffset + itemCount <= endOffset) {
          value = readAscii(stringOffset, itemCount);
        }
      } else if (type === 3 && itemCount === 1) {
        value = view.getUint16(valueOffset, littleEndian);
      } else if (type === 4 && itemCount === 1) {
        value = view.getUint32(valueOffset, littleEndian);
      } else if (type === 5 && itemCount > 0) {
        const rationalOffset = tiffStart + view.getUint32(valueOffset, littleEndian);
        if (rationalOffset >= tiffStart && rationalOffset + itemCount * 8 <= endOffset) {
          value = Array.from({ length: itemCount }, (_, rationalIndex) => {
            const position = rationalOffset + rationalIndex * 8;
            const denominator = view.getUint32(position + 4, littleEndian);
            return denominator ? view.getUint32(position, littleEndian) / denominator : 0;
          });
        }
      }
      if (value !== undefined) entries.set(tag, value);
    }
    return entries;
  }

  let tiffStart = -1;
  let tiffEnd = -1;
  for (let offset = 2; offset + 4 <= view.byteLength;) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd9 || marker === 0xda) break;
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) break;
    if (marker === 0xe1 &&
        readAscii(offset + 4, 4) === 'Exif' &&
        view.getUint16(offset + 8) === 0) {
      tiffStart = offset + 10;
      tiffEnd = offset + 2 + segmentLength;
      break;
    }
    offset += 2 + segmentLength;
  }
  if (tiffStart < 0 || tiffStart + 8 > tiffEnd) return {};

  const byteOrder = readAscii(tiffStart, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return {};
  const littleEndian = byteOrder === 'II';
  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return {};

  function tiffIfd(relativeOffset) {
    const offset = tiffStart + relativeOffset;
    return offset >= tiffStart && offset + 2 <= tiffEnd
      ? readIfd(offset, littleEndian, tiffEnd)
      : new Map();
  }

  const primaryIfd = tiffIfd(view.getUint32(tiffStart + 4, littleEndian));
  const exifIfd = primaryIfd.has(0x8769) ? tiffIfd(primaryIfd.get(0x8769)) : new Map();
  const rawDate = exifIfd.get(0x9003) || primaryIfd.get(0x0132);
  const result = {};

  if (typeof rawDate === 'string') {
    const match = rawDate.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      result.caughtAt = `${year}-${month}-${day}T${hour}:${minute}`;
    }
  }

  const gpsIfd = primaryIfd.has(0x8825) ? tiffIfd(primaryIfd.get(0x8825)) : new Map();
  const latitude = gpsIfd.get(2);
  const longitude = gpsIfd.get(4);
  if (Array.isArray(latitude) && latitude.length >= 3 &&
      Array.isArray(longitude) && longitude.length >= 3) {
    const lat = latitude[0] + latitude[1] / 60 + latitude[2] / 3600;
    const lon = longitude[0] + longitude[1] / 60 + longitude[2] / 3600;
    const signedLat = gpsIfd.get(1) === 'S' ? -lat : lat;
    const signedLon = gpsIfd.get(3) === 'W' ? -lon : lon;
    if (Number.isFinite(signedLat) && Number.isFinite(signedLon) &&
        Math.abs(signedLat) <= 90 && Math.abs(signedLon) <= 180) {
      result.gps = { latitude: signedLat, longitude: signedLon };
    }
  }
  return result;
}
