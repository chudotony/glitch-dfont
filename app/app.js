const fileInput = document.getElementById("fileInput");
const previewTextInput = document.getElementById("previewText");
const signatureInput = document.getElementById("signatureInput");
const corruptLengthInput = document.getElementById("corruptLengthInput");
const zoomInput = document.getElementById("zoomInput");
const glitchInput = document.getElementById("glitchInput");
const rerollButton = document.getElementById("rerollButton");
const zoomValue = document.getElementById("zoomValue");
const glitchValue = document.getElementById("glitchValue");
const downloadDfont = document.getElementById("downloadDfont");
const log = document.getElementById("log");
const output = document.getElementById("output");

let currentFile = null;
let originalBuffer = null;
let corruptedBuffer = null;
let corruptedObjectUrl = null;
let corruptionInfo = null;
let currentResources = [];
let currentNFNTs = [];
let currentNFNTErrors = [];
let currentSFNTStrikes = [];
let currentSFNTErrors = [];
let glitchSeed = 0x4d4143;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  await loadDfont(file);
});

previewTextInput.addEventListener("input", renderAll);
signatureInput.addEventListener("input", rebuildCorruptedDfont);
corruptLengthInput.addEventListener("input", rebuildCorruptedDfont);

zoomInput.addEventListener("input", () => {
  updateControlReadouts();
  renderAll();
});

glitchInput.addEventListener("input", () => {
  updateControlReadouts();
  rebuildCorruptedDfont();
});

rerollButton.addEventListener("click", () => {
  glitchSeed = Math.floor(Math.random() * 0xffffffff);
  rebuildCorruptedDfont();
});

updateControlReadouts();

async function loadDfont(file) {
  currentFile = file;
  originalBuffer = null;
  corruptedBuffer = null;
  corruptionInfo = null;
  resetParsedState();
  updateDownloadLink();
  log.textContent = "Reading .dfont...";
  output.className = "notice";
  output.textContent = "Parsing resource fork.";

  try {
    originalBuffer = await file.arrayBuffer();
    rebuildCorruptedDfont();
  } catch (error) {
    console.error(error);
    log.textContent = String(error.stack || error.message || error);
    output.className = "notice error";
    output.textContent = "Could not read this file as a .dfont resource fork.";
  }
}

function rebuildCorruptedDfont() {
  resetParsedState();
  corruptedBuffer = null;
  corruptionInfo = null;

  if (!currentFile || !originalBuffer) {
    return;
  }

  try {
    const result = corruptDfontBytes(originalBuffer, getSignatureBytes(), getCorruptLength(), getGlitchAmount() / 100, glitchSeed);
    corruptedBuffer = result.buffer;
    corruptionInfo = result.info;
    currentResources = parseResourceFork(corruptedBuffer);

    for (const resource of currentResources.filter(item => item.type === "NFNT")) {
      try {
        currentNFNTs.push({ resource, nfnt: parseNFNT(resource.data) });
      } catch (error) {
        currentNFNTErrors.push({ resource, error });
      }
    }

    for (const resource of currentResources.filter(item => item.type === "sfnt")) {
      try {
        const parsed = parseBitmapSFNT(resource.data);

        for (const strike of parsed.strikes) {
          currentSFNTStrikes.push({ resource, parsed, strike });
        }
      } catch (error) {
        currentSFNTErrors.push({ resource, error });
      }
    }

    updateDownloadLink();
    renderAll();
  } catch (error) {
    console.error(error);
    corruptionInfo = { error: String(error.message || error) };
    updateDownloadLink();
    renderLog();
    output.className = "notice error";
    output.textContent = "Could not corrupt or parse this .dfont with the current settings.";
  }
}

function resetParsedState() {
  currentResources = [];
  currentNFNTs = [];
  currentNFNTErrors = [];
  currentSFNTStrikes = [];
  currentSFNTErrors = [];
}

