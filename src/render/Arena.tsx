import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { MathUtils, Mesh, type Object3D, type PointLight } from "three";
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

function RoomCamera({ round }: { round: GameState["round"] }) {
  const { camera } = useThree();
  const light = useRef<PointLight>(null);

  useEffect(() => {
    const roomX = ROOM_CAMERA_X[round];
    camera.position.y = CAMERA_SPAWN_Y;
    camera.position.z = CAMERA_SPAWN_Z;
    camera.lookAt(roomX, CAMERA_SPAWN_Y, -2);
  }, [camera, round]);

  useFrame((_, delta) => {
    const roomX = ROOM_CAMERA_X[round];

    camera.position.x = MathUtils.damp(camera.position.x, roomX, 3.5, delta);
    camera.position.y = MathUtils.damp(camera.position.y, CAMERA_SPAWN_Y, 3.5, delta);
    camera.position.z = MathUtils.damp(camera.position.z, CAMERA_SPAWN_Z, 3.5, delta);
    camera.lookAt(camera.position.x, CAMERA_SPAWN_Y, -2);

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
}: {
  state: GameState;
  characters: CharacterSelections;
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
        <RoomCamera round={state.round} />
        <group position={[roomX, 0, 0]}>
          {characters.PLAYER_A && <PlayerAvatar characterId={characters.PLAYER_A} side="left" />}
          {characters.PLAYER_B && <PlayerAvatar characterId={characters.PLAYER_B} side="right" />}
        </group>
      </Canvas>
    </div>
  );
}
