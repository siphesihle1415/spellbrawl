// The *-walking.glb files each ship a 2048x2048 PNG (~6.9 MB) for a character never seen larger
// than a few hundred pixels. WebP q85 at 1024 is indistinguishable here. Geometry untouched.
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { textureCompress } from "@gltf-transform/functions";
import sharp from "sharp";
import { createIO, writeBinaryGLB } from "./gltf-io.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const monsterDir = path.join(root, "public", "models", "monsters");

const meshFiles = ["embermaw-walking.glb", "shard-warden-walking.glb", "hexwyrm-walking.glb"];

const io = await createIO();
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

let before = 0;
let after = 0;

for (const file of meshFiles) {
  const filePath = path.join(monsterDir, file);
  const sizeBefore = statSync(filePath).size;
  const document = await io.read(filePath);

  await document.transform(
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 85, resize: [1024, 1024] }),
  );

  await writeBinaryGLB(io, document, filePath);

  const sizeAfter = statSync(filePath).size;
  before += sizeBefore;
  after += sizeAfter;
  console.log(`${file}: ${megabytes(sizeBefore)} -> ${megabytes(sizeAfter)}`);
}

console.log(`\nTotal: ${megabytes(before)} -> ${megabytes(after)} (saved ${megabytes(before - after)})`);
