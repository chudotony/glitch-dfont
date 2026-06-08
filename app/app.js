/* =======================================================
   app.js — UI layer for the .dfont bitmap glitch lab
   - resolution slider (one milestone per strike)
   - cap height decoupled from resolution
   - two horizontal screens: phrase + full typeface specimen
   - glitch controls apply to all strikes from the bottom dock
======================================================= */

/* ---------- element refs ---------- */
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const previewTextInput = document.getElementById("previewText");
const resInput = document.getElementById("resInput");
const resTicks = document.getElementById("resTicks");
const resReadout = document.getElementById("resReadout");
const phraseHeightInput = document.getElementById("phraseHeightInput");
const phraseHeightReadout = document.getElementById("phraseHeightReadout");
const typeHeightInput = document.getElementById("typeHeightInput");
const typeHeightReadout = document.getElementById("typeHeightReadout");
const phraseBody = document.getElementById("phraseBody");
const typeBody = document.getElementById("typeBody");

const glitchInput = document.getElementById("glitchInput");
const glitchValue = document.getElementById("glitchValue");
const glitchTicks = document.getElementById("glitchTicks");
const maxOffsetInput = document.getElementById("maxOffsetInput");
const maxOffsetValue = document.getElementById("maxOffsetValue");
const maxOffsetTicks = document.getElementById("maxOffsetTicks");
const rerollButton = document.getElementById("rerollButton");
const resetButton = document.getElementById("resetButton");
const downloadDfont = document.getElementById("downloadDfont");

const INK = "#404040";
const STORE_KEY = "dfont-glitch-lab";

/* default glitch settings — used by Reset */
const GLITCH_DEFAULTS = Object.freeze({
  amount: 0,
  maxOffset: 32,
  seed: 0x4d4143
});

/* ---------- state ---------- */
let currentFile = null;
let originalBuffer = null;
let corruptedBuffer = null;
let corruptedObjectUrl = null;

let strikes = [];                // corrupted descriptors (with capHeight from clean)
let selectedIndex = 0;
let phraseHeight = Number(phraseHeightInput.value) || 96;
let typeHeight = Number(typeHeightInput.value) || 96;

const glitch = {
  amount: 0,
  maxOffset: 32,
  seed: 0x4d4143
};

initRangeVisuals();
restorePrefs();
updateAllRangeFills();
updateTickStates(glitchInput, glitchTicks);
updateTickStates(maxOffsetInput, maxOffsetTicks);

/* ---------- listeners ---------- */
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (file) {
    await loadDfont(file);
  }
});

downloadDfont.addEventListener("click", event => {
  if (downloadDfont.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
  }
});

previewTextInput.addEventListener("input", () => {
  savePrefs();
  if (strikes.length) {
    renderPhrase(strikes[selectedIndex]);
  }
});

// Make the phrase preview behave like an editable field: clicking it focuses
// the text input (and on phones pops the keyboard) so people type right where
// the glitched letters appear.
phraseBody.addEventListener("mousedown", event => {
  if (event.target.closest("a, button")) {
    return;
  }
  event.preventDefault();
  previewTextInput.focus();
  const end = previewTextInput.value.length;
  try { previewTextInput.setSelectionRange(end, end); } catch (_) {}
});
previewTextInput.addEventListener("focus", () => phraseBody.classList.add("typing"));
previewTextInput.addEventListener("blur", () => phraseBody.classList.remove("typing"));

resInput.addEventListener("input", () => {
  selectedIndex = clamp(Number(resInput.value) || 0, 0, Math.max(0, strikes.length - 1));
  setRangeFill(resInput);
  render();
});

phraseHeightInput.addEventListener("input", () => {
  phraseHeight = Number(phraseHeightInput.value) || 96;
  phraseHeightReadout.textContent = `${phraseHeight} px`;
  setRangeFill(phraseHeightInput);
  savePrefs();
  if (strikes.length) {
    renderPhrase(strikes[selectedIndex]);
  }
});

typeHeightInput.addEventListener("input", () => {
  typeHeight = Number(typeHeightInput.value) || 96;
  typeHeightReadout.textContent = `${typeHeight} px`;
  setRangeFill(typeHeightInput);
  savePrefs();
  if (strikes.length) {
    renderTypeface(strikes[selectedIndex]);
  }
});

