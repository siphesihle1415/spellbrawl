import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
const sourceDir = path.join(root, "animations");
const outDir = path.join(root, "public", "models", "monsters");
mkdirSync(outDir, { recursive: true });

const clips = [
  { source: "Meshy_AI_Embermaw_Animation_Walking_withSkin.glb", output: "embermaw-walking.glb" },
  { source: "Meshy_AI_Embermaw_Animation_Zombie_Scream_withSkin.glb", output: "embermaw-zombie-scream.glb" },
  { source: "Meshy_AI_Embermaw_Animation_Jumping_Punch_withSkin.glb", output: "embermaw-jumping-punch.glb" },
  { source: "Meshy_AI_Embermaw_Animation_falling_down_withSkin.glb", output: "embermaw-falling-down.glb" },
];

for (const { source, output } of clips) {
  const sourcePath = path.join(sourceDir, source);
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
      "false",
      "--texture-compress",
      "false",
    ],
    { stdio: "inherit" },
  );
}
