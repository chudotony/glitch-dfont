# Glitch.dfont Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `Glitch.dfont` as a clean GitHub Pages project at `https://chudotony.github.io/glitch-dfont/` while keeping the repository history and course archive.

**Architecture:** Use the existing static app as the deployed site, served from `docs/` through GitHub Pages. Keep curated redistributable `.dfont` samples in `docs/samples/`, move course/process material to `research/`, and add a small sample loader to the client-side app.

**Tech Stack:** Static HTML/CSS/JavaScript, browser `fetch`, GitHub Pages from `/docs`, Node.js for a local verification script.

---

## File Structure

Created or modified files:

- Modify: `README.md` - public project README.
- Move: `app/index.html` to `docs/index.html` - deployed app shell and styles.
- Move: `app/app.js` to `docs/app.js` - deployed app UI/controller.
- Move: `app/font-core.js` to `docs/font-core.js` - deployed `.dfont` parser and glitch engine.
- Create: `docs/.nojekyll` - disables Jekyll processing for static assets.
- Create: `docs/samples/manifest.json` - browser-readable list of included samples.
- Create: `docs/samples/README.md` - sample licensing/attribution notes.
- Copy: `bitmap/Utopia-Regular.dfont` to `docs/samples/utopia-regular.dfont`.
- Copy: `bitmap/Utopia-Regular_8.dfont` to `docs/samples/utopia-regular-8.dfont`.
- Create: `scripts/verify-static-site.mjs` - local structural checks for Pages-ready output.
- Create: `research/README.md` - archive context.
- Move: `bitmap/` to `research/bitmap/`.
- Move: `postscript/` to `research/postscript/`.
- Move: `woff2/` to `research/woff2/`.
- Move: `dfont_rendering/` to `research/dfont_rendering/`.
- Move: `Utopia-Regular_8_images/` to `research/Utopia-Regular_8_images/`.
- Move: `BluuNext-Bold.dfont` to `research/BluuNext-Bold.dfont`.
- Move: `extracted-0.ttf` to `research/extracted-0.ttf`.

Sample policy:

- Include only the two Utopia `.dfont` samples in the public hosted app because the repository contains an explicit redistribution notice for Utopia under `postscript/utopia_test/README`.
- Keep BluuNext files in `research/` unless redistribution rights are confirmed separately.

---

### Task 1: Rename Repository And Align Remote

**Files:**

- No repository file changes.
- Remote metadata changes outside the working tree.

- [ ] **Step 1: Rename the repository on GitHub**

Use the GitHub web UI:

1. Open `https://github.com/chudotony/hgk_glitch_26/settings`.
2. Change **Repository name** to:

```text
glitch-dfont
```

3. Confirm the rename.

Expected result: GitHub repository URL becomes `https://github.com/chudotony/glitch-dfont`.

- [ ] **Step 2: Update local remote URL**

Run:

```bash
git remote set-url origin https://github.com/chudotony/glitch-dfont.git
```

Expected: no output.

- [ ] **Step 3: Verify remote URL**

Run:

```bash
git remote -v
```

Expected output includes:

```text
origin	https://github.com/chudotony/glitch-dfont.git (fetch)
origin	https://github.com/chudotony/glitch-dfont.git (push)
```

- [ ] **Step 4: Verify remote connectivity**

Run:

```bash
git ls-remote origin HEAD
```

Expected: one commit hash followed by `HEAD`.

- [ ] **Step 5: Commit**

Do not commit. This task changes GitHub repository settings and local git config only.

---

### Task 2: Create Pages Output Tree

**Files:**

- Create: `scripts/verify-static-site.mjs`
- Create: `docs/.nojekyll`
- Move: `app/index.html` to `docs/index.html`
- Move: `app/app.js` to `docs/app.js`
- Move: `app/font-core.js` to `docs/font-core.js`

- [ ] **Step 1: Write the failing verifier**

Create `scripts/verify-static-site.mjs`:

