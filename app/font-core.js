/* =======================================================
   font-core.js
   Resource-fork (.dfont) parsing, bitmap strike decoding,
   deterministic byte corruption, and binary helpers.
   This is the proven engine reused as-is by the UI layer.
======================================================= */

/* -------------------------------------------------------
   Byte corruption
------------------------------------------------------- */

const GLITCH_START_SIGNATURE = Object.freeze([0x00, 0x01, 0x01, 0x00, 0x01]);
const GLITCH_END_SIGNATURE = Object.freeze([0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);

function corruptDfontBytes(buffer, targets, edits) {
  const bytes = new Uint8Array(buffer.slice(0));
  const byStrike = [];
  let totalMutated = 0;

  for (const target of targets) {
    const edit = edits.get(target.key) || { amount: 0, maxOffset: 1, seed: 0 };
    const scopeStart = clamp(target.scopeStart, 0, bytes.length);
    const scopeEnd = clamp(target.scopeEnd, scopeStart, bytes.length);
    const boundarySearchEnd = clamp(target.boundarySearchEnd ?? scopeEnd, scopeEnd, bytes.length);
    const startMatches = findSignatureOffsets(bytes, GLITCH_START_SIGNATURE, scopeStart, scopeEnd);
    const startSignatureOffset = startMatches.length > 0 ? startMatches[0] : -1;
    const contentStart = startSignatureOffset >= 0
      ? startSignatureOffset + GLITCH_START_SIGNATURE.length
      : -1;
    const endMatches = contentStart >= 0
      ? findSignatureOffsets(bytes, GLITCH_END_SIGNATURE, contentStart, boundarySearchEnd)
      : [];
    const endSignatureOffset = endMatches.length > 0 ? endMatches[0] : -1;
    const contentEnd = endSignatureOffset >= contentStart
      ? endSignatureOffset
      : scopeEnd;
    let mutated = 0;
    let actualLength = 0;

    if (contentStart >= 0 && contentEnd >= contentStart) {
      actualLength = contentEnd - contentStart;
      if (edit.amount > 0) {
        mutated = mutateByteRange(
          bytes,
          contentStart,
          actualLength,
          edit.amount / 100,
          edit.maxOffset,
          edit.seed
        );
      }
    }

    totalMutated += mutated;
    byStrike.push({
      key: target.key,
      label: target.label,
      startMatches: startMatches.length,
      endMatches: endMatches.length,
      startSignatureOffset,
      endSignatureOffset,
      usedScopeEndFallback: endSignatureOffset < contentStart,
      offset: contentStart,
      length: actualLength,
      mutated
    });
  }

  return { buffer: bytes.buffer, info: { byStrike, totalMutated } };
}

function mutateByteRange(bytes, start, length, amount, maxOffset, seed) {
  const random = mulberry32(seed);
  const offsetLimit = clamp(Math.floor(Number(maxOffset) || 1), 1, 128);
  let mutated = 0;

  for (let i = 0; i < length; i++) {
    if (random() > amount) {
      continue;
    }

    const offset = start + i;
    const randomOffsetIndex = Math.floor(random() * offsetLimit * 2);
    const signedOffset = randomOffsetIndex < offsetLimit
      ? randomOffsetIndex - offsetLimit
      : randomOffsetIndex - offsetLimit + 1;
    bytes[offset] = (bytes[offset] + signedOffset + 256) & 0xff;

    mutated += 1;
  }

  return mutated;
}

function findSignatureOffsets(bytes, signature, start = 0, end = bytes.length) {
  const offsets = [];
  const searchStart = clamp(start, 0, bytes.length);
  const searchEnd = clamp(end, searchStart, bytes.length);

  if (signature.length === 0 || signature.length > searchEnd - searchStart) {
    return offsets;
  }

  for (let i = searchStart; i <= searchEnd - signature.length; i++) {
    let matches = true;

    for (let j = 0; j < signature.length; j++) {
      if (bytes[i + j] !== signature[j]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      offsets.push(i);
    }
  }

  return offsets;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseHexBytes(text) {
  const normalized = String(text).replace(/0x/gi, "").trim();

  if (normalized.length === 0) {
    return [];
  }

  if (/[^0-9a-fA-F\s,;:_-]/.test(normalized)) {
    throw new Error("Signature must be hexadecimal bytes.");
  }

  const hex = normalized.replace(/[\s,;:_-]+/g, "");

  if (hex.length % 2 !== 0) {
    throw new Error("Signature has an odd number of hex digits.");
  }

  const bytes = [];

  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }

  return bytes;
}

/* -------------------------------------------------------
   Resource fork / .dfont parser
------------------------------------------------------- */

function parseResourceFork(buffer) {
  const view = new DataView(buffer);

  if (buffer.byteLength < 16) {
    throw new Error("File is too small to be a .dfont resource fork.");
  }

  const dataOffset = readU32(view, 0);
  const mapOffset = readU32(view, 4);
  const dataLength = readU32(view, 8);
  const mapLength = readU32(view, 12);

  if (dataOffset + dataLength > buffer.byteLength) {
    throw new Error("Resource data area points outside the file.");
  }

  if (mapOffset + mapLength > buffer.byteLength) {
    throw new Error("Resource map area points outside the file.");
  }

  const typeListOffset = mapOffset + readU16(view, mapOffset + 24);
  const nameListOffset = mapOffset + readU16(view, mapOffset + 26);
  const typeCount = readU16(view, typeListOffset) + 1;
  const resources = [];

  for (let t = 0; t < typeCount; t++) {
    const typeEntryOffset = typeListOffset + 2 + t * 8;
    const type = readTag(view, typeEntryOffset);
    const resourceCount = readU16(view, typeEntryOffset + 4) + 1;
    const referenceListOffset = typeListOffset + readU16(view, typeEntryOffset + 6);

    for (let r = 0; r < resourceCount; r++) {
      const refOffset = referenceListOffset + r * 12;
      const id = readI16(view, refOffset);
      const nameOffset = readU16(view, refOffset + 2);
      const attributes = readU8(view, refOffset + 4);
      const dataRelativeOffset = readU24(view, refOffset + 5);
      const dataBlockOffset = dataOffset + dataRelativeOffset;
      const resourceLength = readU32(view, dataBlockOffset);
      const resourceDataOffset = dataBlockOffset + 4;

      if (resourceDataOffset + resourceLength > buffer.byteLength) {
        throw new Error(`${type} resource #${id} points outside the file.`);
      }

      const name = nameOffset === 0xffff
        ? null
        : readPascalString(view, nameListOffset + nameOffset);
      const data = buffer.slice(resourceDataOffset, resourceDataOffset + resourceLength);

      resources.push({
        type,
        id,
        name,
        attributes,
        data,
        absoluteDataOffset: resourceDataOffset,
        absoluteDataEnd: resourceDataOffset + resourceLength
      });
    }
  }

  return resources;
}

/* -------------------------------------------------------
   Embedded bitmap sfnt parser: bloc/bdat
------------------------------------------------------- */

function parseBitmapSFNT(buffer) {
  const view = new DataView(buffer);

  if (buffer.byteLength < 12) {
    throw new Error("sfnt resource is too small.");
  }

  const scalerType = readTagOrVersion(view, 0);
  const numTables = readU16(view, 4);
  const tables = [];

  for (let i = 0; i < numTables; i++) {
    const offset = 12 + i * 16;
    const tag = readTag(view, offset);
    const tableOffset = readU32(view, offset + 8);
    const length = readU32(view, offset + 12);

    if (tableOffset + length > buffer.byteLength) {
      throw new Error(`${tag} table points outside the sfnt resource.`);
    }

    tables.push({ tag, offset: tableOffset, length });
  }

  const bloc = findTable(tables, "bloc") || findTable(tables, "EBLC") || findTable(tables, "CBLC");
  const bdat = findTable(tables, "bdat") || findTable(tables, "EBDT") || findTable(tables, "CBDT");

  if (!bloc || !bdat) {
    throw new Error("No supported bitmap sfnt tables found. Expected bloc/bdat.");
  }

  const cmap = findTable(tables, "cmap");
  const cmapMaps = cmap ? parseCmap(view, cmap) : { charToGlyph: new Map(), glyphToChars: new Map() };
  const strikes = parseBlocTable(view, bloc, bdat);

  return {
    buffer,
    scalerType,
    tables,
    bloc,
    bdat,
    charToGlyph: cmapMaps.charToGlyph,
    glyphToChars: cmapMaps.glyphToChars,
    strikes
  };
}

function parseBlocTable(view, bloc, bdat) {
  const base = bloc.offset;
  const version = readU32(view, base);
  const numSizes = readU32(view, base + 4);
  const strikes = [];

  if (version !== 0x00020000) {
    throw new Error(`Unsupported bloc version 0x${version.toString(16)}.`);
  }

  for (let sizeIndex = 0; sizeIndex < numSizes; sizeIndex++) {
    const sizeOffset = base + 8 + sizeIndex * 48;
    const indexSubTableArrayOffset = readU32(view, sizeOffset);
    const numberOfIndexSubTables = readU32(view, sizeOffset + 8);
    const startGlyphIndex = readU16(view, sizeOffset + 40);
    const endGlyphIndex = readU16(view, sizeOffset + 42);
    const ppemX = readU8(view, sizeOffset + 44);
    const ppemY = readU8(view, sizeOffset + 45);
    const bitDepth = readU8(view, sizeOffset + 46);
    const flags = readU8(view, sizeOffset + 47);
    const glyphs = new Map();
    const imageFormats = new Set();
    const bitmapRanges = [];

    for (let i = 0; i < numberOfIndexSubTables; i++) {
      const arrayOffset = base + indexSubTableArrayOffset + i * 8;
      const firstGlyphIndex = readU16(view, arrayOffset);
      const lastGlyphIndex = readU16(view, arrayOffset + 2);
      const additionalOffset = readU32(view, arrayOffset + 4);
      const subtableOffset = base + indexSubTableArrayOffset + additionalOffset;
      parseIndexSubTable(view, subtableOffset, firstGlyphIndex, lastGlyphIndex, bdat, glyphs, imageFormats, bitmapRanges);
    }

    const dataStart = bitmapRanges.length > 0
      ? Math.min(...bitmapRanges.map(range => range.start))
      : Infinity;
    const dataEnd = bitmapRanges.length > 0
      ? Math.max(...bitmapRanges.map(range => range.end))
      : -Infinity;

    strikes.push({
      startGlyphIndex,
      endGlyphIndex,
      ppemX,
      ppemY,
      bitDepth,
      flags,
      glyphs,
      imageFormats: Array.from(imageFormats).sort(),
      dataStart,
      dataEnd
    });
  }

  return strikes;
}

function parseIndexSubTable(view, subtableOffset, firstGlyphIndex, lastGlyphIndex, bdat, glyphs, imageFormats, bitmapRanges) {
  const indexFormat = readU16(view, subtableOffset);
  const imageFormat = readU16(view, subtableOffset + 2);
  const imageDataOffset = readU32(view, subtableOffset + 4);

  imageFormats.add(imageFormat);

  if (indexFormat !== 1) {
    throw new Error(`Unsupported bitmap index format ${indexFormat}.`);
  }

  if (imageFormat !== 2) {
    throw new Error(`Unsupported bitmap image format ${imageFormat}.`);
  }

  const glyphCount = lastGlyphIndex - firstGlyphIndex + 1;
  const offsets = [];

  for (let i = 0; i < glyphCount + 1; i++) {
    offsets.push(readU32(view, subtableOffset + 8 + i * 4));
  }

  for (let i = 0; i < glyphCount; i++) {
    const start = offsets[i];
    const end = offsets[i + 1];

    if (end <= start) {
      continue;
    }

    const glyphOffset = bdat.offset + imageDataOffset + start;
    const glyphLength = end - start;

    if (glyphOffset + glyphLength > bdat.offset + bdat.length) {
      throw new Error(`Bitmap glyph ${firstGlyphIndex + i} points outside bdat.`);
    }

    bitmapRanges.push({ start: glyphOffset, end: glyphOffset + glyphLength });

    try {
      glyphs.set(firstGlyphIndex + i, parseSmallBitmapGlyph(view, glyphOffset, glyphLength));
    } catch (error) {
      // Byte glitches can corrupt individual glyph metrics. Keep the rest of the strike usable.
    }
  }
}

function parseSmallBitmapGlyph(view, offset, length) {
  if (length < 5) {
    throw new Error("Bitmap glyph is too small for smallGlyphMetrics.");
  }

  const height = readU8(view, offset);
  const width = readU8(view, offset + 1);
  const bearingX = readI8(view, offset + 2);
  const bearingY = readI8(view, offset + 3);
  const advance = readU8(view, offset + 4);
  const bitmapOffset = offset + 5;
  const bitmapLength = length - 5;

  if (width > 128 || height > 128) {
    throw new Error(`Bitmap glyph metrics are too large after corruption: ${width}x${height}.`);
  }

  return { view, height, width, bearingX, bearingY, advance, bitmapOffset, bitmapLength };
}

function parseCmap(view, table) {
  const base = table.offset;
  const numTables = readU16(view, base + 2);
  const records = [];

  for (let i = 0; i < numTables; i++) {
    const recordOffset = base + 4 + i * 8;
    records.push({
      platformID: readU16(view, recordOffset),
      encodingID: readU16(view, recordOffset + 2),
      offset: base + readU32(view, recordOffset + 4)
    });
  }

  const record = records.find(item => item.platformID === 3 && item.encodingID === 1) ||
    records.find(item => item.platformID === 0) ||
    records[0];

  if (!record) {
    return { charToGlyph: new Map(), glyphToChars: new Map() };
  }

  const format = readU16(view, record.offset);

  if (format === 4) {
    return parseCmapFormat4(view, record.offset);
  }

  if (format === 0) {
    return parseCmapFormat0(view, record.offset);
  }

  return { charToGlyph: new Map(), glyphToChars: new Map() };
}

function parseCmapFormat0(view, offset) {
  const charToGlyph = new Map();
  const glyphToChars = new Map();

  for (let charCode = 0; charCode < 256; charCode++) {
    const glyphID = readU8(view, offset + 6 + charCode);

    if (glyphID > 0) {
      addCmapEntry(charToGlyph, glyphToChars, charCode, glyphID);
    }
  }

  return { charToGlyph, glyphToChars };
}

function parseCmapFormat4(view, offset) {
  const length = readU16(view, offset + 2);
  const segCount = readU16(view, offset + 6) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + segCount * 2 + 2;
  const idDeltaOffset = startCodeOffset + segCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segCount * 2;
  const charToGlyph = new Map();
  const glyphToChars = new Map();

  for (let i = 0; i < segCount; i++) {
    const endCode = readU16(view, endCodeOffset + i * 2);
    const startCode = readU16(view, startCodeOffset + i * 2);
    const idDelta = readI16(view, idDeltaOffset + i * 2);
    const idRangeOffsetPosition = idRangeOffsetOffset + i * 2;
    const idRangeOffset = readU16(view, idRangeOffsetPosition);

    if (startCode === 0xffff && endCode === 0xffff) {
      continue;
    }

    for (let charCode = startCode; charCode <= endCode; charCode++) {
      let glyphID;

      if (idRangeOffset === 0) {
        glyphID = (charCode + idDelta) & 0xffff;
      } else {
        const glyphOffset = idRangeOffsetPosition + idRangeOffset + (charCode - startCode) * 2;

        if (glyphOffset < offset || glyphOffset + 2 > offset + length) {
          continue;
        }

        const rawGlyphID = readU16(view, glyphOffset);
        glyphID = rawGlyphID === 0 ? 0 : (rawGlyphID + idDelta) & 0xffff;
      }

      if (glyphID > 0) {
        addCmapEntry(charToGlyph, glyphToChars, charCode, glyphID);
      }
    }
  }

  return { charToGlyph, glyphToChars };
}

function addCmapEntry(charToGlyph, glyphToChars, charCode, glyphID) {
  charToGlyph.set(charCode, glyphID);

  if (!glyphToChars.has(glyphID)) {
    glyphToChars.set(glyphID, []);
  }

  glyphToChars.get(glyphID).push(charCode);
}

function findTable(tables, tag) {
  return tables.find(table => table.tag === tag);
}

/* -------------------------------------------------------
   NFNT parser
------------------------------------------------------- */

function parseNFNT(buffer) {
  const view = new DataView(buffer);

  if (buffer.byteLength < 26) {
    throw new Error("NFNT resource is too small.");
  }

  const nfnt = {
    view,
    fontType: readI16(view, 0),
    firstChar: readU16(view, 2),
    lastChar: readU16(view, 4),
    widMax: readI16(view, 6),
    kernMax: readI16(view, 8),
    nDescent: readI16(view, 10),
    fRectWidth: readI16(view, 12),
    fRectHeight: readI16(view, 14),
    owTLoc: readU16(view, 16),
    ascent: readI16(view, 18),
    descent: readI16(view, 20),
    leading: readI16(view, 22),
    rowWords: readU16(view, 24)
  };

  if (nfnt.rowWords === 0) {
    throw new Error("NFNT has no bitmap rows.");
  }

  nfnt.bitImageOffset = 26;
  nfnt.bitImageBytes = nfnt.rowWords * nfnt.fRectHeight * 2;
  nfnt.locTableOffset = nfnt.bitImageOffset + nfnt.bitImageBytes;
  nfnt.owTableOffset = nfnt.owTLoc * 2;
  nfnt.strikeWidth = nfnt.rowWords * 16;
  nfnt.glyphCount = nfnt.lastChar - nfnt.firstChar + 1;

  if (nfnt.locTableOffset + (nfnt.glyphCount + 2) * 2 > buffer.byteLength) {
    throw new Error("NFNT bitmap location table is outside the resource.");
  }

  if (nfnt.owTableOffset + (nfnt.glyphCount + 1) * 2 > buffer.byteLength) {
    throw new Error("NFNT offset/width table is outside the resource.");
  }

  return nfnt;
}

/* -------------------------------------------------------
   Glyph pixel accessors (shared by the UI renderer)
------------------------------------------------------- */

function getGlyphInfo(nfnt, charCode) {
  const index = charCode >= nfnt.firstChar && charCode <= nfnt.lastChar
    ? charCode - nfnt.firstChar
    : nfnt.glyphCount;
  const sourceX = readGlyphLocation(nfnt, index);
  const nextX = readGlyphLocation(nfnt, index + 1);
  const width = Math.max(0, nextX - sourceX);
  const ow = readOffsetWidth(nfnt, index);

  if (ow === 0xffff) {
    return null;
  }

  return {
    sourceX,
    width,
    offset: signedByte((ow >> 8) & 0xff),
    advance: ow & 0xff
  };
}

function getNFNTPixel(nfnt, x, y) {
  if (x < 0 || y < 0 || x >= nfnt.strikeWidth || y >= nfnt.fRectHeight) {
    return false;
  }

  const wordIndex = y * nfnt.rowWords + Math.floor(x / 16);
  const wordOffset = nfnt.bitImageOffset + wordIndex * 2;
  const word = readU16(nfnt.view, wordOffset);
  const bitIndex = 15 - (x % 16);

  return (word & (1 << bitIndex)) !== 0;
}

function readGlyphLocation(nfnt, index) {
  return readU16(nfnt.view, nfnt.locTableOffset + index * 2);
}

function readOffsetWidth(nfnt, index) {
  return readU16(nfnt.view, nfnt.owTableOffset + index * 2);
}

function getSFNTBitmapGlyphPixel(glyph, x, y) {
  const bitIndex = y * glyph.width + x;
  const byteOffset = glyph.bitmapOffset + Math.floor(bitIndex / 8);

  if (byteOffset >= glyph.bitmapOffset + glyph.bitmapLength) {
    return false;
  }

  const byte = readU8(glyph.view, byteOffset);
  const bit = 7 - (bitIndex % 8);

  return (byte & (1 << bit)) !== 0;
}

/* -------------------------------------------------------
   Deterministic byte mutation + hex
------------------------------------------------------- */

function mulberry32(seed) {
  return function nextRandom() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexBytes(buffer, offset, length) {
  const bytes = new Uint8Array(buffer, offset, length);
  const parts = [];

  for (const byte of bytes) {
    parts.push(byte.toString(16).padStart(2, "0").toUpperCase());
  }

  return parts.join(" ");
}

/* -------------------------------------------------------
   Binary helpers
------------------------------------------------------- */

function readU8(view, offset) { return view.getUint8(offset); }
function readI8(view, offset) { return view.getInt8(offset); }
function readU16(view, offset) { return view.getUint16(offset, false); }
function readI16(view, offset) { return view.getInt16(offset, false); }
function readU24(view, offset) {
  return (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
}
function readU32(view, offset) { return view.getUint32(offset, false); }

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3)
  );
}

function readTagOrVersion(view, offset) {
  const a = view.getUint8(offset);
  const b = view.getUint8(offset + 1);
  const c = view.getUint8(offset + 2);
  const d = view.getUint8(offset + 3);

  if (a === 0x00 && b === 0x01 && c === 0x00 && d === 0x00) {
    return "TrueType 1.0";
  }

  return String.fromCharCode(a, b, c, d);
}

function readPascalString(view, offset) {
  const length = readU8(view, offset);
  let result = "";

  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(readU8(view, offset + 1 + i));
  }

  return result;
}

function signedByte(value) {
  return value >= 128 ? value - 256 : value;
}
