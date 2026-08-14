import { Environment, Float, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { encounters } from "../game/config";
import type { GameState } from "../game/types";

function Enemy({ state }: { state: GameState }) {
  const mesh = useRef<Mesh>(null);
  const encounter = encounters[state.round];
  const shielded = state.phase === "SHIELDED" || state.phase === "ARMOR_PHASE";

  useFrame((clock) => {
    if (!mesh.current) return;
    mesh.current.rotation.y = clock.clock.elapsedTime * 0.35;
    mesh.current.rotation.x = Math.sin(clock.clock.elapsedTime * 0.5) * 0.12;
  });

  return (
    <group position={[0, 0.4, 0]}>
      <Float speed={2} rotationIntensity={0.25} floatIntensity={0.4}>
        <mesh ref={mesh} castShadow>
          {state.round === "EMBERMAW" && <icosahedronGeometry args={[1.15, 1]} />}
          {state.round === "SHARD_WARDEN" && <octahedronGeometry args={[1.25, 0]} />}
          {state.round === "HEXWYRM" && <torusKnotGeometry args={[0.8, 0.28, 96, 12]} />}
          <meshStandardMaterial
            color={encounter.color}
            emissive={encounter.color}
            emissiveIntensity={state.status === "VICTORY" ? 2.5 : 0.7}
            roughness={0.32}
            metalness={0.35}
          />
        </mesh>
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
      <Sparkles count={50} scale={4} size={2.2} speed={0.4} color={encounter.color} />
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

export function Arena({ state }: { state: GameState }) {
  return (
    <Canvas shadows camera={{ position: [0, 1.6, 6.2], fov: 45 }}>
      <color attach="background" args={["#08060f"]} />
      <fog attach="fog" args={["#08060f", 6, 13]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 3]} intensity={2.5} castShadow color="#ffd7b0" />
      <pointLight position={[-4, 1, 1]} intensity={16} color="#7755ff" distance={8} />
      <Enemy state={state} />
      <Ground />
      <Environment preset="night" />
    </Canvas>
  );
}
