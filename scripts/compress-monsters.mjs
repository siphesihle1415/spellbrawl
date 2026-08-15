import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
const outDir = path.join(root, "public", "models", "monsters");
mkdirSync(outDir, { recursive: true });

const models = [
  { source: "Meshy_AI_Embermaw_0815130850_texture.glb", output: "embermaw-a.glb" },
  { source: "Meshy_AI_Embermaw_0815130936_texture.glb", output: "embermaw-b.glb" },
  { source: "Meshy_AI_Shard Warden_0815130924_texture.glb", output: "shard-warden-a.glb" },
  { source: "Meshy_AI_Shard Warden_0815133242_texture.glb", output: "shard-warden-b.glb" },
  { source: "Meshy_AI_Shard Warden_0815133251_texture.glb", output: "shard-warden-c.glb" },
  { source: "Meshy_AI_Hexwyrm_0815130910_texture.glb", output: "hexwyrm-a.glb" },
  { source: "Meshy_AI_Hexwyrm_0815133652_texture.glb", output: "hexwyrm-b.glb" },
];

for (const { source, output } of models) {
  const sourcePath = path.join(root, source);
  const outputPath = path.join(outDir, output);
  console.log(`Compressing ${source} -> public/models/monsters/${output}`);
  execFileSync(
    process.execPath,
    [
      cli,
      "optimize",
      sourcePath,
      outputPath,
      "--compress",
      "meshopt",
      "--simplify",
      "true",
      "--simplify-ratio",
      "0.15",
      "--simplify-error",
      "0.001",
      "--texture-compress",
      "false",
    ],
    { stdio: "inherit" },
  );
}
