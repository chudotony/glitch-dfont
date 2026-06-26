import FreeTypeInit from "https://cdn.jsdelivr.net/npm/freetype-wasm@0/dist/freetype.js";

const FreeType = await FreeTypeInit();

async function testDfont(file) {
  const originalBytes = new Uint8Array(await file.arrayBuffer());

  const faces = FreeType.LoadFontFromBytes(originalBytes);
  console.log("faces", faces);

  for (const face of faces) {
    console.log("family", face.family_name);
    console.log("style", face.style_name);
    console.log("flags", face.face_flags);
    console.log("available sizes", face.available_sizes);
    console.log("charmaps", face.charmaps);
  }
}