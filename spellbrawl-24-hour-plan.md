# SpellBrawl — 24-Hour Hackathon Plan

## Goal

Build a polished **2-player co-op browser game** where players use webcam-tracked hand gestures to cast spells, defeat three increasingly difficult enemies, and finish with a cinematic cooperative boss attack.

The MVP should combine:

- React + TypeScript
- React Three Fiber / Three.js
- Webcam hand tracking with MediaPipe
- Multiplayer across devices
- TypeScript backend using Effect
- LLM-powered encounter/spell generation
- Vercel deployment
- Dynamic 3D visuals with a painterly fantasy-tech / graphic-novel aesthetic

---

## Final MVP Scope

The demo contains exactly three rounds:

1. **Round 1 — Embermaw**
   - Basic enemy
   - Teaches attacking and shielding

2. **Round 2 — Shard Warden**
   - Shielded enemy
   - Requires simple player coordination to expose its core

3. **Round 3 — The Hexwyrm**
   - Boss encounter
   - Cooperative defense
   - Armor-breaking mechanic
   - Fusion finishing spell

The core gesture set is deliberately small:

- `FIST`
- `OPEN_PALM`
- `POINT`
- `PINCH`
- `HANDS_APART`
- `THRUST`

Normal spells:

- **Firebolt** — `FIST → THRUST`
- **Arcane Shield** — `OPEN_PALM`

Boss finisher:

- **Starfall** — Player A holds `FIST`, Player B performs `HANDS_APART`, then Player A performs `THRUST`

---

# 24-Hour Schedule

| Time | Goal | Deliverable |
|---|---|---|
| 0–2h | Project foundation | React + R3F + MediaPipe + Effect + multiplayer + Vercel deployed |
| 2–5h | Hand tracking | Webcam, landmarks, 4 reliable gestures |
| 5–8h | Multiplayer | 2 players join room and sync gestures across devices |
| 8–11h | Core combat | Firebolt, shield, enemy HP, attacks, win/lose loop |
| 11–14h | Three-round progression | Embermaw, Shard Warden, Hexwyrm progression |
| 14–17h | Boss fight | Boss phases + cooperative fusion finisher |
| 17–19h | LLM Director | Enemy names/configs, spell clues, Effect Schema validation |
| 19–22h | Visual and audio polish | VFX, bloom, particles, camera shake, sound |
| 22–24h | Test and rehearse | Two-device testing, deployment checks, bug fixes, demo rehearsal |

---

# Hours 0–2 — Project Foundation

Set up:

```text
React + TypeScript
React Three Fiber
Three.js
MediaPipe
Effect
Multiplayer provider
Vercel
```

Suggested project structure:

```text
src/
  hand/
  game/
  render/
  multiplayer/

api/
  ai/
  room/

server/
  DirectorService.ts
  schemas/
```

Deploy immediately.

### Checkpoint

A production Vercel URL loads successfully and renders a basic Three.js scene.

---

# Hours 2–5 — Hand Tracking

Implement the webcam and MediaPipe hand tracking pipeline.

Pipeline:

```text
Webcam
  ↓
MediaPipe
  ↓
Normalized landmarks
  ↓
Gesture geometry
  ↓
Temporal smoothing
  ↓
Confirmed gesture
```

Initially support:

```text
FIST
OPEN_PALM
POINT
PINCH
```

Add:

```text
THRUST
```

as the first motion gesture.

Use normalized hand proportions instead of pixel distances.

Example:

```text
pinchRatio =
distance(thumbTip, indexTip)
/
distance(wrist, middleMcp)
```

Add temporal smoothing so gestures must remain stable for roughly 100–150 ms before being confirmed.

Display:

- webcam feed
- hand skeleton
- current detected gesture
- confidence / stability indicator

### Checkpoint

`FIST`, `OPEN_PALM`, and `POINT` work reliably under normal lighting.

---

# Hours 5–8 — Multiplayer

Support exactly two players.

Flow:

```text
CREATE ROOM
     ↓
ROOM CODE
     ↓
JOIN ROOM
```

Synchronize semantic game information only:

```text
PLAYER_READY
GESTURE
AIM
SPELL_CAST
```

Do not send webcam video.

Do not send all hand landmarks every frame.

### Critical Test

Player A makes a fist on Laptop A.