glitchInput.addEventListener("input", () => {
  glitch.amount = Number(glitchInput.value) || 0;
  glitchValue.textContent = `${glitch.amount}%`;
  setRangeFill(glitchInput);
  updateTickStates(glitchInput, glitchTicks);
  savePrefs();
  rebuild();
});

maxOffsetInput.addEventListener("input", () => {
  glitch.maxOffset = clamp(Number(maxOffsetInput.value) || 1, 1, 128);
  maxOffsetValue.textContent = `±${glitch.maxOffset}`;
  setRangeFill(maxOffsetInput);
  updateTickStates(maxOffsetInput, maxOffsetTicks);
  savePrefs();
  rebuild();
});

rerollButton.addEventListener("click", () => {
  glitch.seed = Math.floor(Math.random() * 0xffffffff);
  rebuild();
});

resetButton.addEventListener("click", () => {
  glitch.amount = GLITCH_DEFAULTS.amount;
  glitch.maxOffset = GLITCH_DEFAULTS.maxOffset;
  glitch.seed = GLITCH_DEFAULTS.seed;

  glitchInput.value = String(glitch.amount);
  glitchValue.textContent = `${glitch.amount}%`;
  maxOffsetInput.value = String(glitch.maxOffset);
  maxOffsetValue.textContent = `±${glitch.maxOffset}`;
  setRangeFill(glitchInput);
  setRangeFill(maxOffsetInput);
  updateTickStates(glitchInput, glitchTicks);
  updateTickStates(maxOffsetInput, maxOffsetTicks);

  savePrefs();
  rebuild();
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (strikes.length) {
      render();
    }
  }, 120);
});

/* ---------- load + rebuild pipeline ---------- */
async function loadDfont(file) {
  currentFile = file;
  fileName.textContent = file.name;

  try {
    originalBuffer = await file.arrayBuffer();
    selectedIndex = 0;
    rebuild();
  } catch (error) {
    console.error(error);
    originalBuffer = null;
    corruptedBuffer = null;
    updateDownloadLink();
    showPhraseError("Could not read file", String(error.message || error));
    typeBody.innerHTML = `<div class="empty"><div>—</div></div>`;
  }
}

function rebuild() {
  if (!originalBuffer) {
    return;
  }

  let targets = [];
  try {
    targets = discoverStrikeTargets(originalBuffer);
  } catch (error) {
    targets = [];
  }

  const edits = new Map(targets.map(target => [target.key, glitch]));

  try {
    const result = corruptDfontBytes(originalBuffer, targets, edits);
    corruptedBuffer = result.buffer;
  } catch (error) {
    corruptedBuffer = originalBuffer;
    console.error(error);
  }

  const clean = buildDescriptors(originalBuffer);
  const dirty = buildDescriptors(corruptedBuffer);
  strikes = dirty.strikes;

  // Cap height is measured from the CLEAN strike so the on-screen letter size
  // stays put while the user dials in the glitch.
  strikes.forEach((strike, index) => {
    const reference = clean.strikes[index] || strike;
    // Keep a handle on the clean descriptor so the typeface specimen can pin
    // every glyph to its original top-left anchor while drawing glitched pixels.
    strike.clean = reference;
    strike.capHeight = measureCapHeight(reference);
  });

  selectedIndex = clamp(selectedIndex, 0, Math.max(0, strikes.length - 1));

  setupResSlider();
  updateDownloadLink();

  if (!strikes.length) {
    const message = dirty.error
      ? String(dirty.error.message || dirty.error)
      : "No NFNT or sfnt bitmap strikes found in this .dfont.";
    showPhraseError("No drawable strikes", message);
    typeBody.innerHTML = `<div class="empty"><div>—</div></div>`;
    return;
  }

  render();
}

