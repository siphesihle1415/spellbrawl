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
  { source: "Meshy_AI_Voidwyrm_Ascendant_biped_Animation_Walking_withSkin.glb", output: "hexwyrm-walking.glb" },
  { source: "Meshy_AI_Voidwyrm_Ascendant_biped_Animation_Zombie_Scream_withSkin.glb", output: "hexwyrm-zombie-scream.glb" },
  { source: "Meshy_AI_Voidwyrm_Ascendant_biped_Animation_Crouch_Charge_and_Throw_withSkin.glb", output: "hexwyrm-crouch-charge-and-throw.glb" },
  { source: "Meshy_AI_Voidwyrm_Ascendant_biped_Animation_Shot_and_Fall_Backward_withSkin.glb", output: "hexwyrm-shot-and-fall-backward.glb" },
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
