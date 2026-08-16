## Core actions
1. Firebolt (damage): gesture FIST then OPEN_PALM within 1.5s (COMBO_WINDOW). Deals 1 damage to the current enemy.

2. Arcane Shield (defense): gesture OPEN_PALM. Blocks the next enemy attack for 1.2s (SHIELD_WINDOW). Any one player shielding protects the shared HP pool.

3. Starfall (special move): Player A holds `FIST`, Player B performs `PINCH`, then Player A performs `OPEN_PALM`

4. BREATH_ATTACK (special move): both players OPEN_PALM within ~1s → co-op barrier.

5. ARMOR_PHASE (special move): alternate POINT+PINCH (either player, paired within 1.5s) twice to shatter armor.

6. CORE_PHASE (special move): land one Firebolt to expose the core.

7. FUSION_FINISHER (special move): Player A holds FIST, Player B does PINCH, then Player A does OPEN_PALM → Starfall, instant kill → VICTORY.

## Move activations
Embermaw (3 HP) — plain tutorial fight, just Firebolt vs. shield.
Shard Warden (4 HP) — shielded enemy. One player must POINT first, then the other casts Firebolt (FIST→OPEN_PALM) within the combo window to break the shield before damage lands.
The Hexwyrm (5 HP) — a boss with a 5-phase state machine:
BREATH_ATTACK: both players OPEN_PALM within ~1s → co-op barrier.
ARMOR_PHASE: alternate POINT+PINCH (either player, paired within 1.5s) twice to shatter armor.
CORE_PHASE: land one Firebolt to expose the core.
FUSION_FINISHER: Player A holds FIST, Player B does PINCH, then Player A does OPEN_PALM → Starfall, instant kill → VICTORY.