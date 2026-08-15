import { PointerLockControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { MathUtils, Mesh, Vector3, type Object3D, type PointLight } from "three";
import type { CharacterSelections } from "../game/characters";
import type { GameState } from "../game/types";
import { PlayerAvatar } from "./PlayerAvatar";

const SCENE_MESH_URL = "/models/spellbrawl-three-rooms-open-lighting.glb";
const SCENE_SCALE = 10.5;
const ROOM_CAMERA_X: Record<GameState["round"], number> = {
  EMBERMAW: 0,
  SHARD_WARDEN: 6.5,
  HEXWYRM: -6.5,
};
const CAMERA_SPAWN_Y = -0.2;
const CAMERA_SPAWN_Z = 2.15;
const NAVIGATION_X_LIMITS = { min: -8.5, max: 8.5 };
const NAVIGATION_Z_LIMITS = { near: 2.5, far: 0.35 };
const MOVE_SPEED = 3;
const WALK_BOB_HEIGHT = 0.025;
const MOVEMENT_KEYS = new Set(["w", "a", "s", "d"]);

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
  const pressedKeys = useRef(new Set<string>());
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const walkTime = useRef(0);

  useEffect(() => {
    const roomX = ROOM_CAMERA_X[round];
    if (preview) camera.position.x = roomX;
    camera.position.y = CAMERA_SPAWN_Y;
    camera.position.z = CAMERA_SPAWN_Z;
    camera.lookAt(roomX, CAMERA_SPAWN_Y, -2);
  }, [camera, preview, resetKey, round]);

  useEffect(() => {
    if (!preview) {
      pressedKeys.current.clear();
      return;
    }
    const updateKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) return;
      event.preventDefault();
      if (pressed) pressedKeys.current.add(key);
      else pressedKeys.current.delete(key);
    };
    const onKeyDown = (event: KeyboardEvent) => updateKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => updateKey(event, false);
    const clearKeys = () => pressedKeys.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, [preview]);

  useFrame((_, delta) => {
    const roomX = ROOM_CAMERA_X[round];

    if (preview) {
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();
      right.current.crossVectors(forward.current, camera.up).normalize();
      const distance = MOVE_SPEED * delta;
      if (pressedKeys.current.has("w")) camera.position.addScaledVector(forward.current, distance);
      if (pressedKeys.current.has("s")) camera.position.addScaledVector(forward.current, -distance);
      if (pressedKeys.current.has("d")) camera.position.addScaledVector(right.current, distance);
      if (pressedKeys.current.has("a")) camera.position.addScaledVector(right.current, -distance);
      camera.position.x = MathUtils.clamp(camera.position.x, NAVIGATION_X_LIMITS.min, NAVIGATION_X_LIMITS.max);
      camera.position.z = MathUtils.clamp(camera.position.z, NAVIGATION_Z_LIMITS.far, NAVIGATION_Z_LIMITS.near);
      if (pressedKeys.current.size > 0) walkTime.current += delta * 9;
      camera.position.y = CAMERA_SPAWN_Y + (pressedKeys.current.size > 0 ? Math.sin(walkTime.current) * WALK_BOB_HEIGHT : 0);
    } else {
      camera.position.x = MathUtils.damp(camera.position.x, roomX, 3.5, delta);
      camera.position.y = MathUtils.damp(camera.position.y, CAMERA_SPAWN_Y, 3.5, delta);
      camera.position.z = MathUtils.damp(camera.position.z, CAMERA_SPAWN_Z, 3.5, delta);
      camera.lookAt(camera.position.x, CAMERA_SPAWN_Y, -2);
    }

    if (light.current) {
      light.current.position.x = MathUtils.damp(
        light.current.position.x,
        camera.position.x + 1.2,
        3.5,
        delta,
      );
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

useGLTF.preload(SCENE_MESH_URL);

export function Arena({
  state,
  characters,
  preview = false,
  resetKey = 0,
}: {
  state: GameState;
  characters: CharacterSelections;
  preview?: boolean;
  resetKey?: number;
}) {
  const roomX = ROOM_CAMERA_X[state.round];

  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [roomX, CAMERA_SPAWN_Y, CAMERA_SPAWN_Z], fov: 60 }}
      >
        <color attach="background" args={["#08060f"]} />
        <fog attach="fog" args={["#08060f", 10, 24]} />
        <ambientLight intensity={1} />
        <directionalLight position={[4, 7, 4]} intensity={2.8} castShadow color="#ffd7b0" />
        <Suspense fallback={null}>
          <SceneMesh />
        </Suspense>
        <RoomCamera round={state.round} preview={preview} resetKey={resetKey} />
        {preview && <PointerLockControls selector="#explore-scene" />}
        <group position={[roomX, 0, 0]}>
          {characters.PLAYER_A && <PlayerAvatar characterId={characters.PLAYER_A} side="left" />}
          {characters.PLAYER_B && <PlayerAvatar characterId={characters.PLAYER_B} side="right" />}
        </group>
      </Canvas>
    </div>
  );
}
