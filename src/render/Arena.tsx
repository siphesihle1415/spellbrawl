import { Float, PointerLockControls, Sparkles, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { LoopOnce, MathUtils, Mesh, Vector3, type AnimationAction, type Group, type Object3D, type PointLight } from "three";
import { activeMonsterModelUrl, EMBERMAW_ANIMATED_TRANSFORM, EMBERMAW_ANIMATION_URLS, MONSTER_TRANSFORM } from "../game/monsters";
import type { GameState } from "../game/types";

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

function RoomCamera({ round, preview, resetKey }: { round: GameState["round"]; preview: boolean; resetKey: number }) {
  const { camera } = useThree();
  const light = useRef<PointLight>(null);
  const keys = useRef(new Set<string>());
  const direction = useRef(new Vector3());
  const right = useRef(new Vector3());

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

  useFrame((_, delta) => {
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
      camera.position.x = MathUtils.damp(camera.position.x, roomX, 3.5, delta);
      camera.position.y = MathUtils.damp(camera.position.y, roomY, 3.5, delta);
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

const EMBERMAW_CLIP = {
  walking: "Armature|walking_man|baselayer",
  zombieScream: "Armature|Zombie_Scream|baselayer",
  jumpingPunch: "Armature|Jumping_Punch|baselayer",
  fallingDown: "Armature|falling_down|baselayer",
} as const;

const CROSSFADE_SECONDS = 0.2;
const EMBERMAW_DEFEAT_HOLD_MS = 2500;

function crossfadeTo(
  actions: Record<string, AnimationAction | null>,
  name: string,
  options: { once: boolean; clampWhenFinished?: boolean },
) {
  const next = actions[name];
  if (!next) return;
  if (options.once) {
    next.setLoop(LoopOnce, 1);
    next.clampWhenFinished = options.clampWhenFinished ?? false;
  }
  Object.entries(actions).forEach(([otherName, action]) => {
    if (otherName !== name) action?.fadeOut(CROSSFADE_SECONDS);
  });
  next.reset().fadeIn(CROSSFADE_SECONDS).play();
}

function AnimatedEmbermaw({ state, color }: { state: GameState; color: string }) {
  const group = useRef<Group>(null);
  const walking = useGLTF(EMBERMAW_ANIMATION_URLS.walking);
  const zombieScream = useGLTF(EMBERMAW_ANIMATION_URLS.zombieScream);
  const jumpingPunch = useGLTF(EMBERMAW_ANIMATION_URLS.jumpingPunch);
  const fallingDown = useGLTF(EMBERMAW_ANIMATION_URLS.fallingDown);
  const clips = useMemo(
    () => [...walking.animations, ...zombieScream.animations, ...jumpingPunch.animations, ...fallingDown.animations],
    [walking.animations, zombieScream.animations, jumpingPunch.animations, fallingDown.animations],
  );
  const { actions, mixer } = useAnimations(clips, group);
  const { scale, position } = EMBERMAW_ANIMATED_TRANSFORM;
  const prev = useRef({ enemyHp: state.enemyHp, round: state.round, status: state.status });

  useEffect(() => {
    walking.scene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [walking.scene]);

  useEffect(() => {
    actions[EMBERMAW_CLIP.walking]?.reset().play();
  }, [actions]);

  useEffect(() => {
    const onFinished = (event: { action: AnimationAction }) => {
      if (event.action === actions[EMBERMAW_CLIP.zombieScream] || event.action === actions[EMBERMAW_CLIP.jumpingPunch]) {
        crossfadeTo(actions, EMBERMAW_CLIP.walking, { once: false });
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [actions, mixer]);

  useEffect(() => {
    const previous = prev.current;
    if (state.round === "EMBERMAW" && previous.round === "EMBERMAW" && state.enemyHp < previous.enemyHp && state.enemyHp > 0) {
      crossfadeTo(actions, EMBERMAW_CLIP.zombieScream, { once: true });
    }
    if (previous.round === "EMBERMAW" && state.round !== "EMBERMAW") {
      crossfadeTo(actions, EMBERMAW_CLIP.fallingDown, { once: true, clampWhenFinished: true });
    }
    if (state.round === "EMBERMAW" && state.status === "DEFEAT" && previous.status !== "DEFEAT") {
      crossfadeTo(actions, EMBERMAW_CLIP.jumpingPunch, { once: true });
    }
    prev.current = { enemyHp: state.enemyHp, round: state.round, status: state.status };
  }, [state.enemyHp, state.round, state.status, actions]);

  return (
    <group position={[ROOM_CAMERA_X.EMBERMAW, 0.4, MONSTER_Z]}>
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.3}>
        <group ref={group} scale={scale} position={position}>
          <primitive object={walking.scene} />
        </group>
      </Float>
      <Sparkles count={25} position={[0, 0.35, 0]} scale={0.9} size={1.2} speed={0.4} color={color} />
    </group>
  );
}

useGLTF.preload(SCENE_MESH_URL);
useGLTF.preload(activeMonsterModelUrl("EMBERMAW"));
useGLTF.preload(activeMonsterModelUrl("SHARD_WARDEN"));
useGLTF.preload(activeMonsterModelUrl("HEXWYRM"));
useGLTF.preload(EMBERMAW_ANIMATION_URLS.walking);
useGLTF.preload(EMBERMAW_ANIMATION_URLS.zombieScream);
useGLTF.preload(EMBERMAW_ANIMATION_URLS.jumpingPunch);
useGLTF.preload(EMBERMAW_ANIMATION_URLS.fallingDown);

export function Arena({ state, enemyColor, preview = false, resetKey = 0 }: { state: GameState; enemyColor: string; preview?: boolean; resetKey?: number }) {
  const roomX = ROOM_CAMERA_X[state.round];
  const [visibleRound, setVisibleRound] = useState(state.round);

  useEffect(() => {
    if (visibleRound === state.round) return;
    if (visibleRound === "EMBERMAW") {
      const timer = setTimeout(() => setVisibleRound(state.round), EMBERMAW_DEFEAT_HOLD_MS);
      return () => clearTimeout(timer);
    }
    setVisibleRound(state.round);
  }, [state.round, visibleRound]);

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
          <SceneMesh />
          {visibleRound === "EMBERMAW" ? (
            <AnimatedEmbermaw state={state} color={enemyColor} />
          ) : (
            <Enemy state={state} color={enemyColor} />
          )}
        </Suspense>
        <RoomCamera round={state.round} preview={preview} resetKey={resetKey} />
        {preview && <PointerLockControls selector="#explore-scene" />}
      </Canvas>
    </div>
  );
}
