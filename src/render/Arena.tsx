import { Float, PointerLockControls, Sparkles, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { AdditiveBlending, MathUtils, Mesh, Vector3, type Group, type Object3D, type PointLight } from "three";
import { activeMonsterModelUrl, MONSTER_TRANSFORM } from "../game/monsters";
import type { CombatEffect, GameState } from "../game/types";

const SCENE_MESH_URL = "/models/spellbrawl-three-rooms-open-lighting.glb";
const SCENE_SCALE = 10.5;
const ROOM_CAMERA_X: Record<GameState["round"], number> = {
  EMBERMAW: 0,
  SHARD_WARDEN: 1.4,
  HEXWYRM: -1.4,
};
const ROOM_CAMERA_Y: Record<GameState["round"], number> = {
  EMBERMAW: 0.9,
  SHARD_WARDEN: 0.78,
  HEXWYRM: 0.78,
};
const CAMERA_SPAWN_Z = 0.35;
const MONSTER_Z = -0.85;
const PREVIEW_SPEED = 0.7;
const PREVIEW_BOUNDS = { minX: -2, maxX: 2, minZ: -1.15, maxZ: 1.15 };
export const criticalAssetCount = 4;

function AssetReadiness({ assetUrl, onAssetLoaded }: { assetUrl: string; onAssetLoaded?: (assetUrl: string) => void }) {
  const asset = useGLTF(assetUrl);

  useEffect(() => onAssetLoaded?.(assetUrl), [asset, assetUrl, onAssetLoaded]);

  return null;
}

function SceneMesh() {
  const { scene } = useGLTF(SCENE_MESH_URL);

  useEffect(() => {
    scene.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <group position={[0, 0.5, 0]} scale={SCENE_SCALE}>
      <primitive object={scene} />
    </group>
  );
}

function RoomCamera({ round, preview, resetKey, effect }: { round: GameState["round"]; preview: boolean; resetKey: number; effect?: CombatEffect }) {
  const { camera } = useThree();
  const light = useRef<PointLight>(null);
  const keys = useRef(new Set<string>());
  const direction = useRef(new Vector3());
  const right = useRef(new Vector3());
  const shakeUntil = useRef(0);

  useEffect(() => {
    if (effect?.kind === "PLAYER_HIT") shakeUntil.current = performance.now() + 550;
    if (effect?.kind === "ENEMY_EMERGE") shakeUntil.current = performance.now() + 1_250;
  }, [effect?.id, effect?.kind]);

  useEffect(() => {
    camera.position.x = ROOM_CAMERA_X[round];
    camera.position.y = ROOM_CAMERA_Y[round];
    camera.position.z = CAMERA_SPAWN_Z;
    camera.lookAt(ROOM_CAMERA_X[round], 0.9, MONSTER_Z);
  }, [camera, resetKey, round]);

  useEffect(() => {
    if (!preview) return;
    const down = (event: KeyboardEvent) => keys.current.add(event.code);
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current.clear();
    };
  }, [preview]);

  useFrame(({ clock }, delta) => {
    const roomX = ROOM_CAMERA_X[round];
    const roomY = ROOM_CAMERA_Y[round];
    if (preview) {
      camera.getWorldDirection(direction.current);
      direction.current.y = 0;
      direction.current.normalize();
      right.current.crossVectors(direction.current, camera.up).normalize();
      const distance = PREVIEW_SPEED * delta;
      if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) camera.position.addScaledVector(direction.current, distance);
      if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) camera.position.addScaledVector(direction.current, -distance);
      if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) camera.position.addScaledVector(right.current, -distance);
      if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) camera.position.addScaledVector(right.current, distance);
      camera.position.x = MathUtils.clamp(camera.position.x, PREVIEW_BOUNDS.minX, PREVIEW_BOUNDS.maxX);
      camera.position.y = roomY;
      camera.position.z = MathUtils.clamp(camera.position.z, PREVIEW_BOUNDS.minZ, PREVIEW_BOUNDS.maxZ);
    } else {
      const idleSway = Math.sin(clock.elapsedTime * 0.42) * 0.018;
      const shaking = performance.now() < shakeUntil.current;
      const magnitude = effect?.kind === "ENEMY_EMERGE" ? 0.026 : 0.014;
      const shakeX = shaking ? Math.sin(clock.elapsedTime * 71) * magnitude : 0;
      const shakeY = shaking ? Math.cos(clock.elapsedTime * 83) * magnitude * 0.7 : 0;
      camera.position.x = MathUtils.damp(camera.position.x, roomX + idleSway + shakeX, 8, delta);
      camera.position.y = MathUtils.damp(camera.position.y, roomY, 3.5, delta);
      if (shaking) camera.position.y += shakeY;
      camera.position.z = MathUtils.damp(camera.position.z, CAMERA_SPAWN_Z, 3.5, delta);
      camera.lookAt(camera.position.x, 0.9, MONSTER_Z);
    }

    if (light.current) {
      light.current.position.x = MathUtils.damp(light.current.position.x, camera.position.x + 1.2, 3.5, delta);
      light.current.position.z = camera.position.z + 0.5;
    }
  });

  return (
    <pointLight
      ref={light}
      position={[ROOM_CAMERA_X[round] + 1.2, 1.8, CAMERA_SPAWN_Z + 0.5]}
      intensity={18}
      color="#7755ff"
      distance={14}
    />
  );
}

