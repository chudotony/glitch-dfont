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