/* ---------- descriptors ---------- */
function buildDescriptors(buffer) {
  let resources;
  try {
    resources = parseResourceFork(buffer);
  } catch (error) {
    return { strikes: [], error };
  }

  const out = [];

  for (const resource of resources.filter(item => item.type === "sfnt")) {
    let parsed;
    try {
      parsed = parseBitmapSFNT(resource.data);
    } catch (error) {
      continue;
    }
    parsed.strikes.forEach((strike, index) => {
      out.push(makeSFNTDescriptor(resource, parsed, strike, index));
    });
  }

  for (const resource of resources.filter(item => item.type === "NFNT")) {
    let nfnt;
    try {
      nfnt = parseNFNT(resource.data);
    } catch (error) {
      continue;
    }
    out.push(makeNFNTDescriptor(resource, nfnt));
  }

  out.sort((a, b) => a.pixelSize - b.pixelSize || a.label.localeCompare(b.label));
  return { strikes: out, error: null };
}

function makeSFNTDescriptor(resource, parsed, strike, index) {
  const getCell = charCode => {
    const glyphID = parsed.charToGlyph.get(charCode);
    if (glyphID === undefined) {
      return null;
    }
    const glyph = strike.glyphs.get(glyphID);
    if (!glyph) {
      return null;
    }
    return {
      width: glyph.width,
      height: glyph.height,
      bearingX: glyph.bearingX,
      bearingY: glyph.bearingY,
      advance: Math.max(1, glyph.advance),
      pixel: (x, y) => getSFNTBitmapGlyphPixel(glyph, x, y)
    };
  };

  const charCodes = [];
  for (const charCode of parsed.charToGlyph.keys()) {
    const cell = getCell(charCode);
    if (cell && cell.width > 0 && cell.height > 0) {
      charCodes.push(charCode);
    }
  }

  return {
    kind: "sfnt",
    id: resource.id,
    label: `sfnt ${resource.id}`,
    pixelSize: strike.ppemY || strike.ppemX || 1,
    glyphCount: charCodes.length,
    charCodes,
    getCell,
    capHeight: 0
  };
}

function makeNFNTDescriptor(resource, nfnt) {
  const getCell = charCode => {
    const glyph = getGlyphInfo(nfnt, charCode);
    if (!glyph) {
      return null;
    }
    return {
      width: glyph.width,
      height: nfnt.fRectHeight,
      bearingX: glyph.offset,
      bearingY: nfnt.ascent,
      advance: Math.max(1, glyph.advance),
      pixel: (x, y) => getNFNTPixel(nfnt, glyph.sourceX + x, y)
    };
  };

  const charCodes = [];
  for (let charCode = nfnt.firstChar; charCode <= nfnt.lastChar; charCode++) {
    const cell = getCell(charCode);
    if (cell && cell.width > 0) {
      charCodes.push(charCode);
    }
  }

  return {
    kind: "NFNT",
    id: resource.id,
    label: `NFNT ${resource.id}`,
    pixelSize: nfnt.fRectHeight || 1,
    glyphCount: charCodes.length,
    charCodes,
    getCell,
    capHeight: 0
  };
}