```js
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function mustExist(relativePath) {
  await access(path.join(root, relativePath));
}

async function mustContain(relativePath, expectedText) {
  const text = await readFile(path.join(root, relativePath), "utf8");
  if (!text.includes(expectedText)) {
    throw new Error(`${relativePath} does not contain ${JSON.stringify(expectedText)}`);
  }
}

async function main() {
  await mustExist("docs/index.html");
  await mustExist("docs/app.js");
  await mustExist("docs/font-core.js");
  await mustExist("docs/.nojekyll");
  await mustContain("docs/index.html", '<script src="font-core.js"></script>');
  await mustContain("docs/index.html", '<script src="app.js"></script>');
  console.log("Static site structure verified.");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run verifier to confirm it fails**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected: FAIL with a missing `docs/index.html`, `docs/app.js`, `docs/font-core.js`, or `docs/.nojekyll` message.

- [ ] **Step 3: Move static app files**

Run:

```bash
git mv app/index.html docs/index.html
```

Run:

```bash
git mv app/app.js docs/app.js
```

Run:

```bash
git mv app/font-core.js docs/font-core.js
```

Run:

```bash
rmdir app
```

- [ ] **Step 4: Add `.nojekyll`**

Create `docs/.nojekyll` as an empty file.

- [ ] **Step 5: Run verifier to confirm it passes**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/.nojekyll scripts/verify-static-site.mjs docs/index.html docs/app.js docs/font-core.js
git commit -m "chore: prepare static app for pages"
```

Expected: commit succeeds.

---

### Task 3: Add Public Sample Files

**Files:**

- Modify: `scripts/verify-static-site.mjs`
- Create: `docs/samples/manifest.json`
- Create: `docs/samples/README.md`
- Copy: `bitmap/Utopia-Regular.dfont` to `docs/samples/utopia-regular.dfont`
- Copy: `bitmap/Utopia-Regular_8.dfont` to `docs/samples/utopia-regular-8.dfont`

- [ ] **Step 1: Extend verifier for samples**

Replace `scripts/verify-static-site.mjs` with:

```js
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function mustExist(relativePath) {
  await access(path.join(root, relativePath));
}

async function mustContain(relativePath, expectedText) {
  const text = await readFile(path.join(root, relativePath), "utf8");
  if (!text.includes(expectedText)) {
    throw new Error(`${relativePath} does not contain ${JSON.stringify(expectedText)}`);
  }
}

async function readJson(relativePath) {
  const text = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(text);
}

async function main() {
  await mustExist("docs/index.html");
  await mustExist("docs/app.js");
  await mustExist("docs/font-core.js");
  await mustExist("docs/.nojekyll");
  await mustContain("docs/index.html", '<script src="font-core.js"></script>');
  await mustContain("docs/index.html", '<script src="app.js"></script>');

  const samples = await readJson("docs/samples/manifest.json");
  if (!Array.isArray(samples) || samples.length !== 2) {
    throw new Error("docs/samples/manifest.json must contain exactly 2 samples");
  }

  for (const sample of samples) {
    if (!sample.name || !sample.file || !sample.credit) {
      throw new Error("Every sample needs name, file, and credit fields");
    }
    if (sample.file.startsWith("/")) {
      throw new Error(`${sample.file} must be relative, not root-relative`);
    }
    await mustExist(path.join("docs", sample.file));
  }

  console.log("Static site structure verified.");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run verifier to confirm it fails**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected: FAIL because `docs/samples/manifest.json` does not exist yet.

- [ ] **Step 3: Create sample directory and copy files**

Run:

```bash
mkdir -p docs/samples
```

Run:

```bash
cp bitmap/Utopia-Regular.dfont docs/samples/utopia-regular.dfont
```

Run:

```bash
cp bitmap/Utopia-Regular_8.dfont docs/samples/utopia-regular-8.dfont
```

- [ ] **Step 4: Create sample manifest**

Create `docs/samples/manifest.json`:

```json
[
  {
    "name": "Utopia Regular",
    "file": "samples/utopia-regular.dfont",
    "credit": "Utopia, Adobe Systems Incorporated",
    "description": "Bitmap .dfont sample with multiple drawable strikes."
  },
  {
    "name": "Utopia Regular 8 px",
    "file": "samples/utopia-regular-8.dfont",
    "credit": "Utopia, Adobe Systems Incorporated",
    "description": "Small bitmap .dfont sample useful for visible byte glitches."
  }
]
```

- [ ] **Step 5: Create sample README**

Create `docs/samples/README.md`:

```markdown
# Samples

These `.dfont` files are included so visitors can try Glitch.dfont without creating a source file first.

Included samples:

- `utopia-regular.dfont`
- `utopia-regular-8.dfont`