function PlayerPositions({ roomX, shielded }: { roomX: number; shielded: boolean }) {
  return (
    <group>
      {([-0.52, 0.52] as const).map((offset, index) => (
        <group key={offset} position={[roomX + offset, 0.28, -0.62]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.16, 32]} />
            <meshBasicMaterial color={index === 0 ? "#ff7558" : "#51cfff"} transparent opacity={0.75} blending={AdditiveBlending} />
          </mesh>
          {shielded && (
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[0.25, 24, 24]} />
              <meshPhysicalMaterial color="#54ff9b" transparent opacity={0.14} transmission={0.8} roughness={0.05} />
            </mesh>
          )}
          <pointLight color={index === 0 ? "#ff7558" : "#51cfff"} intensity={shielded ? 5 : 2} distance={1.2} />
        </group>
      ))}
    </group>
  );
}

function ProjectileEffect({ roomX, effect }: { roomX: number; effect: CombatEffect }) {
  const projectile = useRef<Mesh>(null);
  const started = useRef(performance.now());
  const side = effect.playerId === "PLAYER_B" ? 0.52 : -0.52;
  useFrame(() => {
    if (!projectile.current) return;
    const progress = Math.min(1, (performance.now() - started.current) / 650);
    projectile.current.position.z = MathUtils.lerp(-0.56, MONSTER_Z, progress);
    projectile.current.position.x = MathUtils.lerp(roomX + side, roomX, progress);
    projectile.current.scale.setScalar(progress < 0.86 ? 1 : 1 + (progress - 0.86) * 9);
    if (progress === 1) projectile.current.visible = false;
  });
  return (
    <group>
      <mesh ref={projectile} position={[roomX + side, 0.58, -0.56]}>
        <sphereGeometry args={[0.075, 18, 18]} />
        <meshBasicMaterial color="#ff6b24" blending={AdditiveBlending} />
        <pointLight color="#ff4b18" intensity={12} distance={2} />
      </mesh>
      <Sparkles count={38} position={[roomX, 0.58, -0.72]} scale={[0.7, 0.35, 0.45]} size={2.5} speed={2} color="#ff8a38" />
    </group>
  );
}

