import { Float, Sparkles, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import { activeMonsterModelUrl, MONSTER_TRANSFORM } from "../game/monsters";
import type { GameState } from "../game/types";

function Enemy({ state, color }: { state: GameState; color: string }) {
  const group = useRef<Group>(null);
  const shielded = state.phase === "SHIELDED" || state.phase === "ARMOR_PHASE";
  const { scene } = useGLTF(activeMonsterModelUrl(state.round));
  const { scale, position } = MONSTER_TRANSFORM[state.round];

  useEffect(() => {
    scene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [scene]);

  useFrame((clock) => {
    if (!group.current) return;
    group.current.rotation.y = clock.clock.elapsedTime * 0.35;
    group.current.rotation.x = Math.sin(clock.clock.elapsedTime * 0.5) * 0.12;
  });

  return (
    <group position={[0, 0.4, 0]}>
      <Float speed={2} rotationIntensity={0.25} floatIntensity={0.4}>
        <group ref={group} scale={scale} position={position}>
          <primitive object={scene} />
        </group>
        {shielded && (
          <mesh>
            <sphereGeometry args={[1.65, 32, 32]} />
            <meshPhysicalMaterial
              color="#8cecff"
              transmission={0.75}
              transparent
              opacity={0.35}
              roughness={0.05}
              thickness={0.25}
            />
          </mesh>
        )}
      </Float>
      <Sparkles count={50} scale={4} size={2.2} speed={0.4} color={color} />
    </group>
  );
}

function Ground() {
  return (
    <group position={[0, -1.25, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[4.7, 5.2, 0.25, 64]} />
        <meshStandardMaterial color="#151021" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <ringGeometry args={[3.2, 3.28, 64]} />
        <meshBasicMaterial color="#7b5cff" />
      </mesh>
    </group>
  );
}

export function Arena({ state, enemyColor }: { state: GameState; enemyColor: string }) {
  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas className="h-full w-full" shadows camera={{ position: [0, 1.6, 6.2], fov: 45 }}>
        <color attach="background" args={["#08060f"]} />
        <fog attach="fog" args={["#08060f", 6, 13]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 3]} intensity={2.5} castShadow color="#ffd7b0" />
        <pointLight position={[-4, 1, 1]} intensity={16} color="#7755ff" distance={8} />
        <Enemy state={state} color={enemyColor} />
        <Ground />
      </Canvas>
    </div>
  );
}

useGLTF.preload(activeMonsterModelUrl("EMBERMAW"));
useGLTF.preload(activeMonsterModelUrl("SHARD_WARDEN"));
useGLTF.preload(activeMonsterModelUrl("HEXWYRM"));