function measureCapHeight(descriptor) {
  for (const char of "HEBXIOMND") {
    const cell = descriptor.getCell(char.charCodeAt(0));
    if (cell && cell.width > 0 && cell.height > 0) {
      let top = Infinity;
      let bottom = -Infinity;
      for (let y = 0; y < cell.height; y++) {
        for (let x = 0; x < cell.width; x++) {
          if (cell.pixel(x, y)) {
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      if (bottom >= top) {
        return bottom - top + 1;
      }
    }
  }
  return Math.max(1, Math.round(descriptor.pixelSize * 0.7));
}

function discoverStrikeTargets(buffer) {
  const targets = [];
  const resources = parseResourceFork(buffer);

  for (const resource of resources.filter(item => item.type === "sfnt")) {
    try {
      const parsed = parseBitmapSFNT(resource.data);
      parsed.strikes.forEach((strike, index) => {
        if (!Number.isFinite(strike.dataStart) || !Number.isFinite(strike.dataEnd) || strike.dataEnd <= strike.dataStart) {
          return;
        }
        targets.push({
          key: `sfnt:${resource.id}:${index}`,
          type: "sfnt",
          label: `sfnt ${resource.id} / ${strike.ppemY}px`,
          resourceId: resource.id,
          scopeStart: resource.absoluteDataOffset + strike.dataStart,
          scopeEnd: resource.absoluteDataOffset + strike.dataEnd,
          boundarySearchEnd: resource.absoluteDataEnd
        });
      });
    } catch (error) {
      /* unsupported sfnt — skip */
    }
  }

  for (const resource of resources.filter(item => item.type === "NFNT")) {
    try {
      const nfnt = parseNFNT(resource.data);
      targets.push({
        key: `NFNT:${resource.id}`,
        type: "NFNT",
        label: `NFNT ${resource.id} / ${nfnt.fRectHeight}px`,
        resourceId: resource.id,
        scopeStart: resource.absoluteDataOffset + nfnt.bitImageOffset,
        scopeEnd: resource.absoluteDataOffset + nfnt.bitImageOffset + nfnt.bitImageBytes,
        boundarySearchEnd: resource.absoluteDataEnd
      });
    } catch (error) {
      /* dummy NFNT — skip */
    }
  }

  return targets;
}

/* ---------- resolution slider ---------- */
function setupResSlider() {
  const count = strikes.length;

  if (count <= 1) {
    resInput.min = 0;
    resInput.max = 0;
    resInput.value = 0;
    resInput.disabled = true;
    resTicks.classList.add("disabled");
  } else {
    resInput.min = 0;
    resInput.max = count - 1;
    resInput.step = 1;
    resInput.value = selectedIndex;
    resInput.disabled = false;
    resTicks.classList.remove("disabled");
  }

  resTicks.innerHTML = "";
  strikes.forEach((strike, index) => {
    const span = document.createElement("span");
    span.textContent = String(strike.pixelSize);
    const tickPosition = count > 1 ? (index / (count - 1)) * 100 : 50;
    span.style.setProperty("--tick-position", `${tickPosition}%`);
    span.classList.toggle("on", index === selectedIndex);
    resTicks.appendChild(span);
  });

  setRangeFill(resInput);
  updateResReadout();
}

function updateResReadout() {
  const strike = strikes[selectedIndex];
  resReadout.textContent = strike
    ? `${strike.pixelSize}px · ${strike.glyphCount} glyphs`
    : "—";
}

function updateAllRangeFills() {
  [resInput, phraseHeightInput, typeHeightInput, glitchInput, maxOffsetInput].forEach(setRangeFill);
}

function initRangeVisuals() {
  document.querySelectorAll(".slider-fill-visual").forEach(fill => {
    fill.innerHTML = "";
    for (let i = 0; i < 48; i++) {
      fill.appendChild(document.createElement("span"));
    }
  });
}

function setRangeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const rawValue = Number(input.value);
  const value = Number.isFinite(rawValue) ? rawValue : min;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const slider = input.closest(".slider-control");
  if (slider) {
    const clampedPct = clamp(pct, 0, 100);
    const thumbWidth = parseFloat(getComputedStyle(slider).getPropertyValue("--range-thumb-width")) || 21;
    const thumbCorrection = clampedPct * (thumbWidth / 100);
    const fillCorrection = thumbWidth / 2 - thumbCorrection;
    slider.style.setProperty("--thumb-left", `calc(${clampedPct}% - ${thumbCorrection}px)`);
    slider.style.setProperty("--fill-end", `calc(${clampedPct}% + ${fillCorrection}px)`);
    slider.classList.toggle("disabled", input.disabled);
  }
}

function updateTickStates(input, ticks) {
  if (!ticks) {
    return;
  }
  const value = Number(input.value);
  [...ticks.children].forEach(tick => {
    tick.classList.toggle("on", Number(tick.dataset.value) === value);
  });
}

/* ---------- rendering ---------- */
function render() {
  if (!strikes.length) {
    return;
  }
  selectedIndex = clamp(selectedIndex, 0, strikes.length - 1);
  resInput.value = selectedIndex;
  setRangeFill(resInput);

  const strike = strikes[selectedIndex];
  renderPhrase(strike);
  renderTypeface(strike);

  [...resTicks.children].forEach((el, index) => el.classList.toggle("on", index === selectedIndex));
  updateResReadout();
}

function scaleFor(strike, height) {
  return height / Math.max(1, strike.capHeight);
}

function innerWidth(bodyEl) {
  return Math.max(40, bodyEl.clientWidth - 44);
}

function renderPhrase(strike) {
  const text = previewTextInput.value;
  const hasText = text.length > 0;
  const codes = Array.from(hasText ? text : " ", ch => ch.codePointAt(0));
  const scale = scaleFor(strike, phraseHeight);
  const maxNative = Math.max(8, Math.floor(innerWidth(phraseBody) / scale));
  const run = drawRun(strike, codes, maxNative, 0);

  phraseBody.innerHTML = "";
  const stack = document.createElement("div");
  stack.className = "phrase-stack";

  const line = document.createElement("div");
  line.className = "phrase-line";
  if (hasText) {
    styleCanvas(run, scale);
    line.appendChild(run.canvas);
  }

  // Blinking caret so the preview reads as an editable field — typing lands
  // right where the glitched letters appear.
  const caret = document.createElement("span");
  caret.className = "phrase-caret";
  caret.style.height = `${phraseHeight}px`;
  const inkCenter = (run.inkTop + run.inkBottom) / 2;
  const canvasCenter = run.nativeH / 2;
  caret.style.transform = `translateY(${(inkCenter - canvasCenter) * scale}px)`;
  line.appendChild(caret);
  stack.appendChild(line);

  if (!hasText) {
    const hint = document.createElement("div");
    hint.className = "phrase-hint";
    hint.textContent = "type here";
    stack.appendChild(hint);
  }

  phraseBody.appendChild(stack);
}

function renderTypeface(strike) {
  const sections = buildTypefaceSections(strike);
  typeBody.innerHTML = "";

  if (!sections.length) {
    typeBody.innerHTML = `<div class="empty"><div>This strike has no drawable glyphs.</div></div>`;
    return;
  }

  // Typeface specimen: the CLEAN letters all rest on one shared baseline, and
  // that baseline/pen point is each glyph's fixed coordinate origin. Glitched
  // pixels are drawn from that origin; anything past the slot shows as outliers.
  const layoutStrike = strike.clean || strike;
  const scale = scaleFor(strike, typeHeight);
  const maxNative = Math.max(8, Math.floor(innerWidth(typeBody) / scale));
  const extraGap = Math.max(1, Math.round(layoutStrike.pixelSize * 0.28));

  for (const section of sections) {
    const wrap = document.createElement("div");
    wrap.className = "spec-section";

    const label = document.createElement("div");
    label.className = "spec-label";
    const name = document.createElement("span");
    name.textContent = section.name;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(section.codes.length);
    label.append(name, count);

    const run = drawRun(strike, section.codes, maxNative, extraGap, { layoutStrike, growToFit: true, centerLines: true });
    styleCanvas(run, scale);

    wrap.append(label, run.canvas);
    typeBody.appendChild(wrap);
  }
}

function buildTypefaceSections(strike) {
  const set = new Set(strike.charCodes);
  const has = code => set.has(code);
  const isLatin = code => (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);

  const latin = [];
  for (let code = 0x41; code <= 0x5a; code++) if (has(code)) latin.push(code);
  for (let code = 0x61; code <= 0x7a; code++) if (has(code)) latin.push(code);

  const punctuation = [];
  for (let code = 0x21; code <= 0x7e; code++) {
    if (has(code) && !isLatin(code)) {
      punctuation.push(code);
    }
  }

  const other = [];
  for (const code of [...set].sort((a, b) => a - b)) {
    if (code === 0x20 || (code >= 0x21 && code <= 0x7e)) {
      continue;
    }
    other.push(code);
  }

  const sections = [];
  if (latin.length) sections.push({ name: "Latin alphabet", codes: latin });
  if (punctuation.length) sections.push({ name: "Numerals & punctuation", codes: punctuation });
  if (other.length) sections.push({ name: "Other characters", codes: other });
  return sections;
}

/* Lay glyphs out at native (1×) resolution; the canvas is then CSS-scaled so
   that the cap height matches the requested height regardless of the strike size.

   options.layoutStrike — when supplied, glyph positions, advances, line breaks
     and the ascent/descent box come from THIS strike (e.g. the clean font),
     while the pixels drawn come from `strike` (the glitched font). This pins
     each letter to a fixed top-left anchor even as the glitch changes its size.
   options.growToFit — when true, the canvas is enlarged so glitched pixels that
     spill past their fixed slot ("outliers") stay visible instead of clipping. */
function drawRun(strike, codes, maxNativeWidth, extraGap, options = {}) {
  const layoutStrike = options.layoutStrike || strike;
  const growToFit = !!options.growToFit;
  const centerLines = !!options.centerLines;
  // cellAnchor: pin every glyph's top-left to its slot origin (0,0), ignoring
  // side bearings / baseline. Used by the typeface specimen so each letter
  // always starts in the exact same place no matter how it's glitched.
  const cellAnchor = !!options.cellAnchor;
  const fallbackGap = Math.max(2, Math.round(layoutStrike.pixelSize * 0.42));

  let ascent = 0;
  let descent = 0;
  let cellHeight = 0;
  const items = codes.map(code => {
    const layoutCell = layoutStrike.getCell(code);
    const pixelCell = strike.getCell(code);
    if (layoutCell) {
      ascent = Math.max(ascent, layoutCell.bearingY);
      descent = Math.max(descent, layoutCell.height - layoutCell.bearingY);
      cellHeight = Math.max(cellHeight, layoutCell.height);
    }
    return { layoutCell, pixelCell };
  });

  if (ascent <= 0 && descent <= 0) {
    ascent = layoutStrike.pixelSize;
    descent = Math.max(0, Math.round(layoutStrike.pixelSize * 0.2));
  }
  if (cellHeight <= 0) {
    cellHeight = ascent + descent;
  }

  const placements = [];
  const lineWidths = [];
  let penX = 0;
  let line = 0;
  let lineMaxWidth = 0;

  for (const item of items) {
    const layoutCell = item.layoutCell;
    const advance = (layoutCell ? layoutCell.advance : fallbackGap) + extraGap;
    if (penX > 0 && penX + advance > maxNativeWidth) {
      line += 1;
      penX = 0;
    }
    placements.push({ ...item, x: penX, line });
    // Drop the trailing inter-glyph gap when measuring a line's true ink width.
    // In cellAnchor mode glyphs start at the slot origin, so side bearings are
    // not part of the width.
    let layoutWidth;
    if (cellAnchor) {
      layoutWidth = layoutCell ? layoutCell.width : advance;
    } else {
      layoutWidth = layoutCell ? layoutCell.bearingX + layoutCell.width : advance;
    }
    lineWidths[line] = penX + Math.max(layoutWidth, 0);
    penX += advance;
    lineMaxWidth = Math.max(lineMaxWidth, penX);
  }

  const lineCount = line + 1;
  const lineGap = Math.max(1, Math.round(layoutStrike.pixelSize * 0.4));
  const lineHeight = (cellAnchor ? cellHeight : ascent + descent) + lineGap;
  // The "frame": canvas size implied purely by the (clean) layout.
  const frameW = Math.max(1, Math.min(maxNativeWidth, Math.ceil(lineMaxWidth) + 1));
  const frameH = Math.max(1, lineCount * lineHeight);

  // Center each row within the frame (offsets come from the CLEAN line widths,
  // so they stay put as the glitch changes glyph sizes).
  const lineOffset = lineWidths.map(width =>
    centerLines ? Math.max(0, Math.round((frameW - 1 - width) / 2)) : 0
  );

  // Resolve each glyph's fixed top-left anchor (from the layout cell) and the
  // extent of its glitched pixels.
  let boundsW = frameW;
  let boundsH = frameH;
  for (const placement of placements) {
    const pixelCell = placement.pixelCell;
    if (!pixelCell) {
      continue;
    }
    const anchorCell = placement.layoutCell || pixelCell;
    if (cellAnchor) {
      // Every glyph starts at its slot's top-left corner (0,0).
      placement.destX = placement.x + (lineOffset[placement.line] || 0);
      placement.destY = placement.line * lineHeight;
    } else {
      const baseline = placement.line * lineHeight + ascent;
      placement.destX = Math.round(placement.x + anchorCell.bearingX) + (lineOffset[placement.line] || 0);
      placement.destY = baseline - anchorCell.bearingY;
    }
    boundsW = Math.max(boundsW, placement.destX + pixelCell.width);
    boundsH = Math.max(boundsH, placement.destY + pixelCell.height);
  }

  const nativeW = growToFit ? boundsW : frameW;
  const nativeH = growToFit ? boundsH : frameH;

  const canvas = document.createElement("canvas");
  canvas.width = nativeW;
  canvas.height = nativeH;
  canvas.className = "render-canvas";

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = INK;
  let inkTop = nativeH / 2;
  let inkBottom = nativeH / 2;
  let hasInk = false;

  for (const placement of placements) {
    const cell = placement.pixelCell;
    if (!cell) {
      continue;
    }
    const destX = placement.destX;
    const destY = placement.destY;
    for (let y = 0; y < cell.height; y++) {
      for (let x = 0; x < cell.width; x++) {
        if (cell.pixel(x, y)) {
          ctx.fillRect(destX + x, destY + y, 1, 1);
          inkTop = hasInk ? Math.min(inkTop, destY + y) : destY + y;
          inkBottom = hasInk ? Math.max(inkBottom, destY + y + 1) : destY + y + 1;
          hasInk = true;
        }
      }
    }
  }

  return { canvas, nativeW, nativeH, inkTop, inkBottom };
}

function styleCanvas(run, scale) {
  run.canvas.style.width = `${run.nativeW * scale}px`;
  run.canvas.style.height = `${run.nativeH * scale}px`;
}

/* ---------- download ---------- */
function updateDownloadLink() {
  if (corruptedObjectUrl) {
    URL.revokeObjectURL(corruptedObjectUrl);
    corruptedObjectUrl = null;
  }

  if (!corruptedBuffer || !currentFile || !glitch.amount) {
    downloadDfont.removeAttribute("href");
    downloadDfont.removeAttribute("download");
    downloadDfont.setAttribute("aria-disabled", "true");
    return;
  }

  const blob = new Blob([corruptedBuffer], { type: "application/octet-stream" });
  corruptedObjectUrl = URL.createObjectURL(blob);
  downloadDfont.href = corruptedObjectUrl;
  downloadDfont.download = makeCorruptedDfontName(currentFile.name);
  downloadDfont.setAttribute("aria-disabled", "false");
}

function makeCorruptedDfontName(name) {
  if (/\.dfont$/i.test(name)) {
    return name.replace(/\.dfont$/i, "-glitched.dfont");
  }
  return `${name}-glitched.dfont`;
}

/* ---------- helpers ---------- */
function showPhraseError(title, detail) {
  phraseBody.innerHTML =
    `<div class="empty error"><div><strong>${escapeHtml(title)}</strong><br />${escapeHtml(detail)}</div></div>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

/* ---------- preferences ---------- */
function savePrefs() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      phrase: previewTextInput.value,
      phraseHeight: phraseHeight,
      typeHeight: typeHeight,
      amount: glitch.amount,
      maxOffset: glitch.maxOffset
    }));
  } catch (error) {
    /* ignore storage failures */
  }
}

function restorePrefs() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch (error) {
    saved = null;
  }
  if (!saved) {
    return;
  }

  if (typeof saved.phrase === "string") {
    previewTextInput.value = saved.phrase;
  }
  // Back-compat: old prefs stored a single shared `height`.
  const legacyHeight = Number.isFinite(saved.height) ? saved.height : null;
  const ph = Number.isFinite(saved.phraseHeight) ? saved.phraseHeight : legacyHeight;
  const th = Number.isFinite(saved.typeHeight) ? saved.typeHeight : legacyHeight;
  if (Number.isFinite(ph)) {
    phraseHeight = ph;
    phraseHeightInput.value = ph;
    phraseHeightReadout.textContent = `${ph} px`;
  }
  if (Number.isFinite(th)) {
    typeHeight = th;
    typeHeightInput.value = th;
    typeHeightReadout.textContent = `${th} px`;
  }
  if (Number.isFinite(saved.amount)) {
    glitch.amount = clamp(saved.amount, 0, 30);
    glitchInput.value = String(glitch.amount);
    glitchValue.textContent = `${glitch.amount}%`;
  }
  if (Number.isFinite(saved.maxOffset)) {
    glitch.maxOffset = clamp(saved.maxOffset, 1, 128);
    maxOffsetInput.value = String(glitch.maxOffset);
    maxOffsetValue.textContent = `±${glitch.maxOffset}`;
  }
}
