import { Float, Sparkles, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { MathUtils, Mesh, type Group, type Object3D } from "three";
import type { GameState } from "../game/types";

const SCENE_MESH_URL = "/models/spellbrawl-three-rooms.glb";
const ROOM_OFFSETS: Record<GameState["round"], number> = {
  EMBERMAW: 4.65,
  SHARD_WARDEN: 0,
  HEXWYRM: -4.65,
};

function Enemy({ state, color }: { state: GameState; color: string }) {
  const mesh = useRef<Mesh>(null);
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
            color={color}
            emissive={color}
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
      <Sparkles count={50} scale={4} size={2.2} speed={0.4} color={color} />
    </group>
  );
}

function SceneMesh({ round }: { round: GameState["round"] }) {
  const roomGroup = useRef<Group>(null);
  const { scene } = useGLTF(SCENE_MESH_URL);

  useEffect(() => {
    scene.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (!roomGroup.current) return;
    roomGroup.current.position.x = MathUtils.damp(
      roomGroup.current.position.x,
      ROOM_OFFSETS[round],
      3.5,
      delta,
    );
  });

  return (
    <group ref={roomGroup} position={[ROOM_OFFSETS[round], 0.5, 0]} scale={7.5}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(SCENE_MESH_URL);

export function Arena({ state, enemyColor }: { state: GameState; enemyColor: string }) {
  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [0, 3.8, 6.2], fov: 48 }}
      >
        <color attach="background" args={["#08060f"]} />
        <fog attach="fog" args={["#08060f", 8, 18]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 7, 4]} intensity={2.8} castShadow color="#ffd7b0" />
        <pointLight position={[-3, 2, 2]} intensity={18} color="#7755ff" distance={10} />
        <Suspense fallback={null}>
          <SceneMesh round={state.round} />
        </Suspense>
        <Enemy state={state} color={enemyColor} />
      </Canvas>
    </div>
  );
}