Laptop B displays:

```text
REMOTE PLAYER: FIST
```

### Checkpoint

Two real devices can join the same room and exchange gesture events.

---

# Hours 8–11 — Core Combat

Build one complete combat loop before adding progression.

## Firebolt

Gesture:

```text
FIST
  ↓
THRUST
  ↓
FIREBOLT
```

## Arcane Shield

Gesture:

```text
OPEN_PALM
  ↓
SHIELD ACTIVE
```

Implement:

- shared player HP
- enemy HP
- enemy attack timer
- basic enemy projectile/blast
- damage
- shield blocking
- round victory
- game over
- round reset

### Checkpoint

At hour 11, the game must already be playable:

```text
Two players
  ↓
One enemy
  ↓
Attack
  ↓
Defend
  ↓
Win or lose
```

Visual quality is not important yet.

---

# Hours 11–14 — Three-Round Progression

Reuse as much logic and rendering as possible.

## Round 1 — Embermaw

Purpose: tutorial encounter.

```text
HP: 3

Enemy attacks
  ↓
Players shield
  ↓
Players cast Firebolt
```

No special mechanics.

---

## Round 2 — Shard Warden

Add one new mechanic:

```text
SHIELD ACTIVE
```

Players coordinate:

```text
Player A: POINT
Player B: FIST + THRUST
```

within a short timing window.

Result:

```text
SHIELD BREAK
  ↓
CORE EXPOSED
```

Then players attack normally.

---

## Round 3 — The Hexwyrm

The boss is primarily a cinematic state machine:

```text
INTRO
  ↓
BREATH_ATTACK
  ↓
ARMOR_PHASE
  ↓
CORE_PHASE
  ↓
FUSION_FINISHER
```

### Checkpoint

All three rounds transition correctly even with placeholder visuals.

---

# Hours 14–17 — Boss Fight

The boss should be the most memorable part of the demo.

## Phase 1 — Cooperative Barrier

The Hexwyrm performs a breath attack.

Both players must use:

```text
OPEN_PALM
+
OPEN_PALM
```

within about one second.

Result:

```text
CO-OP ARCANE BARRIER
```

Render this as one large transparent shield dome with particles.

---

## Phase 2 — Break the Armor

Player A:

```text
POINT
```

Player B:

```text
PINCH
```

Trigger:

```text
ARMOR SHATTER
```

Repeat only twice.

Then:

```text
CORE EXPOSED
```

---

## Phase 3 — Fusion Finisher

Player A:

```text
FIST — HOLD
```

Player B:

```text
HANDS_APART
```

Then Player A:

```text
THRUST
```

Trigger:

# STARFALL

Suggested visual sequence:

```text
arena darkens
  ↓
particles pull inward
  ↓
rift brightens
  ↓
camera pulls back
  ↓
energy beams merge
  ↓
boss is struck
  ↓
white flash
  ↓
brief hit-stop
  ↓
shockwave
  ↓
boss dissolves
  ↓
VICTORY
```

### Checkpoint

Two players can coordinate the final spell across separate devices.

---

# Hours 17–19 — LLM Director

Keep the LLM implementation constrained and reliable.

Generate one run configuration near the start of the game.

Example output:

```json
{
  "round1": {
    "name": "Embermaw",
    "title": "The Starved Flame"
  },
  "round2": {
    "name": "Shard Warden",
    "title": "Keeper of the Rift"
  },
  "boss": {
    "name": "Vhar'Zul",
    "title": "The Hexwyrm"
  },
  "finisher": {
    "name": "Starfall Cataclysm",
    "clue": "Bind the star. Tear open the rift. Release."
  }
}
```

The LLM may choose from a fixed vocabulary of:

- enemy names
- titles
- elemental themes
- weaknesses
- gesture recipes
- spell names
- spell clues

The deterministic game engine still owns all mechanics.

## Effect Boundary

Validate all AI output with Effect Schema before it enters gameplay.

Conceptually:

```text
LLM output
   ↓
Effect Schema validation
   ↓
Valid Encounter Configuration
   ↓
Game Engine
```

Always provide a fallback:

```text
LLM failure
  ↓
DEFAULT_RUN
```

The demo must not depend on the model responding successfully.

---

# Hours 19–22 — Visual and Audio Polish

