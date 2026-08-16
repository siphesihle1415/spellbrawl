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
  { source: "Meshy_AI_Shardbound_Colossus_biped_Animation_Walking_withSkin.glb", output: "shard-warden-walking.glb" },
  { source: "Meshy_AI_Shardbound_Colossus_biped_Animation_Skill_03_withSkin.glb", output: "shard-warden-skill-03.glb" },
  { source: "Meshy_AI_Shardbound_Colossus_biped_Animation_Triple_Combo_Attack_withSkin.glb", output: "shard-warden-triple-combo-attack.glb" },
  { source: "Meshy_AI_Shardbound_Colossus_biped_Animation_Shot_in_the_Back_and_Fall_withSkin.glb", output: "shard-warden-shot-in-the-back-and-fall.glb" },
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
