import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const code = await readFile("docs/font-core.js", "utf8");
const context = { console };
vm.createContext(context);
vm.runInContext(code, context);

function makeBuffer(bytes) {
  const view = new Uint8Array(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function testSfntUsesTableRangeWhenBitmapBytesContainFalseEndSignature() {
  const bytes = new Uint8Array(64).fill(0x7f);
  bytes.set([0x00, 0x01, 0x01, 0x00, 0x01], 12);
  bytes.set([0x00, 0x01, 0x00, 0x00, 0x00, 0x01], 20);

  const result = context.corruptDfontBytes(
    makeBuffer(bytes),
    [{
      key: "sfnt:test:0",
      type: "sfnt",
      label: "sfnt test / 70px",
      scopeStart: 10,
      scopeEnd: 50,
      boundarySearchEnd: 64
    }],
    new Map([["sfnt:test:0", { amount: 100, maxOffset: 1, seed: 1 }]])
  );

  assert.equal(result.info.byStrike[0].offset, 10);
  assert.equal(result.info.byStrike[0].length, 40);
  assert.equal(result.info.byStrike[0].mutated, 40);
}

function testNfntStillUsesSignaturesInsideResourceScope() {
  const bytes = new Uint8Array(64).fill(0x7f);
  bytes.set([0x00, 0x01, 0x01, 0x00, 0x01], 12);
  bytes.set([0x00, 0x01, 0x00, 0x00, 0x00, 0x01], 30);

  const result = context.corruptDfontBytes(
    makeBuffer(bytes),
    [{
      key: "NFNT:test",
      type: "NFNT",
      label: "NFNT test / 12px",
      scopeStart: 10,
      scopeEnd: 50,
      boundarySearchEnd: 64
    }],
    new Map([["NFNT:test", { amount: 100, maxOffset: 1, seed: 1 }]])
  );

  assert.equal(result.info.byStrike[0].offset, 17);
  assert.equal(result.info.byStrike[0].length, 13);
  assert.equal(result.info.byStrike[0].mutated, 13);
}

testSfntUsesTableRangeWhenBitmapBytesContainFalseEndSignature();
testNfntStillUsesSignaturesInsideResourceScope();
console.log("font-core tests passed.");
