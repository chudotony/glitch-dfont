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

  console.log("Static site structure verified.");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
