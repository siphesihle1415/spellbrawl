// Nine monster GLBs exist only to supply AnimationClips — their `scene` is never rendered, since
// each monster draws the mesh from its *-walking.glb. Meshy exports them "withSkin", so each also
// ships a duplicate character mesh and 2048x2048 texture (~7 MB) for a clip measured in kilobytes.
// Strips them to skeleton + clips. Node names are preserved: three.js derives track names from
// them, so the clips must keep binding to the walking mesh's skeleton.
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PropertyType } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";
import { createIO, writeBinaryGLB } from "./gltf-io.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const monsterDir = path.join(root, "public", "models", "monsters");

// Every monster clip except *-walking.glb, whose mesh is the one actually rendered.
const animationOnlyClips = [
  "embermaw-zombie-scream.glb",
  "embermaw-jumping-punch.glb",
  "embermaw-falling-down.glb",
  "shard-warden-skill-03.glb",
  "shard-warden-triple-combo-attack.glb",
  "shard-warden-shot-in-the-back-and-fall.glb",
  "hexwyrm-zombie-scream.glb",
  "hexwyrm-crouch-charge-and-throw.glb",
  "hexwyrm-shot-and-fall-backward.glb",
];

const io = await createIO();
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

mkdirSync(monsterDir, { recursive: true });

let before = 0;
let after = 0;

for (const file of animationOnlyClips) {
  const filePath = path.join(monsterDir, file);
  const sizeBefore = statSync(filePath).size;
  const document = await io.read(filePath);
  const documentRoot = document.getRoot();

  const clipNames = documentRoot.listAnimations().map((animation) => animation.getName());
  if (clipNames.length === 0) throw new Error(`${file} has no animations to keep — refusing to strip it.`);

  for (const mesh of documentRoot.listMeshes()) mesh.dispose();
  for (const skin of documentRoot.listSkins()) skin.dispose();
  for (const material of documentRoot.listMaterials()) material.dispose();
  for (const texture of documentRoot.listTextures()) texture.dispose();

  // NODE is excluded on purpose: pruning unused bones would rename nothing but could drop joints
  // the walking skeleton still expects, and the nodes cost only a few bytes each anyway.
  await document.transform(
    prune({
      propertyTypes: [
        PropertyType.MESH,
        PropertyType.PRIMITIVE,
        PropertyType.MATERIAL,
        PropertyType.TEXTURE,
        PropertyType.ACCESSOR,
        PropertyType.BUFFER,
      ],
    }),
  );

  await writeBinaryGLB(io, document, filePath);

  const sizeAfter = statSync(filePath).size;
  before += sizeBefore;
  after += sizeAfter;
  console.log(`${file}: ${megabytes(sizeBefore)} -> ${megabytes(sizeAfter)} (kept ${clipNames.join(", ")})`);
}

console.log(`\nTotal: ${megabytes(before)} -> ${megabytes(after)} (saved ${megabytes(before - after)})`);
