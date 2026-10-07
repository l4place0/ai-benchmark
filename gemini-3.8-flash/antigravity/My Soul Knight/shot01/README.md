# ACHROMA // SOVEREIGN

> Minimalist Black, White & Gray Pixel Roguelike 2D Game  
> Inspired by **Achroma** (`https://game.unsnow.online/ach/`) and **Soul Knight**.

---

## 🎮 How to Play

Open [index.html](file:///d:/l4place/Workspace/ai-benchmark/gemini-3.8-flash/antigravity/My%20Soul%20Knight/shot01/index.html) directly in any modern web browser.

### Key Controls
| Action | Input |
| :--- | :--- |
| **Movement** | `W`, `A`, `S`, `D` or Arrow Keys |
| **Aim** | Mouse Cursor (In-Canvas Pixel Crosshair) |
| **Attack / Shoot** | `Left Mouse Button` or `Space` |
| **Tactical Dash (Invulnerable)** | `Right Mouse Button` or `Shift` |
| **Switch Weapon** | `Q`, Mouse Scroll Wheel, or `1` / `2` |
| **Interact / Open Chest** | `E` (or walk directly into portals) |
| **Manual Reload** | `R` |
| **Upgrade Selection** | `1`, `2`, `3` or Click Card |
| **Mute / Unmute** | `M` |

---

## 🎨 Aesthetic & Engine Innovations (Achroma Reference)

1. **480x270 Virtual Native Resolution**:
   - Razor-sharp pixel-perfect canvas rendering with crisp edges (`image-rendering: pixelated`).
   - In-canvas custom pixel crosshair with dynamic reload ring.

2. **6-Step Grayscale Palette + High-Impact Accents**:
   - Palette: `col(0)` (Void `#050506`) to `col(5)` (Pure White `#f5f5f7`).
   - Vibrant Accents:
     - `Cyan` (`#00f5ff`): Shields, dash ghost trails, freeze effects, energy weapons.
     - `Red` (`#ff0055`): Enemy bullets, lasers, critical hits, damage splatters.
     - `Gold` (`#ffaa00`): Crystalline Ink, chests, combo popups.
     - `Orange` (`#ff6600`): Rocket blasts, combustion explosions.
     - `Violet` (`#b537f2`): Elite enemy auras, afterimage shockwaves.
     - `Lime` (`#39ff14`): Acid/poison, vitality recovery.

3. **Modern Procedural Audio (Convolver Reverb + No 8-bit Beeps)**:
   - Built-in stereo impulse convolver reverb (2.2s lush natural decay).
   - Dynamic limiter to prevent clipping and ensure deep, bass-heavy punch.
   - Generative ambient synth drone that seamlessly transitions between `calm` and `combat`.
   - Crystalline Ink collection sounds with climbing pentatonic pitch.
   - Combo counter scaling kill chime frequencies.

---

## ⚔️ Weapons Arsenal (10 Distinct Archetypes)

1. **NAIL (Pistol)**: Steady sidearm with rapid kinetic discharge.
2. **HAIL (SMG)**: High fire-rate bullet hose that shreds through enemy swarms.
3. **SCATTER (Shotgun)**: Seven heavy pellets with massive point-blank knockback.
4. **RAIL (Railgun)**: Piercing beam line punching through covers and enemy ranks.
5. **EDGE (Plasma Blade)**: Melee sweep that slices swarms and **reflects enemy bullets back**.
6. **VOLT (Tesla Caster)**: Arc-lightning emitter chaining through up to 4 foes.
7. **BLOOMER (Rocket)**: Micro-missiles with devastating radial explosions.
8. **HALO (Chakram)**: Returning disc blade that hits on throw and hits on return.
9. **BUZZSAW (Saw)**: Ricocheting saw that bounces 5 times off walls and keeps slicing.
10. **LONGBOW (Bow)**: Hold to draw; full draw pierces and deals massive damage.

---

## ⚡ Universal Shards & Synergies Pipeline

Every shard routes through the global `hitEnemy` pipeline:
- **Ember** (Burn DoT), **Arc** (Chain Shock), **Rime** (Frost & Freeze), **Venom** (Poison).
- **Keen** (+Crit chance & multiplier), **Fork** (+1 copy per attack for all weapons).
- **Echo** (Every 3 attacks repeats as a ghostly phantom), **Ricochet** (Wall bounces).
- **Heavy** (Damage + Size + Knockback), **Bloom** (Enemies explode on death).
- **Shrapnel** (Kills release 3 seeking shards), **Tactical Dash** (Dash restores 50% mag).
- **Afterimage** (Dash releases shockwave nova), **Satellite** (Orbiting bullet-eating cubes).

### Synergies
- **PLASMA (Ember + Arc)**: Lightning detonates burning foes into fiery plasma blasts.
- **SHATTER (Rime + Keen)**: Crits on frozen foes deal 3.5x damage and shatter.
- **CHAIN REACTION (Bloom + Shrapnel)**: Shrapnel shards explode on impact.
- **PHANTOM (Afterimage + Echo)**: Dashing triggers a free full-strength echo attack.
- **WILDFIRE (Ember + Bloom)**: Detonations ignite everything in a huge fiery radius.

---

## 👾 Boss Design: KEEPER OF ASH // THE MONOLITH

- **Phase 1**: Bullet hell expanding rings, ground slams, tracking kinetic rounds.
- **Phase 2 (66% HP)**: 120° sweeping death lasers (dash through using i-frames), spiral storm.
- **Phase 3 (33% HP)**: Overdrive enrage, dual spiral streams, cross beams, high aggression.
