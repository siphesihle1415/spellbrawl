import { Float, PointerLockControls, Sparkles, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, BackSide, LoopOnce, MathUtils, Mesh, Vector3, type AnimationAction, type AnimationClip, type Group, type Object3D, type PointLight } from "three";
import { activeMonsterModelUrl, EMBERMAW_ANIMATED_TRANSFORM, EMBERMAW_ANIMATION_URLS, HEXWYRM_ANIMATED_TRANSFORM, HEXWYRM_ANIMATION_URLS, MONSTER_TRANSFORM, ROUND_ANIMATION_URLS, SHARD_WARDEN_ANIMATED_TRANSFORM, SHARD_WARDEN_ANIMATION_URLS } from "../game/monsters";
import type { CombatEffect, GameState, PlayerId } from "../game/types";
import { FireballEffect } from "./FireballEffect";
import { playerCameraX } from "./playerCamera";

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

function RoomCamera({ round, playerId, preview, resetKey, effect }: { round: GameState["round"]; playerId: PlayerId; preview: boolean; resetKey: number; effect?: CombatEffect }) {
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
    camera.position.x = playerCameraX(ROOM_CAMERA_X[round], playerId, preview);
    camera.position.y = ROOM_CAMERA_Y[round];
    camera.position.z = CAMERA_SPAWN_Z;
    camera.lookAt(ROOM_CAMERA_X[round], 0.9, MONSTER_Z);
  }, [camera, playerId, preview, resetKey, round]);

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
    const playerX = playerCameraX(roomX, playerId, false);
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
      camera.position.x = MathUtils.damp(camera.position.x, playerX + idleSway + shakeX, 8, delta);
      camera.position.y = MathUtils.damp(camera.position.y, roomY, 3.5, delta);
      if (shaking) camera.position.y += shakeY;
      camera.position.z = MathUtils.damp(camera.position.z, CAMERA_SPAWN_Z, 3.5, delta);
      camera.lookAt(roomX, 0.9, MONSTER_Z);
    }

    if (light.current) {
      light.current.position.x = MathUtils.damp(light.current.position.x, camera.position.x + 1.2, 3.5, delta);
      light.current.position.z = camera.position.z + 0.5;
    }
  });

  return (
    <pointLight
      ref={light}
      position={[playerCameraX(ROOM_CAMERA_X[round], playerId, preview) + 1.2, 1.8, CAMERA_SPAWN_Z + 0.5]}
      intensity={18}
      color="#7755ff"
      distance={14}
    />
  );
}

function CameraShield() {
  const { camera } = useThree();
  const shield = useRef<Group>(null);
  const forward = useRef(new Vector3());

  useFrame(({ clock }) => {
    if (!shield.current) return;
    camera.getWorldDirection(forward.current);
    shield.current.position.copy(camera.position).addScaledVector(forward.current, 0.04);
    const pulse = 1 + Math.sin(clock.elapsedTime * 4.8) * 0.025;
    shield.current.scale.setScalar(pulse);
    shield.current.rotation.y += 0.003;
    shield.current.rotation.z -= 0.002;
  });

  return (
    <group ref={shield} renderOrder={40}>
      <mesh>
        <sphereGeometry args={[0.62, 40, 40]} />
        <meshBasicMaterial color="#86ffad" transparent opacity={0.14} blending={AdditiveBlending} depthTest={false} depthWrite={false} side={BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.615, 24, 24]} />
        <meshBasicMaterial color="#b8ffd0" wireframe transparent opacity={0.035} blending={AdditiveBlending} depthTest={false} depthWrite={false} side={BackSide} />
      </mesh>
      <pointLight color="#72ff9f" intensity={3} distance={2.2} />
    </group>
  );
}

