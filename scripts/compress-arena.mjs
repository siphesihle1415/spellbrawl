// The arena ships uncompressed from Blender: 1,976,179 triangles (57.7 MB of vertex data) plus
// three 2048x2048 JPEGs. It is static set dressing viewed from a fixed camera, so that vertex
// budget buys nothing visible while costing every frame and ~20s of startup parse.
// Destructive and NOT idempotent: it overwrites the file in place, so re-running compounds the
// simplification. Restore the source first with `git checkout public/models/<file>`.
// Run with an explicit ratio to experiment:
//   node scripts/compress-arena.mjs 0.25 2048 path/to/source.glb
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { createIO, writeBinaryGLB } from "./gltf-io.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "public", "models", "spellbrawl-three-rooms-open-lighting.glb");
const output = source;
// ratio 1 disables simplification; textureSize 0 leaves the source textures untouched.
const ratio = Number(process.argv[2] ?? 0.25);
const textureSize = Number(process.argv[3] ?? 2048);
const sourceFile = process.argv[4] ? path.resolve(root, process.argv[4]) : source;

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const io = await createIO();
const document = await io.read(sourceFile);
const sizeBefore = statSync(sourceFile).size;

const triangles = (doc) => doc.getRoot().listMeshes()
  .flatMap((mesh) => mesh.listPrimitives())
  .reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3, 0);

const trianglesBefore = triangles(document);

await document.transform(
  dedup(),
  ...(ratio < 1
    ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.005, lockBorder: true })]
    : []),
  // Only baseColor/emissive survive lossy encoding. Normal and metallicRoughness pack independent
  // per-channel values that lossy WebP's chroma subsampling smears together, visibly darkening the
  // arena — and near-lossless encodes larger than the source JPEGs, so those two are left as-is.
  ...(textureSize > 0
    ? [
        textureCompress({
          encoder: sharp,
          targetFormat: "webp",
          slots: /baseColorTexture|emissiveTexture/,
          quality: 88,
          resize: [textureSize, textureSize],
        }),
      ]
    : []),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

await writeBinaryGLB(io, document, output);

const sizeAfter = statSync(output).size;
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`ratio ${ratio}, textureSize ${textureSize || "unchanged"}`);
console.log(`  triangles: ${trianglesBefore.toLocaleString()} -> ${triangles(document).toLocaleString()}`);
console.log(`  size:      ${megabytes(sizeBefore)} -> ${megabytes(sizeAfter)}`);