function renderAll() {
  updateControlReadouts();

  if (!currentFile) {
    return;
  }

  renderLog();
  output.className = "";
  output.innerHTML = "";

  if (
    currentNFNTs.length === 0 &&
    currentNFNTErrors.length === 0 &&
    currentSFNTStrikes.length === 0 &&
    currentSFNTErrors.length === 0
  ) {
    output.className = "notice";
    output.textContent = "No NFNT or sfnt bitmap resources found in this .dfont.";
    return;
  }

  const textFrames = [];
  const atlasFrames = [];
  const errorCards = [];

  for (const item of currentSFNTStrikes) {
    const textCanvas = document.createElement("canvas");
    drawSFNTBitmapText(textCanvas, item.strike, item.parsed.charToGlyph, getPreviewText());
    textFrames.push(createCanvasFrame(
      `sfnt ${item.resource.id} / ${item.strike.ppemY}px`,
      textCanvas,
      `${item.resource.id}-sfnt-corrupted-text.png`
    ));

    const atlasCanvas = document.createElement("canvas");
    drawSFNTBitmapAtlas(atlasCanvas, item.strike, item.parsed.glyphToChars);
    atlasFrames.push(createCanvasFrame(
      `sfnt ${item.resource.id} / ${item.strike.ppemY}px`,
      atlasCanvas,
      `${item.resource.id}-sfnt-corrupted-atlas.png`
    ));
  }

  for (const item of currentNFNTs) {
    const textCanvas = document.createElement("canvas");
    drawNFNTText(textCanvas, item.nfnt, getPreviewText());
    textFrames.push(createCanvasFrame(
      `NFNT ${item.resource.id} / ${item.nfnt.fRectHeight}px`,
      textCanvas,
      `${item.resource.id}-corrupted-text.png`
    ));

    const atlasCanvas = document.createElement("canvas");
    drawNFNTStrike(atlasCanvas, item.nfnt);
    atlasFrames.push(createCanvasFrame(
      `NFNT ${item.resource.id} / ${item.nfnt.fRectHeight}px`,
      atlasCanvas,
      `${item.resource.id}-corrupted-strike.png`
    ));
  }

  for (const item of currentSFNTErrors) {
    errorCards.push(renderSFNTErrorCard(item.resource, item.error));
  }

  for (const item of currentNFNTErrors) {
    errorCards.push(renderNFNTErrorCard(item.resource, item.error));
  }

  if (textFrames.length > 0) {
    output.appendChild(createOutputGroup("Corrupted text images", textFrames));
  }

  if (atlasFrames.length > 0) {
    output.appendChild(createOutputGroup("Corrupted strike atlases", atlasFrames));
  }

  if (errorCards.length > 0) {
    output.appendChild(createOutputGroup("Skipped resources", errorCards));
  }
}

function updateControlReadouts() {
  zoomValue.textContent = `${getZoom()}x`;
  glitchValue.textContent = `${getGlitchAmount()}%`;
}

function renderLog() {
  const counts = {};

  for (const resource of currentResources) {
    counts[resource.type] = (counts[resource.type] || 0) + 1;
  }

  const corruptionLines = corruptionInfo && corruptionInfo.error
    ? [`corruption error: ${corruptionInfo.error}`]
    : [
        `signature: ${getSignatureInputText()}`,
        `signature matches: ${corruptionInfo ? corruptionInfo.matches : 0}`,
        `corrupt offset: ${corruptionInfo && corruptionInfo.offset >= 0 ? `0x${corruptionInfo.offset.toString(16)}` : "(not found)"}`,
        `corrupt bytes: ${corruptionInfo ? corruptionInfo.length : 0}`,
        `mutated bytes: ${corruptionInfo ? corruptionInfo.mutated : 0}`
      ];

  log.textContent = [
    `file: ${currentFile.name}`,
    `bytes: ${currentFile.size}`,
    ...corruptionLines,
    "",
    "resources:",
    ...Object.keys(counts).sort().map(type => `  ${type}: ${counts[type]}`),
    "",
    `sfnt bitmap strikes: ${currentSFNTStrikes.length}`,
    `sfnt skipped: ${currentSFNTErrors.length}`,
    `NFNT bitmap strikes: ${currentNFNTs.length}`,
    `NFNT skipped: ${currentNFNTErrors.length}`,
    `glitch seed: 0x${glitchSeed.toString(16).padStart(8, "0")}`
  ].join("\n");
}