The Utopia typefaces are credited to Adobe Systems Incorporated. The repository archive includes the original Utopia redistribution notice under `research/postscript/utopia_test/README` after the archive move.
```

- [ ] **Step 6: Run verifier to confirm it passes**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 7: Commit**

Run:

```bash
git add docs/samples scripts/verify-static-site.mjs
git commit -m "feat: add hosted dfont samples"
```

Expected: commit succeeds.

---

### Task 4: Add Sample Loader To App

**Files:**

- Modify: `scripts/verify-static-site.mjs`
- Modify: `docs/index.html`
- Modify: `docs/app.js`

- [ ] **Step 1: Extend verifier for sample UI**

In `scripts/verify-static-site.mjs`, add these checks after the existing script-tag checks:

```js
  await mustContain("docs/index.html", 'id="sampleSelect"');
  await mustContain("docs/index.html", 'id="sampleStatus"');
  await mustContain("docs/app.js", "loadSampleManifest");
  await mustContain("docs/app.js", "loadSampleDfont");
```

- [ ] **Step 2: Run verifier to confirm it fails**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected: FAIL because `docs/index.html` does not contain `id="sampleSelect"` yet.

- [ ] **Step 3: Add sample UI markup**

In `docs/index.html`, replace this block:

```html
      <div class="dfont-actions">
        <label class="file-btn dock-button" for="fileInput"><span>Upload source</span></label>
        <a id="downloadDfont" class="download dock-button" aria-disabled="true">Download glitch</a>
      </div>
      <input id="fileInput" type="file" accept=".dfont,.rsrc,application/octet-stream" />
```

with:

```html
      <div class="dfont-actions">
        <label class="file-btn dock-button" for="fileInput"><span>Upload source</span></label>
        <a id="downloadDfont" class="download dock-button" aria-disabled="true">Download glitch</a>
      </div>
      <label class="sample-label" for="sampleSelect">Sample</label>
      <select id="sampleSelect" class="sample-select" aria-describedby="sampleStatus">
        <option value="">Choose source</option>
      </select>
      <span id="sampleStatus" class="sample-status" aria-live="polite"></span>
      <input id="fileInput" type="file" accept=".dfont,.rsrc,application/octet-stream" />
