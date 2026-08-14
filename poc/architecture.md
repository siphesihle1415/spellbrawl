# POC Architecture

## Overview

```text
Browser client A                         Browser client B
  webcam                                   webcam
    ↓                                        ↓
  MediaPipe + gesture pipeline             MediaPipe + gesture pipeline
    ↓                                        ↓
  semantic input events ─── room ─── semantic input events
                \              /
                 deterministic game engine
                          ↓
                 R3F scene + UI + audio

                         API / server
                 room transport + AI Director
                          ↓
                 Effect Schema validation
```

## Client modules

```text
src/
  hand/         webcam, landmarks, geometry, smoothing, gesture state
  game/         state machine, encounter rules, spell recipes, timers
  multiplayer/  room lifecycle, event transport, reconnect handling
  render/       R3F arena, enemies, VFX, camera, HUD
  ui/           create/join screens, gesture feedback, phase messaging
```

The hand module emits confirmed gestures and confidence locally. It does not know combat rules. The game module translates confirmed gestures into spell intents and owns all authoritative transitions. Rendering subscribes to game state and never decides whether an attack succeeded.

## Server/API modules

```text
api/
  room/         create, join, and room transport endpoints
  ai/           generate one run configuration
server/
  DirectorService.ts
  schemas/      Effect Schema definitions and decoders
```

The room service relays or authoritatively processes semantic events, depending on the selected multiplayer provider. The POC must ensure that both clients converge on the same encounter state; server authority is preferred for damage, phase changes, and victory.

## Runtime boundaries

- Webcam frames and MediaPipe landmarks stay on the device.
- Clients send confirmed gestures, aim, readiness, and spell events.
- The deterministic engine validates recipes, timing windows, player identity, and phase requirements.
- The AI Director runs once near game start and returns configuration only.
- Effect Schema rejects invalid AI output before it reaches the game engine.

## State flow

```text
local hand observation
  → confirmed gesture
  → semantic input event
  → room transport
  → deterministic encounter reducer
  → shared game state
  → render/UI/audio effects
```