function PlayerPositions({ roomX }: { roomX: number }) {
  return (
    <group>
      {([-0.48, 0.48] as const).map((offset, index) => (
        <group key={offset} position={[roomX + offset, 0.28, -0.62]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.16, 32]} />
            <meshBasicMaterial color={index === 0 ? "#ff7558" : "#51cfff"} transparent opacity={0.75} blending={AdditiveBlending} />
          </mesh>
          <pointLight color={index === 0 ? "#ff7558" : "#51cfff"} intensity={2} distance={1.2} />
        </group>
      ))}
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

function SpellEffect({ roomX, round, effect }: { roomX: number; round: GameState["round"]; effect: CombatEffect }) {
  if (effect.kind === "FIREBOLT") {
    const caster = effect.playerId ?? "PLAYER_A";
    return (
      <FireballEffect
        source={[playerCameraX(roomX, caster, false), ROOM_CAMERA_Y[round] - 0.12, CAMERA_SPAWN_Z - 0.2]}
        target={[roomX, 0.62, MONSTER_Z + 0.05]}
      />
    );
  }
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

const EMBERMAW_CLIP = {
  walking: "Armature|walking_man|baselayer",
  zombieScream: "Armature|Zombie_Scream|baselayer",
  jumpingPunch: "Armature|Jumping_Punch|baselayer",
  fallingDown: "Armature|falling_down|baselayer",
} as const;

const SHARD_WARDEN_CLIP = {
  walking: "Armature|walking_man|baselayer",
  skill03: "Armature|Skill_03|baselayer",
  tripleComboAttack: "Armature|Triple_Combo_Attack|baselayer",
  shotInTheBackAndFall: "Armature|Shot_in_the_Back_and_Fall|baselayer",
} as const;

const HEXWYRM_CLIP = {
  walking: "Armature|walking_man|baselayer",
  zombieScream: "Armature|Zombie_Scream|baselayer",
  crouchChargeAndThrow: "Armature|Crouch_Charge_and_Throw|baselayer",
  shotAndFallBackward: "Armature|Shot_and_Fall_Backward|baselayer",
} as const;

const CROSSFADE_SECONDS = 0.2;
const EMBERMAW_DEFEAT_HOLD_MS = 2500;
const SHARD_WARDEN_DEFEAT_HOLD_MS = 5500;
const ROOT_BONE_NAME = "Hips";
const EMBERMAW_REST_OFFSET_Z = 0.45;
const EMBERMAW_REST_Z = MONSTER_Z + EMBERMAW_REST_OFFSET_Z;
const EMBERMAW_ENTRANCE_START_OFFSET_Z = -2.5;
const EMBERMAW_ENTRANCE_START_Z = EMBERMAW_REST_Z + EMBERMAW_ENTRANCE_START_OFFSET_Z;
const EMBERMAW_ENTRANCE_DURATION_MS = 3000;
const SHARD_WARDEN_REST_OFFSET_Z = 0.45;
const SHARD_WARDEN_REST_Z = MONSTER_Z + SHARD_WARDEN_REST_OFFSET_Z;
const SHARD_WARDEN_ENTRANCE_START_OFFSET_Z = -2.5;
const SHARD_WARDEN_ENTRANCE_START_Z = SHARD_WARDEN_REST_Z + SHARD_WARDEN_ENTRANCE_START_OFFSET_Z;
const SHARD_WARDEN_ENTRANCE_DURATION_MS = 3000;
const HEXWYRM_REST_OFFSET_Z = 0.7;
const HEXWYRM_REST_Z = MONSTER_Z + HEXWYRM_REST_OFFSET_Z;
const HEXWYRM_ENTRANCE_START_OFFSET_Z = -2.5;
const HEXWYRM_ENTRANCE_START_Z = HEXWYRM_REST_Z + HEXWYRM_ENTRANCE_START_OFFSET_Z;
const HEXWYRM_ENTRANCE_DURATION_MS = 3000;
// Crouch_Charge_and_Throw runs 7.73s, longer than the 7s attack cadence, which would otherwise
// force the next windup to interrupt it before it finishes and returns to walking. Playing it
// back 1.25x speed keeps it under the cadence with room to spare (see ATTACK_IMPACT_DELAY_MS in
// game/monsters.ts, which is scaled down to match).
const HEXWYRM_ATTACK_TIME_SCALE = 1.25;

// Reaction clips (e.g. Jumping_Punch) bake forward lunge into the Hips root bone, which would
// otherwise shove the whole rig toward the camera each time they play. Pin X/Z to the first
// frame so the character stays planted where we've positioned it; vertical motion (crouch/bob)
// is left untouched.
function stripHorizontalRootMotion(clip: AnimationClip): AnimationClip {
  const track = clip.tracks.find((candidate) => candidate.name === `${ROOT_BONE_NAME}.position`);
  if (!track) return clip;
  const values = track.values;
  const x0 = values[0];
  const z0 = values[2];
  for (let i = 0; i < values.length; i += 3) {
    values[i] = x0;
    values[i + 2] = z0;
  }
  return clip;
}

function crossfadeTo(
  actions: Record<string, AnimationAction | null>,
  name: string,
  options: { once: boolean; clampWhenFinished?: boolean; timeScale?: number },
) {
  const next = actions[name];
  if (!next) return;
  if (options.once) {
    next.setLoop(LoopOnce, 1);
    next.clampWhenFinished = options.clampWhenFinished ?? false;
  }
  next.timeScale = options.timeScale ?? 1;
  Object.entries(actions).forEach(([otherName, action]) => {
    if (otherName !== name) action?.fadeOut(CROSSFADE_SECONDS);
  });
  next.reset().fadeIn(CROSSFADE_SECONDS).play();
}

function AnimatedEmbermaw({ state, color }: { state: GameState; color: string }) {
  const group = useRef<Group>(null);
  const entranceGroup = useRef<Group>(null);
  const entranceStartAt = useRef<number | null>(null);
  const walking = useGLTF(EMBERMAW_ANIMATION_URLS.walking);
  const zombieScream = useGLTF(EMBERMAW_ANIMATION_URLS.zombieScream);
  const jumpingPunch = useGLTF(EMBERMAW_ANIMATION_URLS.jumpingPunch);
  const fallingDown = useGLTF(EMBERMAW_ANIMATION_URLS.fallingDown);
  const clips = useMemo(
    () => [...walking.animations, ...zombieScream.animations, ...jumpingPunch.animations, ...fallingDown.animations].map(stripHorizontalRootMotion),
    [walking.animations, zombieScream.animations, jumpingPunch.animations, fallingDown.animations],
  );
  const { actions, mixer } = useAnimations(clips, group);
  const { scale, position } = EMBERMAW_ANIMATED_TRANSFORM;
  const prev = useRef({ enemyHp: state.enemyHp, round: state.round, enemyAttackCount: state.enemyAttackCount, status: state.status });

  useEffect(() => {
    walking.scene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [walking.scene]);

  useEffect(() => {
    actions[EMBERMAW_CLIP.walking]?.reset().play();
  }, [actions]);

  // Embermaw is the only monster that can mount while still "LOBBY" (idle, waiting for the
  // fight to start), which is why it normally waits for the LOBBY -> PLAYING edge below instead
  // of starting on mount like Shard Warden/Hexwyrm do. But `START` resets straight to "PLAYING"
  // without passing through "LOBBY" (see engine.ts), and finishing a full run unmounts and
  // remounts this component (round leaves EMBERMAW and comes back) — so on a replay it can also
  // mount with status already "PLAYING", where that edge never fires. Cover that case here.
  useEffect(() => {
    if (state.status === "PLAYING") {
      entranceStartAt.current = performance.now();
    }
  }, []);

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
    if (state.round === "EMBERMAW" && previous.round === "EMBERMAW" && state.enemyAttackCount > previous.enemyAttackCount) {
      crossfadeTo(actions, EMBERMAW_CLIP.jumpingPunch, { once: true });
    }
    if (previous.status === "LOBBY" && state.status === "PLAYING") {
      entranceStartAt.current = performance.now();
    }
    if (state.status === "LOBBY") {
      entranceStartAt.current = null;
    }
    prev.current = { enemyHp: state.enemyHp, round: state.round, enemyAttackCount: state.enemyAttackCount, status: state.status };
  }, [state.enemyHp, state.round, state.enemyAttackCount, state.status, actions]);

  useFrame(() => {
    if (!entranceGroup.current) return;
    if (entranceStartAt.current === null) {
      entranceGroup.current.position.z = EMBERMAW_ENTRANCE_START_Z;
      return;
    }
    const elapsed = performance.now() - entranceStartAt.current;
    const t = Math.min(1, elapsed / EMBERMAW_ENTRANCE_DURATION_MS);
    entranceGroup.current.position.z = MathUtils.lerp(EMBERMAW_ENTRANCE_START_Z, EMBERMAW_REST_Z, t);
  });

  return (
    <group ref={entranceGroup} position={[ROOM_CAMERA_X.EMBERMAW, 0.4, EMBERMAW_ENTRANCE_START_Z]}>
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.3}>
        <group ref={group} scale={scale} position={position}>
          <primitive object={walking.scene} />
        </group>
      </Float>
      <Sparkles count={25} position={[0, 0.35, 0]} scale={0.9} size={1.2} speed={0.4} color={color} />
    </group>
  );
}

