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