function PulseEffect({ roomX, effect }: { roomX: number; effect: CombatEffect }) {
  const group = useRef<Group>(null);
  const started = useRef(performance.now());
  useFrame(() => {
    if (!group.current) return;
    const progress = Math.min(1, (performance.now() - started.current) / 900);
    const scale = 0.3 + progress * 1.4;
    group.current.scale.setScalar(scale);
    group.current.rotation.z += 0.025;
    if (progress === 1) group.current.visible = false;
  });
  const starfall = effect.kind === "STARFALL";
  const armor = effect.kind === "ARMOR_BREAK";
  const color = starfall ? "#f055ff" : armor ? "#ffad27" : "#55ff9a";
  return (
    <group ref={group} position={[roomX, starfall ? 0.85 : 0.55, MONSTER_Z]}>
      <mesh>
        <torusGeometry args={[0.22, 0.018, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} blending={AdditiveBlending} />
      </mesh>
      <Sparkles count={starfall ? 90 : 45} scale={starfall ? 1.5 : 0.8} size={starfall ? 4 : 2} speed={2.5} color={color} />
      <pointLight color={color} intensity={starfall ? 24 : 12} distance={4} />
    </group>
  );
}

function SpellEffect({ roomX, effect }: { roomX: number; effect: CombatEffect }) {
  if (effect.kind === "FIREBOLT") return <ProjectileEffect roomX={roomX} effect={effect} />;
  if (effect.kind === "STARFALL" || effect.kind === "ARMOR_BREAK" || effect.kind === "BARRIER") {
    return <PulseEffect roomX={roomX} effect={effect} />;
  }
  return null;
}

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
    <group position={[ROOM_CAMERA_X[state.round], 0.4, MONSTER_Z]}>
      <Float speed={2} rotationIntensity={0.25} floatIntensity={0.4}>
        <group ref={group} scale={scale} position={position}>
          <primitive object={scene} />
        </group>
        {shielded && (
          <mesh position={[0, 0.34, 0]}>
            <sphereGeometry args={[0.4, 32, 32]} />
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
      <Sparkles count={25} position={[0, 0.35, 0]} scale={0.9} size={1.2} speed={0.4} color={color} />
    </group>
  );
}

useGLTF.preload(SCENE_MESH_URL);
useGLTF.preload(activeMonsterModelUrl("EMBERMAW"));
useGLTF.preload(activeMonsterModelUrl("SHARD_WARDEN"));
useGLTF.preload(activeMonsterModelUrl("HEXWYRM"));

export function Arena({ state, enemyColor, now = 0, preview = false, resetKey = 0, onAssetLoaded }: { state: GameState; enemyColor: string; now?: number; preview?: boolean; resetKey?: number; onAssetLoaded?: (assetUrl: string) => void }) {
  const roomX = ROOM_CAMERA_X[state.round];
  const shielded = state.status === "PLAYING" && Object.values(state.players).some((player) => player.shieldedUntil >= now);

  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [roomX, ROOM_CAMERA_Y[state.round], CAMERA_SPAWN_Z], fov: 68 }}
      >
        <color attach="background" args={["#08060f"]} />
        <fog attach="fog" args={["#08060f", 10, 24]} />
        <ambientLight intensity={1} />
        <directionalLight position={[4, 7, 4]} intensity={2.8} castShadow color="#ffd7b0" />
        <Suspense fallback={null}>
          <AssetReadiness assetUrl={SCENE_MESH_URL} onAssetLoaded={onAssetLoaded} />
        </Suspense>
        <Suspense fallback={null}>
          <AssetReadiness assetUrl={activeMonsterModelUrl("EMBERMAW")} onAssetLoaded={onAssetLoaded} />
        </Suspense>
        <Suspense fallback={null}>
          <AssetReadiness assetUrl={activeMonsterModelUrl("SHARD_WARDEN")} onAssetLoaded={onAssetLoaded} />
        </Suspense>
        <Suspense fallback={null}>
          <AssetReadiness assetUrl={activeMonsterModelUrl("HEXWYRM")} onAssetLoaded={onAssetLoaded} />
        </Suspense>
        <Suspense fallback={null}>
          <SceneMesh />
          <Enemy state={state} color={enemyColor} />
          <PlayerPositions roomX={roomX} shielded={shielded} />
          {state.effect && <SpellEffect key={state.effect.id} roomX={roomX} effect={state.effect} />}
        </Suspense>
        <RoomCamera round={state.round} preview={preview} resetKey={resetKey} effect={state.effect} />
        {preview && <PointerLockControls selector="#explore-scene" />}
      </Canvas>
    </div>
  );
}