function renderNFNTCard(resource, nfnt) {
  const card = document.createElement("section");
  card.className = "resource";

  const head = document.createElement("div");
  head.className = "resource-head";

  const title = document.createElement("h3");
  title.textContent = `NFNT resource ${resource.id}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${nfnt.fRectHeight}px strike`;

  head.append(title, badge);
  card.appendChild(head);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(createMetaBlock([
    `firstChar: ${nfnt.firstChar}`,
    `lastChar: ${nfnt.lastChar}`,
    `glyphCount: ${nfnt.glyphCount}`,
    `fRectWidth: ${nfnt.fRectWidth}`,
    `fRectHeight: ${nfnt.fRectHeight}`,
    `ascent: ${nfnt.ascent}`,
    `descent: ${nfnt.descent}`,
    `rowWords: ${nfnt.rowWords}`,
    `strikeWidth: ${nfnt.strikeWidth}`
  ]));
  meta.appendChild(createMetaBlock([
    "bitmap bytes:",
    hexBytes(resource.data, nfnt.bitImageOffset, Math.min(48, nfnt.bitImageBytes))
  ]));
  card.appendChild(meta);

  const grid = document.createElement("div");
  grid.className = "canvas-grid";

  const cleanTextCanvas = document.createElement("canvas");
  drawNFNTText(cleanTextCanvas, nfnt, getPreviewText());
  appendCanvasFrame(grid, "corrupted text image", cleanTextCanvas, `${resource.id}-corrupted-text.png`);

  const strikeCanvas = document.createElement("canvas");
  drawNFNTStrike(strikeCanvas, nfnt);
  appendCanvasFrame(grid, "corrupted strike atlas", strikeCanvas, `${resource.id}-corrupted-strike.png`);

  card.appendChild(grid);
  return card;
}

function renderSFNTStrikeCard(resource, parsed, strike) {
  const card = document.createElement("section");
  card.className = "resource";

  const head = document.createElement("div");
  head.className = "resource-head";

  const title = document.createElement("h3");
  title.textContent = `sfnt bitmap resource ${resource.id}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${strike.ppemY}px strike`;

  head.append(title, badge);
  card.appendChild(head);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(createMetaBlock([
    `scalerType: ${parsed.scalerType}`,
    `tables: ${parsed.tables.map(table => table.tag).join(", ")}`,
    `glyph range: ${strike.startGlyphIndex}-${strike.endGlyphIndex}`,
    `glyphs decoded: ${strike.glyphs.size}`,
    `ppemX: ${strike.ppemX}`,
    `ppemY: ${strike.ppemY}`,
    `bitDepth: ${strike.bitDepth}`,
    `imageFormat: ${strike.imageFormats.join(", ")}`
  ]));
  meta.appendChild(createMetaBlock([
    "bdat bytes:",
    hexBytes(parsed.buffer, parsed.bdat.offset, Math.min(64, parsed.bdat.length))
  ]));
  card.appendChild(meta);

  const grid = document.createElement("div");
  grid.className = "canvas-grid";

  const cleanTextCanvas = document.createElement("canvas");
  drawSFNTBitmapText(cleanTextCanvas, strike, parsed.charToGlyph, getPreviewText());
  appendCanvasFrame(grid, "corrupted text image", cleanTextCanvas, `${resource.id}-sfnt-corrupted-text.png`);

  const atlasCanvas = document.createElement("canvas");
  drawSFNTBitmapAtlas(atlasCanvas, strike, parsed.glyphToChars);
  appendCanvasFrame(grid, "corrupted strike atlas", atlasCanvas, `${resource.id}-sfnt-corrupted-atlas.png`);

  card.appendChild(grid);
  return card;
}

