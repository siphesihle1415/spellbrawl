# Scene Mesh Integration Handoff

## Current state

- Branch: `sphe/scene-mesh`
- Remote branch: `origin/sphe/scene-mesh`
- Implementation commit: `a1a168a feat: add three-room arena scene mesh`
- Pull request URL: <https://github.com/siphesihle1415/spellbrawl/pull/new/sphe/scene-mesh>

The three-room environment has been added to the game and replaces the generated cylinder-and-ring arena floor. The existing procedural monster placeholders remain because this asset contains the environment only.

## Source asset

The original Windows asset is available in WSL at:

```text
/mnt/d/percy/Downloads/Scene/Meshy_AI_three_connected_rooms_0815145102_image-to-3d-texture.glb
```

The source GLB is approximately 176 MB and was not copied directly into the repository. It contains one scene, one node, one mesh, one material, and no animations. All three rooms are combined into that single mesh; there are no separately named room nodes.

The web-optimized asset is:

```text
public/models/spellbrawl-three-rooms.glb
```

It is approximately 7.5 MB and uses Meshopt geometry compression, quantized geometry, and 2048px WebP textures. The optimization reduced the uploaded vertex count from roughly 2.54 million to 570,000.

The reproducible optimization command is:

```bash
mkdir -p public/models
npx --yes @gltf-transform/cli@4.2.1 optimize \
  /mnt/d/percy/Downloads/Scene/Meshy_AI_three_connected_rooms_0815145102_image-to-3d-texture.glb \
  public/models/spellbrawl-three-rooms.glb \
  --compress meshopt \
  --meshopt-level high \
  --simplify true \
  --simplify-ratio 0.08 \
  --simplify-error 0.002 \
  --texture-compress webp \
  --texture-size 2048
```

## Code changes

The integration is in `src/render/Arena.tsx`.

- Removed the procedural `Ground` component.
- Added a `SceneMesh` component using Drei's `useGLTF` and asset preloading.
- Enabled shadow receiving on the imported mesh and disabled shadow casting on it to limit rendering cost.
- Scaled the model to `7.5` and raised it to `y = 0.5` to align the room floor with the centered monster.
- Mapped the combat rounds to rooms along the model's X axis:
  - `EMBERMAW`: left room, environment offset `4.65`
  - `SHARD_WARDEN`: middle room, environment offset `0`
  - `HEXWYRM`: right room, environment offset `-4.65`
- Used `MathUtils.damp` with a smoothing factor of `3.5` to animate transitions between rooms.
- Adjusted the camera, fog, ambient light, directional light, and point light for the larger environment.
- Capped the canvas device pixel ratio at `1.5` to reduce GPU cost.

## Verification completed

```text
npm test -- --run
Test Files: 5 passed
Tests: 28 passed

npm run build
Result: successful production build
```

The build still reports the existing warning that the main JavaScript chunk is larger than 500 KB. The optimized GLB is emitted as a separate static asset and is not included in that JavaScript chunk.

A headless Chrome smoke test confirmed that the app loads without a WebGL or GLB decoding crash. The disconnected room gate is intentionally nearly opaque, so the active-game framing of each room still needs a complete visual check after connecting two clients.

## Assumptions and follow-up checks

The room mapping assumes the rooms run left-to-right along the X axis. This was necessary because the exported GLB combines the rooms into one unnamed mesh. The next agent should:

1. Run `npm run dev` so both the room Worker and web app are available.
2. Connect two browser windows or physical devices to the same room and start the game.
3. Confirm Embermaw is framed in the intended first room.
4. Advance through all three rounds and confirm the middle and right room mappings.
5. Tune `ROOM_OFFSETS`, the model scale, or camera position in `src/render/Arena.tsx` if the source scene's intended room order differs.
6. Check framing on a desktop and a narrow/mobile viewport.
7. Measure initial model download and decode time on the intended demo network.

Do not re-add the 176 MB source GLB to Git. If more visual quality is needed, generate a second optimized version and compare loading time and GPU memory before replacing the current asset.