```

- [ ] **Step 4: Add sample UI CSS**

In `docs/index.html`, after the `.dfont-actions` styles, add:

```css
    .sample-label {
      display: block;
      margin-top: 8px;
      color: var(--label-muted);
      font-size: 13px;
      line-height: 1;
      text-transform: uppercase;
    }

    .sample-select {
      width: 100%;
      min-height: 28px;
      margin-top: 4px;
      padding: 2px 6px;
      border: 0;
      border-radius: 0;
      background: var(--lcd);
      color: var(--ink);
      box-shadow: var(--input-bevel);
      font: inherit;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .sample-select:disabled {
      color: var(--muted);
    }

    .sample-status {
      display: block;
      min-height: 14px;
      margin-top: 4px;
      color: var(--danger);
      font-size: 12px;
      line-height: 1.1;
    }
```

- [ ] **Step 5: Add app element refs and manifest constant**

In `docs/app.js`, after:

```js
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
```

insert:

```js
const sampleSelect = document.getElementById("sampleSelect");
const sampleStatus = document.getElementById("sampleStatus");
```

After:

```js
const STORE_KEY = "dfont-glitch-lab";
```

insert:

```js
const SAMPLE_MANIFEST = "samples/manifest.json";
```

- [ ] **Step 6: Initialize samples**

In `docs/app.js`, after:

```js
updateTickStates(maxOffsetInput, maxOffsetTicks);
```

insert:

```js
loadSampleManifest();
```

- [ ] **Step 7: Add sample listener**

In `docs/app.js`, after the file input change listener, insert:

```js
sampleSelect.addEventListener("change", async () => {
  const option = sampleSelect.selectedOptions[0];
  if (!option || !option.value) {
    return;
  }

  await loadSampleDfont({
    name: option.dataset.name || option.textContent,
    file: option.value
  });
});
```

- [ ] **Step 8: Clear sample selection for manual uploads**

In the `fileInput.addEventListener("change", async () => { ... })` handler, replace:

```js
  if (file) {
    await loadDfont(file);
  }
```

with:

```js
  if (file) {
    sampleSelect.value = "";
    await loadDfont(file);
  }
```

- [ ] **Step 9: Add sample loading functions**

In `docs/app.js`, before `async function loadDfont(file)`, insert:

```js
async function loadSampleManifest() {
  sampleSelect.disabled = true;
  sampleStatus.textContent = "";

  try {
    const response = await fetch(SAMPLE_MANIFEST, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Sample list returned ${response.status}`);
    }

    const samples = await response.json();
    for (const sample of samples) {
      if (!sample.name || !sample.file) {
        continue;
      }

      const option = document.createElement("option");
      option.value = sample.file;
      option.dataset.name = sample.name;
      option.textContent = sample.name;
      sampleSelect.append(option);
    }

    sampleSelect.disabled = sampleSelect.options.length <= 1;
  } catch (error) {
    console.error(error);
    sampleStatus.textContent = "Samples unavailable";
  }
}

async function loadSampleDfont(sample) {
  sampleSelect.disabled = true;
  sampleStatus.textContent = "Loading";

  try {
    const response = await fetch(sample.file);
    if (!response.ok) {
      throw new Error(`Sample returned ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const file = new File([buffer], sample.name.endsWith(".dfont") ? sample.name : `${sample.name}.dfont`, {
      type: "application/octet-stream"
    });
    await loadDfont(file);
    sampleStatus.textContent = "";
  } catch (error) {
    console.error(error);
    sampleStatus.textContent = "Could not load";
    showPhraseError("Could not load sample", String(error.message || error));
  } finally {
    sampleSelect.disabled = sampleSelect.options.length <= 1;
  }
}
```

- [ ] **Step 10: Run verifier to confirm it passes**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 11: Commit**

Run:

```bash
git add docs/index.html docs/app.js scripts/verify-static-site.mjs
git commit -m "feat: load bundled dfont samples"
```

Expected: commit succeeds.

---

### Task 5: Rewrite Public README

**Files:**

- Modify: `scripts/verify-static-site.mjs`
- Modify: `README.md`

- [ ] **Step 1: Extend verifier for README**

In `scripts/verify-static-site.mjs`, add these checks before the final `console.log`:

```js
  await mustContain("README.md", "# Glitch.dfont");
  await mustContain("README.md", "https://chudotony.github.io/glitch-dfont/");
  await mustContain("README.md", "docs/samples");
  await mustContain("README.md", "runs entirely in the browser");
```

- [ ] **Step 2: Run verifier to confirm it fails**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected: FAIL because the current README still contains the coursework description.

- [ ] **Step 3: Replace README**

Replace `README.md` with:

```markdown
# Glitch.dfont

Glitch.dfont is a browser-based lab for corrupting classic Mac `.dfont` bitmap fonts and previewing the result live. It parses bitmap strikes in the browser, applies deterministic byte glitches, and lets you download the modified `.dfont`.

Try it here:

https://chudotony.github.io/glitch-dfont/

## Use

Open the hosted app and choose one of the included samples, upload a local `.dfont`, or drop a `.dfont` file onto the preview. Adjust the glitch probability and maximum byte offset, then download the glitched result.

The app runs entirely in the browser. Uploaded files are not sent to a server.

## Samples

Bundled samples live in `docs/samples` so the hosted app can load them directly. The public samples are Utopia `.dfont` files credited to Adobe Systems Incorporated.

## Repository

- `docs/` contains the GitHub Pages app.
- `docs/samples/` contains hosted sample `.dfont` files.
- `research/` contains the original coursework experiments, source material, and process archive.

This project began as a Digital Culture class experiment with font-file corruption and became a standalone browser tool.
```

- [ ] **Step 4: Run verifier to confirm it passes**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 5: Commit**

Run:

```bash
git add README.md scripts/verify-static-site.mjs
git commit -m "docs: rewrite project readme"
```

Expected: commit succeeds.

---

### Task 6: Move Coursework Material To Research Archive

**Files:**

- Modify: `scripts/verify-static-site.mjs`
- Create: `research/README.md`
- Move: `bitmap/` to `research/bitmap/`
- Move: `postscript/` to `research/postscript/`
- Move: `woff2/` to `research/woff2/`
- Move: `dfont_rendering/` to `research/dfont_rendering/`
- Move: `Utopia-Regular_8_images/` to `research/Utopia-Regular_8_images/`
- Move: `BluuNext-Bold.dfont` to `research/BluuNext-Bold.dfont`
- Move: `extracted-0.ttf` to `research/extracted-0.ttf`

- [ ] **Step 1: Extend verifier for archive structure**

In `scripts/verify-static-site.mjs`, add these checks before the final `console.log`:

```js
  await mustExist("research/README.md");
  await mustExist("research/bitmap/README.md");
  await mustExist("research/postscript/utopia_test/README");
  await mustExist("research/woff2/README.md");
  await mustExist("research/dfont_rendering/index.html");
  await mustExist("research/Utopia-Regular_8_images");
```

- [ ] **Step 2: Run verifier to confirm it fails**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected: FAIL because `research/README.md` does not exist yet.

- [ ] **Step 3: Create research README**

Create `research/README.md`:

```markdown
# Research Archive

This directory keeps the original coursework experiments and source material behind Glitch.dfont.

Contents:

- `bitmap/` - bitmap `.dfont` experiments and offset notes.
- `postscript/` - PostScript and Utopia test material.
- `woff2/` - earlier `.woff2` glitch experiments.
- `dfont_rendering/` - rendering tests and inspection utilities.
- `Utopia-Regular_8_images/` - generated bitmap preview images.

The hosted app lives in `../docs`.
```

- [ ] **Step 4: Move archive directories**

Run:

```bash
mkdir -p research
```

Run:

```bash
git mv bitmap research/bitmap
```

Run:

```bash
git mv postscript research/postscript
```

Run:

```bash
git mv woff2 research/woff2
```

Run:

```bash
git mv dfont_rendering research/dfont_rendering
```

Run:

```bash
git mv Utopia-Regular_8_images research/Utopia-Regular_8_images
```

- [ ] **Step 5: Move archive files**

Run:

```bash
git mv BluuNext-Bold.dfont research/BluuNext-Bold.dfont
```

Run:

```bash
git mv extracted-0.ttf research/extracted-0.ttf
```

- [ ] **Step 6: Update sample README path**

In `docs/samples/README.md`, verify it already points to:

```text
research/postscript/utopia_test/README
```

If it still points to `postscript/utopia_test/README`, replace it with:

```text
research/postscript/utopia_test/README
```

- [ ] **Step 7: Run verifier to confirm it passes**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 8: Commit**

Run:

```bash
git add research docs/samples/README.md scripts/verify-static-site.mjs
git commit -m "chore: archive coursework materials"
```

Expected: commit succeeds.

---

### Task 7: Verify Locally As A Static Site

**Files:**

- No expected file changes.

- [ ] **Step 1: Run structural verifier**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 2: Start local static server**

Run:

```bash
python3 -m http.server 8000 --directory docs
```

Expected:

```text
Serving HTTP on :: port 8000
```

- [ ] **Step 3: Open local app**

Open:

```text
http://localhost:8000/
```

Expected:

- The page title/header reads `Glitch.dfont`.
- The sample dropdown is populated.
- Choosing `Utopia Regular` renders text in the preview.
- Choosing `Utopia Regular 8 px` renders text in the preview.
- Uploading a local `.dfont` still works.
- Dragging and dropping a local `.dfont` still works.
- `Download glitch` becomes enabled after a file is loaded.

- [ ] **Step 4: Stop local static server**

Stop the server with `Ctrl-C`.

- [ ] **Step 5: Commit**

Do not commit. This task is verification only.

---

### Task 8: Configure GitHub Pages

**Files:**

- No expected file changes unless GitHub creates Pages metadata outside the repository.

- [ ] **Step 1: Push all local commits**

Run:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 2: Configure Pages source**

Use the GitHub web UI:

1. Open `https://github.com/chudotony/glitch-dfont/settings/pages`.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main`.
4. Select folder `/docs`.
5. Save.

Expected: GitHub starts a Pages deployment.

- [ ] **Step 3: Verify Pages URL**

Open:

```text
https://chudotony.github.io/glitch-dfont/
```

Expected:

- The app loads.
- The browser console has no missing `app.js`, `font-core.js`, or sample manifest errors.
- The sample dropdown loads both Utopia samples.
- A selected sample renders.
- `Download glitch` works after applying a nonzero glitch.

- [ ] **Step 4: Commit**

Do not commit. This task changes GitHub repository settings only.

---

### Task 9: Final Audit

**Files:**

- No expected file changes.

- [ ] **Step 1: Check working tree**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 2: Check recent commits**

Run:

```bash
git log --oneline -8
```

Expected: recent commits include:

```text
chore: archive coursework materials
docs: rewrite project readme
feat: load bundled dfont samples
feat: add hosted dfont samples
chore: prepare static app for pages
```

- [ ] **Step 3: Re-run verifier**

Run:

```bash
node scripts/verify-static-site.mjs
```

Expected:

```text
Static site structure verified.
```

- [ ] **Step 4: Confirm public URLs**

Confirm these URLs resolve:

```text
https://github.com/chudotony/glitch-dfont
https://chudotony.github.io/glitch-dfont/
```

- [ ] **Step 5: Commit**

Do not commit. This task is verification only.

