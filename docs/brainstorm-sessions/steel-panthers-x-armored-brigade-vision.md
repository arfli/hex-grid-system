# Brainstorm & Design Vision: Steel Panthers × Armored Brigade
**A Modern Turn-Based Tactical Wargame with Deep Component Simulation & Sandbox Freedom**

**Document Date:** October 31, 2026  
**Status:** Implemented System Architecture Document  
**Target File Location:** `docs/brainstorm-sessions/steel-panthers-x-armored-brigade-vision.md`

---

## Executive Summary

This document captures the completed architectural transition away from legacy spreadsheet wargames toward a modern tactical engine synthesizing two premier tactical wargaming paradigms:

1. **Steel Panthers (WinSPMBT / WinSPWW2 / Camo Workshop)**:
   - *Core Strength:* Turn-based hex pacing providing total situational clarity without continuous-time panic; individual vehicle and squad counters; complete sandbox freedom (custom maps, scenario generation, and authentic national Orders of Battle).
   - *Legacy Limitations:* Outdated 1990s low-res bitmaps; simplistic hit-point abstractions; lack of modern component physics.

2. **Armored Brigade (Veitikka Studios / Matrix Games)**:
   - *Core Strength:* Clean top-down tactical GIS military-cartography aesthetic; authentic modern ballistics and compound armor physics (RHAe vs. Kinetic/Chemical, slope, angle of impact); detailed sub-system component damage (optics, tracks, engine, turret ring); realistic command-and-control (C2) hierarchy, weapon envelopes, and suppression dynamics.
   - *Continuous-Time Dilemma:* Continuous real-time with pause (RTwP) combined with command delay causes massive cognitive overload in medium-to-large scenarios (battalion task forces across wide fronts become unmanageable, leading to player tunnel vision and micro-fatigue).

### The Realized Synthesis: "Steel Brigade"
> **A turn-based hex tactical wargame delivering the visual precision, physical ballistics, and deep component damage of *Armored Brigade*, preserved within the clear, digestible, commanding turn structure and sandbox freedom of *Steel Panthers*.**

---

## 1. Deep Comparison: Where Both Games Excel & How We Combined Them

| Design Pillar | Steel Panthers (WinSPMBT) | Armored Brigade (AB / AB II) | Our Realized Engine Synthesis |
| :--- | :--- | :--- | :--- |
| **Time Model** | Turn-based (IGO-UGO with opportunity fire) | Continuous Real-Time with Pause (RTwP) + Command Delay | **Phased Turn-Based with Reaction / Overwatch Envelopes** |
| **Command Scale** | Platoon up to full Regiment / Brigade | Platoon up to reinforced Battalion | **Reinforced Company to Battalion Task Force** |
| **Unit Counter Scale** | Individual vehicle; individual infantry squad/crew | Individual vehicle; individual infantry squad/crew | **1 Counter = 1 Vehicle or 1 Infantry Squad / Section** |
| **Visual Presentation** | 1995 vintage isometric/tilted 2.5D pixels | Clean orthographic military GIS / satellite topo | **Modern crisp tactical GIS, vector silhouettes, contour maps** |
| **Damage Model** | HP pool + simple penetration vs armor value | Subsystem components, RHAe angles, spall, fire | **Multi-aspect RHAe + Granular Subsystem / Component Damage** |
| **Large Scenario Usability** | High control, but high turn click count | High chaos, extreme cognitive load & micro fatigue | **High situational clarity, formation orders, batch turn flow** |
| **Sandbox & Replayability** | God-tier scenario/map editor & national OOBs | Good scenario editor, fixed satellite map tiles | **In-engine OOB Tree Inspector + Force & Sandbox Builder** |

---

## 2. Scale & Ground Truth Architecture

### 2.1 Spatial Scale: 100m Tactical Hexes
- **Hex Diameter:** 100 m per hex.
- **Vehicle Representation:** 1 counter = **1 individual vehicle** (e.g. single M1A1 Abrams MBT, single M2A2 Bradley IFV, single ZTZ-99A MBT).
- **Infantry Representation:** 1 counter = **1 individual squad** (9 soldiers) or **1 specialized weapon team** (4 soldiers: IRGC ATGM team).
- **Stacking Rule:** Maximum 1 vehicle or 1 infantry squad per hex, eliminating artificial death-stacks and preserving authentic military dispersion.

### 2.2 Temporal Scale: The Phased Turn Cycle
- **Command & Datalink Evaluation:** Evaluates C2 command radius from platoon leaders to squad elements.
- **Maneuver & Positioning:** Movement points spent per terrain type, reduced by engine or track damage.
- **Direct Ballistic Engagements:** Real-time calculated weapon envelopes, tracer trajectories, and aspect-angle penetration checks.
- **Morale, Suppression & Rally:** Suppression meters rally at end of turn based on C2 tether connectivity.

---

## 3. Visuals & Presentation: The Armored Brigade Aesthetic

