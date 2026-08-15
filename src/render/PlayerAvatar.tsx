import { Float, useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import { CHARACTER_ROSTER } from "../game/characters";
import type { CharacterId } from "../game/characters";

const SIDE_X = { left: -2.4, right: 2.4 } as const;
const SIDE_FACING = { left: Math.PI / 6, right: -Math.PI / 6 } as const;

export function PlayerAvatar({ characterId, side }: { characterId: CharacterId; side: "left" | "right" }) {
  const { scene } = useGLTF(CHARACTER_ROSTER[characterId].modelUrl);

  useEffect(() => {
    scene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [scene]);

  return (
    <group position={[SIDE_X[side], -1.25, 0.6]} rotation={[0, SIDE_FACING[side], 0]}>
      <Float speed={1.4} rotationIntensity={0} floatIntensity={0.25}>
        <primitive object={scene} />
      </Float>
    </group>
  );
}

useGLTF.preload(CHARACTER_ROSTER.ARCANE_SENTINEL.modelUrl);
useGLTF.preload(CHARACTER_ROSTER.STORMFORGED_VANGUARD.modelUrl);
