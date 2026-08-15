import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
const outDir = path.join(root, "public", "models", "characters");
mkdirSync(outDir, { recursive: true });

const models = [
  { source: "Meshy_AI_Arcane_Sentinel_0815151536_texture.glb", output: "arcane-sentinel.glb" },
  { source: "Meshy_AI_Stormforged_Vanguard_0815153255_texture.glb", output: "stormforged-vanguard.glb" },
];

for (const { source, output } of models) {
  const sourcePath = path.join(root, source);
  const outputPath = path.join(outDir, output);
  console.log(`Compressing ${source} -> public/models/characters/${output}`);
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