function AnimatedShardWarden({ state, color }: { state: GameState; color: string }) {
  const group = useRef<Group>(null);
  const entranceGroup = useRef<Group>(null);
  const entranceStartAt = useRef<number | null>(null);
  const shielded = state.phase === "SHIELDED" || state.phase === "ARMOR_PHASE";
  const walking = useGLTF(SHARD_WARDEN_ANIMATION_URLS.walking);
  const skill03 = useGLTF(SHARD_WARDEN_ANIMATION_URLS.skill03);
  const tripleComboAttack = useGLTF(SHARD_WARDEN_ANIMATION_URLS.tripleComboAttack);
  const shotInTheBackAndFall = useGLTF(SHARD_WARDEN_ANIMATION_URLS.shotInTheBackAndFall);
  const clips = useMemo(
    () => [...walking.animations, ...skill03.animations, ...tripleComboAttack.animations, ...shotInTheBackAndFall.animations].map(stripHorizontalRootMotion),
    [walking.animations, skill03.animations, tripleComboAttack.animations, shotInTheBackAndFall.animations],
  );
  const { actions, mixer } = useAnimations(clips, group);
  const { scale, position } = SHARD_WARDEN_ANIMATED_TRANSFORM;
  const prev = useRef({ enemyHp: state.enemyHp, round: state.round, enemyAttackCount: state.enemyAttackCount });

  useEffect(() => {
    walking.scene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [walking.scene]);

  useEffect(() => {
    actions[SHARD_WARDEN_CLIP.walking]?.reset().play();
  }, [actions]);

  // AnimatedShardWarden only mounts once `status` is already "PLAYING" (Shard Warden only
  // appears mid-fight, after Embermaw is defeated), so the "LOBBY -> PLAYING" edge AnimatedEmbermaw
  // watches for has already happened by the time this component exists. Every path back to
  // "LOBBY" resets `round` to "EMBERMAW" (see initialGameState in engine.ts), so this component
  // fully unmounts on any retry — meaning "start the entrance once, on mount" already reproduces
  // the same replay-on-retry behavior, without needing to watch `status` at all.
  useEffect(() => {
    entranceStartAt.current = performance.now();
  }, []);

  useEffect(() => {
    const onFinished = (event: { action: AnimationAction }) => {
      if (event.action === actions[SHARD_WARDEN_CLIP.skill03] || event.action === actions[SHARD_WARDEN_CLIP.tripleComboAttack]) {
        crossfadeTo(actions, SHARD_WARDEN_CLIP.walking, { once: false });
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [actions, mixer]);

  useEffect(() => {
    const previous = prev.current;
    if (state.round === "SHARD_WARDEN" && previous.round === "SHARD_WARDEN" && state.enemyHp < previous.enemyHp && state.enemyHp > 0) {
      crossfadeTo(actions, SHARD_WARDEN_CLIP.skill03, { once: true });
    }
    if (previous.round === "SHARD_WARDEN" && state.round !== "SHARD_WARDEN") {
      crossfadeTo(actions, SHARD_WARDEN_CLIP.shotInTheBackAndFall, { once: true, clampWhenFinished: true });
    }
    if (state.round === "SHARD_WARDEN" && previous.round === "SHARD_WARDEN" && state.enemyAttackCount > previous.enemyAttackCount) {
      crossfadeTo(actions, SHARD_WARDEN_CLIP.tripleComboAttack, { once: true });
    }
    prev.current = { enemyHp: state.enemyHp, round: state.round, enemyAttackCount: state.enemyAttackCount };
  }, [state.enemyHp, state.round, state.enemyAttackCount, actions]);

  useFrame(() => {
    if (!entranceGroup.current) return;
    if (entranceStartAt.current === null) {
      entranceGroup.current.position.z = SHARD_WARDEN_ENTRANCE_START_Z;
      return;
    }
    const elapsed = performance.now() - entranceStartAt.current;
    const t = Math.min(1, elapsed / SHARD_WARDEN_ENTRANCE_DURATION_MS);
    entranceGroup.current.position.z = MathUtils.lerp(SHARD_WARDEN_ENTRANCE_START_Z, SHARD_WARDEN_REST_Z, t);
  });

  return (
    <group ref={entranceGroup} position={[ROOM_CAMERA_X.SHARD_WARDEN, 0.4, SHARD_WARDEN_ENTRANCE_START_Z]}>
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.3}>
        <group ref={group} scale={scale} position={position}>
          <primitive object={walking.scene} />
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

function AnimatedHexwyrm({ state, color }: { state: GameState; color: string }) {
  const group = useRef<Group>(null);
  const entranceGroup = useRef<Group>(null);
  const entranceStartAt = useRef<number | null>(null);
  const shielded = state.phase === "SHIELDED" || state.phase === "ARMOR_PHASE";
  const walking = useGLTF(HEXWYRM_ANIMATION_URLS.walking);
  const zombieScream = useGLTF(HEXWYRM_ANIMATION_URLS.zombieScream);
  const crouchChargeAndThrow = useGLTF(HEXWYRM_ANIMATION_URLS.crouchChargeAndThrow);
  const shotAndFallBackward = useGLTF(HEXWYRM_ANIMATION_URLS.shotAndFallBackward);
  const clips = useMemo(
    () => [...walking.animations, ...zombieScream.animations, ...crouchChargeAndThrow.animations, ...shotAndFallBackward.animations].map(stripHorizontalRootMotion),
    [walking.animations, zombieScream.animations, crouchChargeAndThrow.animations, shotAndFallBackward.animations],
  );
  const { actions, mixer } = useAnimations(clips, group);
  const { scale, position } = HEXWYRM_ANIMATED_TRANSFORM;
  const prev = useRef({ armorBreaks: state.armorBreaks, enemyAttackCount: state.enemyAttackCount, status: state.status });

  useEffect(() => {
    walking.scene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [walking.scene]);

  useEffect(() => {
    actions[HEXWYRM_CLIP.walking]?.reset().play();
  }, [actions]);

  // AnimatedHexwyrm only mounts once `status` is already "PLAYING" (Hexwyrm only appears
  // mid-fight, after Shard Warden is defeated), so start the entrance once, on mount, the
  // same way AnimatedShardWarden does.
  useEffect(() => {
    entranceStartAt.current = performance.now();
  }, []);

  useEffect(() => {
    const onFinished = (event: { action: AnimationAction }) => {
      if (event.action === actions[HEXWYRM_CLIP.zombieScream] || event.action === actions[HEXWYRM_CLIP.crouchChargeAndThrow]) {
        crossfadeTo(actions, HEXWYRM_CLIP.walking, { once: false });
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [actions, mixer]);

  // Hexwyrm's Firebolt only lands once, for full damage, in the FUSION_FINISHER step (see
  // applyDamage in engine.ts) — the enemyHp step down every other monster reacts to never
  // happens mid-fight here. armorBreaks landing is this boss's actual "took a hit" moment, and
  // status flipping to VICTORY (its round never changes away, unlike the earlier two rounds) is
  // its defeat moment.
  useEffect(() => {
    const previous = prev.current;
    if (state.round === "HEXWYRM" && state.armorBreaks > previous.armorBreaks) {
      crossfadeTo(actions, HEXWYRM_CLIP.zombieScream, { once: true });
    }
    if (previous.status !== "VICTORY" && state.status === "VICTORY") {
      crossfadeTo(actions, HEXWYRM_CLIP.shotAndFallBackward, { once: true, clampWhenFinished: true });
    }
    if (state.round === "HEXWYRM" && state.enemyAttackCount > previous.enemyAttackCount) {
      crossfadeTo(actions, HEXWYRM_CLIP.crouchChargeAndThrow, { once: true, timeScale: HEXWYRM_ATTACK_TIME_SCALE });
    }
    prev.current = { armorBreaks: state.armorBreaks, enemyAttackCount: state.enemyAttackCount, status: state.status };
  }, [state.armorBreaks, state.round, state.enemyAttackCount, state.status, actions]);

  useFrame(() => {
    if (!entranceGroup.current) return;
    if (entranceStartAt.current === null) {
      entranceGroup.current.position.z = HEXWYRM_ENTRANCE_START_Z;
      return;
    }
    const elapsed = performance.now() - entranceStartAt.current;
    const t = Math.min(1, elapsed / HEXWYRM_ENTRANCE_DURATION_MS);
    entranceGroup.current.position.z = MathUtils.lerp(HEXWYRM_ENTRANCE_START_Z, HEXWYRM_REST_Z, t);
  });

  return (
    <group ref={entranceGroup} position={[ROOM_CAMERA_X.HEXWYRM, 0.4, HEXWYRM_ENTRANCE_START_Z]}>
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.3}>
        <group ref={group} scale={scale} position={position}>
          <primitive object={walking.scene} />
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
useGLTF.preload(EMBERMAW_ANIMATION_URLS.walking);
useGLTF.preload(EMBERMAW_ANIMATION_URLS.zombieScream);
useGLTF.preload(EMBERMAW_ANIMATION_URLS.jumpingPunch);
useGLTF.preload(EMBERMAW_ANIMATION_URLS.fallingDown);
useGLTF.preload(SHARD_WARDEN_ANIMATION_URLS.walking);
useGLTF.preload(SHARD_WARDEN_ANIMATION_URLS.skill03);
useGLTF.preload(SHARD_WARDEN_ANIMATION_URLS.tripleComboAttack);
useGLTF.preload(SHARD_WARDEN_ANIMATION_URLS.shotInTheBackAndFall);
useGLTF.preload(HEXWYRM_ANIMATION_URLS.walking);
useGLTF.preload(HEXWYRM_ANIMATION_URLS.zombieScream);
useGLTF.preload(HEXWYRM_ANIMATION_URLS.crouchChargeAndThrow);
useGLTF.preload(HEXWYRM_ANIMATION_URLS.shotAndFallBackward);

const ANIMATED_DEFEAT_HOLD_MS: Partial<Record<GameState["round"], number>> = {
  EMBERMAW: EMBERMAW_DEFEAT_HOLD_MS,
  SHARD_WARDEN: SHARD_WARDEN_DEFEAT_HOLD_MS,
};

const ALL_ANIMATION_URLS = Object.values(ROUND_ANIMATION_URLS).flat();

export function Arena({ state, playerId, enemyColor, now = 0, preview = false, resetKey = 0, onAssetLoaded, onRoundAssetLoaded }: { state: GameState; playerId: PlayerId; enemyColor: string; now?: number; preview?: boolean; resetKey?: number; onAssetLoaded?: (assetUrl: string) => void; onRoundAssetLoaded?: (assetUrl: string) => void }) {
  const roomX = ROOM_CAMERA_X[state.round];
  const cameraX = playerCameraX(roomX, playerId, preview);
  const shielded = state.status === "PLAYING" && Object.values(state.players).some((player) => player.shieldedUntil > now);
  const [visibleRound, setVisibleRound] = useState(state.round);

  useEffect(() => {
    if (visibleRound === state.round) return;
    const holdMs = ANIMATED_DEFEAT_HOLD_MS[visibleRound];
    if (holdMs !== undefined) {
      const timer = setTimeout(() => setVisibleRound(state.round), holdMs);
      return () => clearTimeout(timer);
    }
    setVisibleRound(state.round);
  }, [state.round, visibleRound]);

  return (
    <div className="absolute inset-0 h-full w-full" data-player-side={playerId === "PLAYER_A" ? "left" : "right"} data-camera-x={cameraX}>
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [cameraX, ROOM_CAMERA_Y[state.round], CAMERA_SPAWN_Z], fov: 68 }}
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
        {ALL_ANIMATION_URLS.map((assetUrl) => (
          <Suspense key={assetUrl} fallback={null}>
            <AssetReadiness assetUrl={assetUrl} onAssetLoaded={onRoundAssetLoaded} />
          </Suspense>
        ))}
        <Suspense fallback={null}>
          <SceneMesh />
          {visibleRound === "EMBERMAW" ? (
            <AnimatedEmbermaw state={state} color={enemyColor} />
          ) : visibleRound === "SHARD_WARDEN" ? (
            <AnimatedShardWarden state={state} color={enemyColor} />
          ) : visibleRound === "HEXWYRM" ? (
            <AnimatedHexwyrm state={state} color={enemyColor} />
          ) : (
            <Enemy state={state} color={enemyColor} />
          )}
          <PlayerPositions roomX={roomX} />
          {state.effect && <SpellEffect key={state.effect.id} roomX={roomX} round={state.round} effect={state.effect} />}
        </Suspense>
        <RoomCamera round={state.round} playerId={playerId} preview={preview} resetKey={resetKey} effect={state.effect} />
        {shielded && <CameraShield />}
        {preview && <PointerLockControls selector="#explore-scene" />}
      </Canvas>
    </div>
  );
}
