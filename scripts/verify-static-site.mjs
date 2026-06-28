import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.resolve(root, "docs");
const expectedSamples = new Map([
  ["Facade Ouest", "samples/facade-ouest.dfont"],
  ["Trickster Regular", "samples/trickster-regular.dfont"],
  ["PicNic Regular", "samples/picnic-regular.dfont"]
]);

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

function mustStayInsideDocs(relativePath) {
  const resolved = path.resolve(docsRoot, relativePath);
  if (resolved !== docsRoot && !resolved.startsWith(`${docsRoot}${path.sep}`)) {
    throw new Error(`${relativePath} must stay inside docs/`);
  }
  return path.relative(root, resolved);
}

async function main() {
  await mustExist("docs/index.html");
  await mustExist("docs/app.js");
  await mustExist("docs/font-core.js");
  await mustExist("docs/.nojekyll");
  await mustContain("docs/index.html", '<script src="font-core.js"></script>');
  await mustContain("docs/index.html", '<script src="app.js"></script>');
  await mustContain("docs/index.html", 'id="sampleSelect"');
  await mustContain("docs/index.html", 'id="sampleStatus"');
  await mustContain("docs/app.js", "loadSampleManifest");
  await mustContain("docs/app.js", "loadSampleDfont");
  await mustContain("docs/app.js", "dfontLoadToken");
  await mustContain("docs/app.js", "isSafeSamplePath");

  const samples = await readJson("docs/samples/manifest.json");
  if (!Array.isArray(samples) || samples.length !== expectedSamples.size) {
    throw new Error(`docs/samples/manifest.json must contain exactly ${expectedSamples.size} samples`);
  }

  for (const sample of samples) {
    if (!sample.name || !sample.file || !sample.credit || !sample.license || !sample.sourceUrl || !Array.isArray(sample.licenseFiles)) {
      throw new Error("Every sample needs name, file, credit, license, sourceUrl, and licenseFiles fields");
    }
    if (!/^https?:\/\//.test(sample.sourceUrl)) {
      throw new Error(`${sample.name} sourceUrl must be an absolute HTTP URL`);
    }
    if (!expectedSamples.has(sample.name)) {
      throw new Error(`${sample.name} is not an expected sample`);
    }
    if (expectedSamples.get(sample.name) !== sample.file) {
      throw new Error(`${sample.name} must point to ${expectedSamples.get(sample.name)}`);
    }
    if (sample.file.startsWith("/")) {
      throw new Error(`${sample.file} must be relative, not root-relative`);
    }
    await mustExist(mustStayInsideDocs(sample.file));
    for (const licenseFile of sample.licenseFiles) {
      if (licenseFile.startsWith("/")) {
        throw new Error(`${licenseFile} must be relative, not root-relative`);
      }
      await mustExist(mustStayInsideDocs(licenseFile));
    }
    for (const sourceFile of sample.sourceFiles || []) {
      if (sourceFile.startsWith("/")) {
        throw new Error(`${sourceFile} must be relative, not root-relative`);
      }
      await mustExist(mustStayInsideDocs(sourceFile));
    }
  }

  await mustContain("README.md", "# Glitch.dfont");
  await mustContain("README.md", "https://chudotony.github.io/glitch-dfont/");
  await mustContain("README.md", "browser-based `.dfont` bitmap font glitching app and lab");
  await mustContain("README.md", "Uploaded or dropped files are processed locally");
  await mustContain("README.md", "are not sent to a server");
  await mustContain("README.md", "Select an included sample");
  await mustContain("README.md", "upload/drop a `.dfont` file");
  await mustContain("README.md", "adjust the glitch controls");
  await mustContain("README.md", "download the resulting font file");
  await mustContain("README.md", "docs/samples");
  await mustContain("README.md", "runs entirely in the browser");
  await mustContain("README.md", "Facade Ouest");
  await mustContain("README.md", "Eleonore Fines / Velvetyne Type Foundry");
  await mustContain("README.md", "Trickster");
  await mustContain("README.md", "Jean-Baptiste Morizot");
  await mustContain("README.md", "PicNic");
  await mustContain("README.md", "Mariel Nils");
  await mustContain("README.md", "SIL Open Font License 1.1");
  await mustContain("README.md", "CUTE 0.1");
  await mustContain("README.md", "docs/samples/licenses");
  await mustContain("README.md", "`docs/` - GitHub Pages app");
  await mustContain("README.md", "`research/` - planned archive location");
  await mustContain("README.md", "Digital Culture class experiment");
  await mustContain("README.md", "standalone browser tool");

  await mustExist("research/README.md");
  await mustExist("research/bitmap/README.md");
  await mustExist("research/postscript/utopia_test/README");
  await mustExist("research/woff2/README.md");
  await mustExist("research/dfont_rendering/index.html");
  await mustExist("research/Utopia-Regular_8_images");

  console.log("Static site structure verified.");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