Do not add new mechanics here.

Focus on perceived quality.

## Priorities

### 1. Bloom

Magic should glow strongly.

### 2. Projectile Trails

Use trails on:

- Firebolt
- boss attacks
- fusion energy

### 3. Impact Shockwaves

Use inexpensive expanding meshes or rings.

### 4. Camera Shake

Trigger on:

- player hit
- enemy hit
- boss attacks
- armor break
- final fusion

### 5. Lighting Changes

Change arena lighting by boss phase.

Example:

```text
normal arena
  ↓
boss attack
  ↓
red/orange threat lighting
  ↓
fusion sequence
  ↓
environment darkens
  ↓
spell becomes primary light source
```

### 6. Audio

Only after core VFX work.

Minimum sounds:

- ambient loop
- Firebolt charge
- Firebolt launch
- shield activation
- impact
- boss roar
- fusion charge
- final explosion

---

# Hours 22–24 — Test, Fix, Rehearse

No new features.

Test with two physical devices.

Check:

```text
camera permissions
room creation
room joining
gesture recognition
remote gesture sync
Firebolt
Shield
round transitions
boss transitions
fusion detection
LLM fallback
refresh / reconnect
production Vercel build
```

Test in:

- bright lighting
- dim lighting
- busy background
- left-handed use
- right-handed use
- slower laptop
- mobile hotspot / imperfect network

Then rehearse the exact demo flow.

---

# Scope Cuts

Do not build:

- PvP
- accounts
- matchmaking
- mobile gameplay
- procedural runtime 3D model generation
- more than two normal spells
- complex enemy AI
- player locomotion
- inventory
- persistence
- more than three rounds
- voice controls
- generated dialogue during combat

If time slips further, cut the special Round 2 mechanic before cutting the boss.

---

# Must-Have Features

Never cut these:

```text
Hand tracking
Multiplayer
Firebolt
Shield
Three-round progression
Boss
Fusion spell
Strong final VFX
```

These features define the demo.

---

# Architecture Summary

```text
               PLAYER A
                  │
              Webcam
                  │
             MediaPipe
                  │
          Gesture Engine
                  │
                  ├──────────────┐
                  │              │
                  ▼              ▼
              Game Logic     Multiplayer
                                 │
                                 ▼
                             PLAYER B
                                 │
                             Webcam
                                 │
                            MediaPipe
                                 │
                         Gesture Engine

                  │
                  ▼
              Shared Match
                  │
         ┌────────┼────────┐
         ▼        ▼        ▼
      Round 1   Round 2   Boss
                            │
                            ▼
                      Fusion Spell

Backend:

Vercel Functions
      │
    Effect
      │
DirectorService
      │
     LLM
      │
Effect Schema Validation
```

---

# Demo Flow

The presentation should begin with gameplay, not architecture.

Suggested flow:

1. **“This is SpellBrawl. Your hands are the controller.”**
2. Raise an open palm and show the shield.
3. Make a fist and thrust to cast Firebolt.
4. Show the same actions reflected on the second player's device.
5. Defeat Round 1.
6. Quickly show the coordinated Round 2 mechanic.
7. Enter the boss fight.
8. Both players block the boss breath attack together.
9. Break the boss armor.
10. Perform the cooperative Starfall gesture sequence.
11. Trigger the full cinematic finisher.
12. End on victory.
13. Then explain the architecture and AI Director.

---

# Final Success Criteria

At the end of 24 hours:

- Two browsers join one multiplayer room
- Both webcams detect hand gestures
- `FIST`, `OPEN_PALM`, `POINT`, and `PINCH` work reliably
- Gesture events synchronize across devices
- Firebolt works
- Shield works
- Enemy attacks and health work
- Three rounds progress correctly
- Boss fight works
- Cooperative fusion finisher works
- LLM-generated encounter flavor/configuration works
- LLM output is validated with Effect Schema
- LLM failure falls back safely
- Arena has dynamic lighting and particles
- Final spell has strong VFX and sound
- Production Vercel deployment works on two devices

---

# Guiding Principle

At hour 11, the game should already be playable.

Everything after that is progression, AI integration, and spectacle.

For the 24-hour hackathon, optimize around the moment where **two players physically coordinate hand gestures across two laptops to unleash one massive shared spell against the final boss**.