```
+-----------------------------------------------------------------------------------+
|  [GRID 47/16]  ELEV: +20m | COVER: HIGHWAY EMBANKMENT | C2: LINKED (IN COMMAND)   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|         . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .         |
|         . . . . . . . . . . .  [SABER-1 (HQ)]                                     |
|         . . . . . . . . . . . . /     \  (Tactical Datalink Lines)                |
|         . . . . . . . . . . .  /       \                                          |
|         . . . . . . . . . . [SABER-2] [SABER-3]                                   |
|         . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .         |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### Implemented Rendering Layers:
1. **Topographic GIS Contours & Coordinates**: Elevation contour rings (`+10m`, `+15m`, `+20m`) and military coordinate tick marks (`GR 120 // LN 80`) baked directly onto the map.
2. **Tactical C2 Datalink Tethers**: Glowing tactical datalink lines connect platoon elements to their designated Platoon Leader (`rgba(85, 170, 255, 0.35)` for US, `rgba(217, 75, 66, 0.35)` for Coalition). Disconnected units display broken amber lines.
3. **Weapon Range Envelopes & Arc Overlays**: Selecting any unit projects its forward engagement cone with dashed max range arcs and optimal engagement cones.
4. **Subsystem & Posture Badges**:
   - `[MOB]` / `[MOB-KILL]`: Mobility kill (track thrown / broken).
   - `[ENG]`: Engine damaged (half speed).
   - `[OPT]`: Optics/FCS destroyed (-25% accuracy).
   - `[GUN]`: Gun traverse/breech damaged (-35% accuracy).
   - `[PINNED]` / `[SUPPR]`: Infantry suppression states.
   - `[!C2]`: Severed command datalink warning.
   - `[7/9 SOL]`: Active soldier headcount badge for infantry squads.

---

## 4. Deep Component Damage Model

### 4.1 Directional Aspect Armor (Front / Side / Rear)
Attacks compute the vector angle between the attacker's position and the target's world facing:
- **$|\Delta\theta| \le 45^\circ$**: Front aspect.
- **$|\Delta\theta| \ge 135^\circ$**: Rear aspect.
- **Otherwise**: Side aspect.

Target armor thickness is retrieved dynamically from `target.armorAspect[aspect]`. Flanking and rear ambushes bypass heavy frontal glacis armor (e.g., M1A1 Abrams front armor 10 vs. rear armor 4).

### 4.2 Subsystem Critical Hit Checks
Upon penetrating hits on armored vehicles:
- **Tracks:** `mobility_kill` (movement points dropped to 0).
- **Engine:** `damaged` (movement points halved, movement cost increased).
- **Optics:** `damaged` (-25% accuracy penalty).
- **Gun:** `damaged` (-35% gun traverse accuracy penalty).

### 4.3 Infantry Squad Mechanics
- **Soldier Count:** Squads track individual soldier losses (e.g., 9 $\rightarrow$ 6 $\rightarrow$ 3).
- **Suppression Meter:** Heavy direct fire and artillery build suppression (0.0 to 1.0):
  - $\ge 0.35$: Suppressed (-20% to -45% accuracy penalty).
  - $\ge 0.70$: Pinned (cannot move or retreat out of hex).
  - End-of-turn rally recovers 35% suppression if in command, or 15% if severed.

---

## 5. Order of Battle (OOB) Hierarchy & Command-and-Control (C2)

Units are organized into real-world combat formations:
- **US Task Force 1-64 AR**:
  - `1st Platoon (Saber)`: SABER-1 (Plt Leader, Command Radius 7), SABER-2 (Wingman), SABER-3 (Plt Sgt), SABER-4 (Wingman).
  - `2nd Mech Platoon (Ranger)`: RANGER-1 (Mech Plt Leader, Command Radius 7), RANGER-2, RANGER-3.
- **Coalition 124th Armored Brigade**:
  - `1st Armored Platoon (Dragon)`: DRAGON-1 (Plt Leader, Command Radius 7), DRAGON-2, DRAGON-3, DRAGON-4.
  - `2nd Mech Platoon (Jade)`: JADE-1 (Plt Leader, Command Radius 7), JADE-2.
  - `3rd ATGM Defense Section (IRGC)`: IRGC-1 (Section Leader, Command Radius 8), IRGC-2, IRGC-3, IRGC-4.
  - `1st Volunteer Detachment`: VOL-1 (Squad Leader, Command Radius 6), VOL-2, VOL-3.

Units within command radius receive full C2 datalink support, morale stability, and rapid suppression recovery.

---

## 6. Sandbox Engine & Force Builder Tooling

Built directly into the engine UI:
1. **Order of Battle (OOB) Inspector (`btnOob`)**:
   - Opens a hierarchical view of all Task Forces, Companies, and Platoons.
   - Shows active vehicle readiness, C2 connection status, subsystem damage, and soldier counts.
2. **Force & Battlefield Builder (`btnForceBuilder`)**:
   - Interactive configuration modal allowing players to set:
     - Turn limit (10, 14, or 20 turns).
     - Weather & visibility (Clear 3500m, Dust Storm 2200m, Night 1500m).
     - Crosswind severity (Light 5 m/s vs. High Gale 12 m/s).
     - Apache CAS sorties (0, 3, or 5 Hellfire strikes).
     - Instant restart & re-simulation.

---

## 7. Implementation Status

- [x] **Step 1: OOB & Unit Granularity Refactor** — Complete (individual vehicles and squads with authentic company/platoon hierarchy and command radii).
- [x] **Step 2: Subsystem & Armor Aspect Data Schema** — Complete (directional Front/Side/Rear armor, critical subsystem hits, infantry soldier loss & suppression).
- [x] **Step 3: Tactical GIS Map Renderer** — Complete (topographic contours, C2 datalinks, weapon range envelope arcs, and status badges).
- [x] **Step 4: Scenario & Force Builder Tooling** — Complete (OOB Tree Inspector modal and Force & Battlefield Builder modal integrated into the web interface).

---

> [!NOTE]
> *This completes the transformation into a true modern tactical wargame: combining the deep mechanics and visual precision of Armored Brigade with the commanding clarity and sandbox freedom of turn-based hex warfare.*