function renderNFNTErrorCard(resource, error) {
  const card = document.createElement("section");
  card.className = "resource";

  const head = document.createElement("div");
  head.className = "resource-head";

  const title = document.createElement("h3");
  title.textContent = `NFNT resource ${resource.id}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "skipped";

  head.append(title, badge);
  card.appendChild(head);
  card.appendChild(createMetaBlock([
    "This NFNT resource did not contain drawable bitmap rows.",
    String(error.message || error)
  ]));

  return card;
}

function renderSFNTErrorCard(resource, error) {
  const card = document.createElement("section");
  card.className = "resource";

  const head = document.createElement("div");
  head.className = "resource-head";

  const title = document.createElement("h3");
  title.textContent = `sfnt resource ${resource.id}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "skipped";

  head.append(title, badge);
  card.appendChild(head);
  card.appendChild(createMetaBlock([
    "This sfnt resource did not contain a supported bitmap strike.",
    String(error.message || error)
  ]));

  return card;
}

function createMetaBlock(lines) {
  const block = document.createElement("pre");
  block.textContent = lines.join("\n");
  return block;
}

function createOutputGroup(title, items) {
  const section = document.createElement("section");
  section.className = "resource";

  const head = document.createElement("div");
  head.className = "resource-head";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${items.length}`;

  const grid = document.createElement("div");
  grid.className = "canvas-grid";

  for (const item of items) {
    grid.appendChild(item);
  }

  head.append(heading, badge);
  section.append(head, grid);
  return section;
}

function createCanvasFrame(title, canvas, fileName) {
  const frame = document.createElement("div");
  frame.className = "frame";

  const titleRow = document.createElement("div");
  titleRow.className = "frame-title";

  const label = document.createElement("span");
  label.textContent = title;

  const download = document.createElement("a");
  download.className = "download";
  download.href = canvas.toDataURL("image/png");
  download.download = fileName;
  download.textContent = "PNG";

  titleRow.append(label, download);
  frame.append(titleRow, canvas);
  applyZoom(canvas);
  return frame;
}

function appendCanvasFrame(parent, title, canvas, fileName) {
  const frame = createCanvasFrame(title, canvas, fileName);
  parent.appendChild(frame);
  return frame;
}

function applyZoom(canvas) {
  const zoom = getZoom();
  canvas.style.width = `${canvas.width * zoom}px`;
  canvas.style.height = `${canvas.height * zoom}px`;
}

function getPreviewText() {
  return previewTextInput.value || " ";
}

function getZoom() {
  return Number(zoomInput.value) || 8;
}

function getGlitchAmount() {
  return Number(glitchInput.value) || 0;
}

function getCorruptLength() {
  return Math.max(0, Math.floor(Number(corruptLengthInput.value) || 0));
}

function getSignatureInputText() {
  return signatureInput.value.trim() || "(empty)";
}

function getSignatureBytes() {
  return parseHexBytes(signatureInput.value);
}

function updateDownloadLink() {
  if (corruptedObjectUrl) {
    URL.revokeObjectURL(corruptedObjectUrl);
    corruptedObjectUrl = null;
  }

  if (!corruptedBuffer || !currentFile) {
    downloadDfont.hidden = true;
    downloadDfont.removeAttribute("href");
    return;
  }

  const blob = new Blob([corruptedBuffer], { type: "application/octet-stream" });
  corruptedObjectUrl = URL.createObjectURL(blob);
  downloadDfont.href = corruptedObjectUrl;
  downloadDfont.download = makeCorruptedDfontName(currentFile.name);
  downloadDfont.hidden = false;
}

function makeCorruptedDfontName(fileName) {
  if (/\.dfont$/i.test(fileName)) {
    return fileName.replace(/\.dfont$/i, "-corrupted.dfont");
  }

  return `${fileName}-corrupted.dfont`;
}

function corruptDfontBytes(buffer, signature, corruptLength, amount, seed) {
  const bytes = new Uint8Array(buffer.slice(0));
  const matches = signature.length === 0 ? [] : findSignatureOffsets(bytes, signature);
  const signatureOffset = matches.length > 0 ? matches[0] : -1;
  let mutated = 0;
  let actualLength = 0;

  if (signatureOffset >= 0 && corruptLength > 0 && amount > 0) {
    const start = signatureOffset + signature.length;
    actualLength = Math.min(corruptLength, Math.max(0, bytes.length - start));
    mutated = mutateByteRange(bytes, start, actualLength, amount, seed);
  } else if (signatureOffset >= 0) {
    actualLength = Math.min(corruptLength, Math.max(0, bytes.length - signatureOffset - signature.length));
  }

  return {
    buffer: bytes.buffer,
    info: {
      matches: matches.length,
      signatureOffset,
      offset: signatureOffset >= 0 ? signatureOffset + signature.length : -1,
      length: actualLength,
      mutated
    }
  };
}

function mutateByteRange(bytes, start, length, amount, seed) {
  const random = mulberry32(seed);
  let mutated = 0;

  for (let i = 0; i < length; i++) {
    if (random() > amount) {
      continue;
    }

    const offset = start + i;
    const mode = Math.floor(random() * 3);

    if (mode === 0) {
      bytes[offset] ^= 1 << Math.floor(random() * 8);
    } else if (mode === 1) {
      bytes[offset] = Math.floor(random() * 256);
    } else {
      bytes[offset] = (bytes[offset] + Math.floor(random() * 65) - 32) & 0xff;
    }

    mutated += 1;
  }

  return mutated;
}

function findSignatureOffsets(bytes, signature) {
  const offsets = [];

  if (signature.length === 0 || signature.length > bytes.length) {
    return offsets;
  }

  for (let i = 0; i <= bytes.length - signature.length; i++) {
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

function parseHexBytes(text) {
  const normalized = text.replace(/0x/gi, "").trim();

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

      resources.push({ type, id, name, attributes, data });
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

    for (let i = 0; i < numberOfIndexSubTables; i++) {
      const arrayOffset = base + indexSubTableArrayOffset + i * 8;
      const firstGlyphIndex = readU16(view, arrayOffset);
      const lastGlyphIndex = readU16(view, arrayOffset + 2);
      const additionalOffset = readU32(view, arrayOffset + 4);
      const subtableOffset = base + indexSubTableArrayOffset + additionalOffset;
      parseIndexSubTable(view, subtableOffset, firstGlyphIndex, lastGlyphIndex, bdat, glyphs, imageFormats);
    }

    strikes.push({
      startGlyphIndex,
      endGlyphIndex,
      ppemX,
      ppemY,
      bitDepth,
      flags,
      glyphs,
      imageFormats: Array.from(imageFormats).sort()
    });
  }

  return strikes;
}

function parseIndexSubTable(view, subtableOffset, firstGlyphIndex, lastGlyphIndex, bdat, glyphs, imageFormats) {
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

  return {
    view,
    height,
    width,
    bearingX,
    bearingY,
    advance,
    bitmapOffset,
    bitmapLength
  };
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
   NFNT rendering
------------------------------------------------------- */

function drawNFNTStrike(canvas, nfnt) {
  canvas.width = Math.max(1, nfnt.strikeWidth);
  canvas.height = Math.max(1, nfnt.fRectHeight);

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";

  for (let y = 0; y < nfnt.fRectHeight; y++) {
    for (let x = 0; x < nfnt.strikeWidth; x++) {
      if (getNFNTPixel(nfnt, x, y)) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawNFNTText(canvas, nfnt, text) {
  const glyphs = [];
  let totalWidth = 2;

  for (const char of text) {
    const glyph = getGlyphInfo(nfnt, char.charCodeAt(0));
    glyphs.push(glyph);
    totalWidth += glyph ? Math.max(1, glyph.advance) : Math.max(1, nfnt.widMax);
  }

  canvas.width = Math.max(1, totalWidth + 2);
  canvas.height = Math.max(1, nfnt.fRectHeight + 4);

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";

  let penX = 2;
  const penY = 2;

  for (const glyph of glyphs) {
    if (!glyph) {
      penX += Math.max(1, nfnt.widMax);
      continue;
    }

    const destX = penX + glyph.offset;

    for (let y = 0; y < nfnt.fRectHeight; y++) {
      for (let x = 0; x < glyph.width; x++) {
        if (getNFNTPixel(nfnt, glyph.sourceX + x, y)) {
          ctx.fillRect(destX + x, penY + y, 1, 1);
        }
      }
    }

    penX += Math.max(1, glyph.advance);
  }
}

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

/* -------------------------------------------------------
   sfnt bitmap rendering
------------------------------------------------------- */

function drawSFNTBitmapText(canvas, strike, charToGlyph, text) {
  const glyphRuns = [];
  let width = 4;
  let maxBearingY = 0;
  let maxDescent = 0;

  for (const char of text) {
    const glyphID = charToGlyph.get(char.charCodeAt(0));
    const glyph = glyphID === undefined ? null : strike.glyphs.get(glyphID);
    glyphRuns.push(glyph);

    if (glyph) {
      width += Math.max(1, glyph.advance);
      maxBearingY = Math.max(maxBearingY, glyph.bearingY);
      maxDescent = Math.max(maxDescent, glyph.height - glyph.bearingY);
    } else {
      width += Math.max(2, Math.round(strike.ppemX / 2));
    }
  }

  const baseline = 2 + Math.max(maxBearingY, strike.ppemY);
  const height = Math.max(1, baseline + maxDescent + 2);

  canvas.width = Math.max(1, width + 2);
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";

  let penX = 2;

  for (const glyph of glyphRuns) {
    if (!glyph) {
      penX += Math.max(2, Math.round(strike.ppemX / 2));
      continue;
    }

    drawSFNTBitmapGlyph(ctx, glyph, penX + glyph.bearingX, baseline - glyph.bearingY);
    penX += Math.max(1, glyph.advance);
  }
}

function drawSFNTBitmapAtlas(canvas, strike, glyphToChars) {
  const glyphEntries = Array.from(strike.glyphs.entries()).sort((a, b) => a[0] - b[0]);
  const padding = 2;
  let width = padding;
  let height = padding;

  for (const [, glyph] of glyphEntries) {
    width += glyph.width + padding;
    height = Math.max(height, glyph.height + padding * 2);
  }

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";

  let x = padding;

  for (const [, glyph] of glyphEntries) {
    drawSFNTBitmapGlyph(ctx, glyph, x, padding);
    x += glyph.width + padding;
  }
}

function drawSFNTBitmapGlyph(ctx, glyph, destX, destY) {
  for (let y = 0; y < glyph.height; y++) {
    for (let x = 0; x < glyph.width; x++) {
      if (getSFNTBitmapGlyphPixel(glyph, x, y)) {
        ctx.fillRect(destX + x, destY + y, 1, 1);
      }
    }
  }
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
   Deterministic byte mutation
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

function readU8(view, offset) {
  return view.getUint8(offset);
}

function readI8(view, offset) {
  return view.getInt8(offset);
}

function readU16(view, offset) {
  return view.getUint16(offset, false);
}

function readI16(view, offset) {
  return view.getInt16(offset, false);
}

function readU24(view, offset) {
  return (
    (view.getUint8(offset) << 16) |
    (view.getUint8(offset + 1) << 8) |
    view.getUint8(offset + 2)
  );
}

function readU32(view, offset) {
  return view.getUint32(offset, false);
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
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
