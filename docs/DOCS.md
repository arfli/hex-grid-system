# Hex War Engine — Technical Documentation & Architecture Guide

A modular, scenario-driven tactical wargame engine built with vanilla ES6 JavaScript and HTML5 Canvas. The engine simulates turn-based combined-arms combat on a hexagonal grid with realistic ballistics, terrain modifiers, unit morale, and tactical AI.

---

## 1. System Overview

### Core Principles
- **Scenario-Driven Architecture**: Generic game rules, mathematical models, AI behaviors, and rendering logic live in the core engine (`src/hex-war-engine.js`), while all battle parameters, rosters, terrain layouts, and win conditions are defined in scenario definitions (`scenarios/*.js`).
- **Standard Military Ground Scale**: 
  - **1 Hex = 100 meters** center-to-center ground distance (configurable via `map.metersPerHex`).
  - Unit weapons use real-world ballistic ranges (e.g., 3,000 m for tank main guns, 3,750 m for ATGMs).
  - One unit counter represents an individual vehicle or fortified squad/team position.
  - One turn represents approximately 30 seconds of tactical combat.
- **Zero External Dependencies**: Pure vanilla JavaScript, standard Web APIs (2D Canvas, Pointer Events, DOM), and zero build step or npm bundle requirement.

---

## 2. Scale & Military Echelon Reference

### 2.1 What 1 Hex Represents (Geometry & Square Meters)

The engine models pointy-topped regular hexagons configured through `map.metersPerHex` (default: **100 meters**).

In hexagonal wargames and within `HexGrid.distance(a, b)`:
- **Center-to-Center Distance**: Moving between two adjacent hex centers equals exactly **$100\text{ meters}$**.
- **Flat-to-Flat Width ($W$)**: $100\text{ meters}$ (the diameter between opposite parallel edges).
- **Apothem / Inradius ($r$)**: Distance from the center to any edge midpoint is $r = \frac{W}{2} = 50\text{ meters}$.
- **Side Length ($s$) & Circumradius ($R$)**:
  $$R = s = \frac{W}{\sqrt{3}} = \frac{100}{\sqrt{3}} \approx 57.735\text{ meters}$$
- **Vertex-to-Vertex Diameter ($2R$)**: $\approx 115.47\text{ meters}$.

#### Exact Area Calculation:
The ground footprint of a single regular hex is:
$$\text{Area} = 2\sqrt{3} \times r^2 = 2\sqrt{3} \times (50\text{ m})^2 = 5000\sqrt{3} \approx \mathbf{8{,}660.25\text{ m}^2}$$

In practical units:
- **$\approx 8{,}660\text{ square meters}$**
- **$\approx 0.866\text{ hectares}$**
- **$\approx 2.14\text{ acres}$**
- *(By comparison, a standard FIFA soccer pitch is $\sim 7{,}140\text{ m}^2$; one hex is approximately $1.21$ soccer pitches in area).*

#### Total Battlefield Dimensions:
In the standard scenario (`columns: 52, rows: 32`):
- **Map Width**: $52 \times 100\text{ m} = \mathbf{5.2\text{ km}}$
- **Map Height**: $32 \times 100\text{ m} = \mathbf{3.2\text{ km}}$
- **Total Engagement Envelope**: $5.2\text{ km} \times 3.2\text{ km} = \mathbf{16.64\text{ km}^2}$ ($1{,}664\text{ hectares}$ across $1{,}664$ hexes).

---

### 2.2 What 1 Unit Counter Represents (Tactical Echelon: Platoon Scale)

Each unit counter on a hex represents **1 Platoon** (or heavy-weapons section / infantry defensive platoon):

| Counter Type | Unit Echelon | Platoon Composition | Example in Code | Crew / Manpower |
| :--- | :--- | :--- | :--- | :--- |
| **Main Battle Tank (MBT)** | **Armor Platoon** | 4 Tanks (U.S.) / 3–4 Tanks (Coalition) | `SABER-1` (1st Plt, Saber Co), `DRAGON-1` | 12–16 crewmen |
| **Infantry Fighting Vehicle (IFV)** | **Mechanized Infantry Platoon** | 4 Bradleys / ZBD-04s + mechanized infantry dismounts | `RANGER-1` (1st Plt, Ranger Co), `JADE-1` | 12 vehicle crew + ~24–30 dismounted riflemen |
| **Fortified Infantry** | **Anti-Tank Platoon / Battery** | 3–4 Prepared ATGM launcher emplacements | `IRGC-1` (`IRGC Fortified ATGM Platoon`) | 12–20 specialized missile crewmen |
| **Volunteer Infantry** | **Defensive Infantry Platoon** | 3–4 Rifle squads in trench/urban strongpoints | `VOL-1` (`Iranian Volunteer Platoon`) | 30–40 infantry fighters |

#### Why Platoon Scale Fits the Ground Geography:
- **Platoon Frontage in Doctrine**: In modern mechanized warfare doctrine, an armored platoon deployed in combat line, wedge, or echelon covers a **$100\text{ m to }200\text{ m}$ frontage**. An $8{,}660\text{ m}^2$ ($100\text{ m}$ center-to-center) hex directly matches the operational footprint and maneuver box of a single platoon.
- **Combat Strength & Health Points Mapping**:
  - The health bar represents the **platoon's combat strength and operational vehicles**:
    - **M1A1 Abrams Platoon (12 HP)**: Corresponds to 4 tanks with 3 hit points each (12 HP = 4 tanks operational, 9 HP = 3 tanks, 6 HP = 2 tanks, 3 HP = 1 tank surviving).
    - **Bradley Mech Platoon (7 HP)**: Corresponds to 3–4 IFVs and organic infantry teams.
  - When a platoon takes damage, it represents cumulative vehicle losses, damaged tracks/optics, and crew casualties.
- **Player Command Scope (Force Echelon)**:
  - The player commands a **Combined-Arms Company Combat Team / Battalion Vanguard** (e.g., U.S. force: 4 Tank Platoons [16 Abrams] + 3 Mechanized Platoons [12 Bradleys] = **28 combat vehicles**).
  - The operational narrative sets this reinforced company as the lead spearhead of an advancing **Armored Regiment** attacking toward the outskirts of Ahvaz.
- **Platoon Callsigns**:
  - `SABER-1` $\rightarrow$ 1st Platoon, Saber Company (Abrams)
  - `SABER-2` $\rightarrow$ 2nd Platoon, Saber Company (Abrams)
  - `RANGER-1` $\rightarrow$ 1st Platoon, Ranger Company (Bradleys)
  - `DRAGON-1` $\rightarrow$ 1st Platoon, Dragon Company (Type 99 MBTs)
  - `JADE-1` $\rightarrow$ 1st Platoon, Jade Company (ZBD-04 IFVs)

---

## 3. Project Directory Structure

```
hex-grid-system/
├── index.html               # Main entrypoint: UI layout, canvas, dialogs, and script tags
├── styles.css               # Styling for game dashboard, military terminal styling, and dialogs
├── src/
│   ├── hex-war-engine.js    # Core wargame engine, math, AI, and renderer classes
│   └── main.js              # Application bootstrapper, query param routing, scenario mounting
├── scenarios/
│   └── bite-the-dust.js     # Scenario: Battle on western approaches to Ahvaz
├── docs/
│   ├── DOCS.md              # Core system and architecture documentation (this file)
│   └── SCENARIOS.md         # Guide for authoring custom scenarios
└── assets/
    ├── imgs/                # Vehicle sprites, background textures, effects, explosions
    ├── svg/                 # Terrain overlay SVGs and infantry counter icons
    └── audio/               # SFX audio tracks (engines, weapons fire)
```

---

## 4. Architecture & Engine Components

The engine is encapsulated under the global namespace `window.HexWar` and composed of six core classes:

```
                      +-------------------+
                      |      main.js      |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      |    HexWarGame     | <----------------+
                      +----+----+----+----+                  |
                           |    |    |                       |
            +--------------+    |    +-------------+         |
            v                   v                  v         |
     +-------------+    +---------------+   +------------+   |
     |   HexGrid   |    | Battlefield-  |   | TacticalAI |   |
     |  (Geometry) |    |   Renderer    |   | (Decision) |   |
     +-------------+    +-------+-------+   +------------+   |
                                |                            |
                                v                            |
                        +---------------+                    |
                        |  MapViewport  |                    |
                        |  (Pan / Zoom) |                    |
                        +---------------+                    |
                                                             |
     +-------------+    +---------------+                    |
     |   GameUI    |    |  ModalDialog  |                    |
     |  (DOM Sync) |    |  StoryIntro   | -------------------+
     +-------------+    +---------------+
```

### 3.1 `HexGrid`
Handles axial coordinate mathematics, distance calculations, neighbor lookups, and screen-space conversions:
- **Coordinate System**: Pointy-topped axial coordinates $(q, r)$, derived from rectangular grid columns and rows:
  $$q = \text{column} - \lfloor \text{row} / 2 \rfloor, \quad r = \text{row}$$
- **Hex Distance**: Standard Hexagonal Manhattan metric:
  $$\text{dist}(a, b) = \frac{|a.q - b.q| + |a.q + a.r - b.q - b.r| + |a.r - b.r|}{2}$$
- **Pixel Projection**:
  $$x = \text{origin.x} + \text{hexSize} \times \sqrt{3} \times (q + r / 2)$$
  $$y = \text{origin.y} + \text{hexSize} \times 1.5 \times r$$
- **Closest Cell Lookup**: `closestCell(x, y)` calculates Euclidean distance from screen coordinates to cell centers to find the target hex.

### 3.2 `AssetStore`
Asynchronously preloads image assets required by the scenario (`baseTerrain`, `explosion`, terrain decals, unit sprites, and air support models). Invokes an `onLoad` callback on completion of each asset to trigger canvas repaints.

### 3.3 `BattlefieldRenderer`
Renders all tactical elements to the HTML5 Canvas in layered order:
1. **Board Hexes**: Base terrain image clipped to each hex polygon, overlaid with terrain decals (roads, canals, urban blocks, trenches, craters) and border strokes.
2. **Movement Reachability**: Semi-transparent blue fill and highlighted border on reachable hexes for the currently selected unit.
3. **Objectives**: Numbered diamond markers colored by faction ownership.
4. **Units**: Directionally rotated vehicle/infantry sprites, faction affiliation rings, unit identifier badges, and two-tone health bars.
5. **Target Indicators**: Pulsing dashed red circles around attackable enemy units within line-of-sight and weapon reach.
6. **Explosions & Impact FX**: Animated frame-by-frame alpha fades and expansions for ballistic impacts.
7. **Air Support Missions**: Animated low-altitude aircraft flybys with sinusoidal flight paths and shadow effects.

### 3.4 `HexWarGame`
The central state machine and coordinator:
- Manages game state (`activeFaction`, `turn`, `selected`, `gameOver`, `livingUnits`).
- Runs pathfinding and movement execution.
- Evaluates combat line-of-sight, weapon range, ballistic accuracy, armor penetration, and damage calculations.
- Coordinates turn progression, automated AI scheduling, and victory condition evaluations (`determineWinner()`).

### 3.5 `TacticalAI`
Autonomous decision-making engine for computer-controlled factions:
- **`defensive-fire`**: Identifies highest-threat, high-vulnerability targets within firing range and executes defensive fire while maintaining fortified positions.
- **`breakthrough`**: Prioritizes attacking vulnerable targets, evaluates the optimal advance hex toward scenario objectives or target columns using Dijkstra movement maps, moves the unit, and conducts follow-up strikes if the unit's weapon allows firing on the move.
- **Target Scoring Formula**:
  $$\text{Score} = \text{Accuracy} \times \text{Vulnerability} + \left(1 - \frac{\text{target.health}}{\text{target.maxHealth}}\right) \times 2$$
  where $\text{Vulnerability} = \max(1, \text{penetration} - \text{target.armor} + 3)$.

### 3.6 `MapViewport`
Provides interactive navigation over large battlefield maps:
- Smooth drag-and-drop panning with pointer capture.
- Zoom slider and `Ctrl + Wheel` zooming centered on the mouse position.
- "Fit Map" viewport calculation to frame the entire engagement area.
- Click suppression guard (`suppressNextClick`) to differentiate between camera pans and unit selection clicks.

### 3.7 `GameUI`, `StoryIntro`, & `ModalDialog`
- **`GameUI`**: Binds the game state to DOM elements, updating the top banner, turn counters, detailed unit inspection panel (armor, movement, reach, weapon data, crew quality, morale), and the combat event log.
- **`StoryIntro`**: Renders an immersive military CRT terminal briefing with animated typewriter character pauses (with reduced-motion accessibility support).
- **`ModalDialog`**: Accessible modal overlay for pre-battle briefings, faction selection, and post-battle strategic aftermath reports.

---

## 5. Game Mechanics & Simulation Rules

### 5.1 Turn Sequence
1. **Turn Start**: Action points (`movementPoints = unit.movement`) reset; flags `hasMoved` and `hasFired` reset to `false`.
2. **Turn Events**: Scenario-level triggers checked (e.g., scheduled Air Support strikes on Turn 3).
3. **Player / AI Action Phase**: Units move and/or attack according to their allowance.
4. **End Turn**: Turn cycles to the next faction in `scenario.turnOrder`. When a full round completes, the global `turn` counter increments.
5. **Win Check**: Victory conditions evaluated after every movement, attack, or turn change.

### 5.2 Movement & Pathfinding
- Movement is calculated via a modified Dijkstra's search algorithm (`buildMovementMap`) considering accumulated terrain costs.
- Terrain movement costs are defined per terrain type:
  - Road / Highway: `0.5` MP (bonus speed)
  - Open Desert / Plain: `1.0` MP
  - Irrigated Field: `1.2` MP
  - Urban / Trench: `1.5` MP
  - Missile Crater: `2.0` MP
  - Canal: `Infinity` (impassable unless crossing via Bridge: `0.5` MP)
- Units cannot move through hexes occupied by other living units (friendly or enemy).
- Units can execute multiple partial moves in a single turn until their movement points are exhausted.
- Directional facing automatically updates to point toward the final step in the path.

### 5.3 Combat & Ballistics Model

Combat resolution follows a four-step simulation pipeline:

#### 1. Range & Line-of-Sight Check
$$\text{distanceMeters} = \text{hexDistance} \times \text{metersPerHex}$$
$$\text{In Range} \iff \text{distanceMeters} \le \min(\text{weapon.maxRangeMeters}, \text{environment.visibilityMeters})$$

#### 2. Accuracy Determination
Base accuracy depends on whether the target is within optimal engagement range:
$$\text{base} = \begin{cases} \text{weapon.baseAccuracy} & \text{if } \text{distanceMeters} \le \text{weapon.optimalRangeMeters} \\ \text{weapon.longRangeAccuracy} & \text{otherwise} \end{cases}$$

Modifiers are applied multiplicatively and additively:
$$\text{Accuracy} = \text{base} \times \text{crewSkill} \times \text{morale}$$
- **Fire-on-the-Move Penalty**: If the attacker has moved this turn, accuracy is multiplied by $0.82$ ($18\%$ penalty).
- **Crosswind Penalty**: If $\text{distanceMeters} > \text{crosswindPenaltyBeyondMeters}$, multiplied by $\text{crosswindAccuracyModifier}$ (e.g., $0.95$).
- **Defensive Cover**: Subtracted by $\text{terrain.defense} \times 0.10$ (e.g., Urban or Trench with +2 defense reduces hit chance by $20\%$).
- Clamped between $5\%$ and $95\%$.

#### 3. Armor Penetration Roll
If an attack hits ($\text{random}() \le \text{Accuracy}$):
$$\text{margin} = \text{weapon.penetration} - \text{target.armor}$$
$$\text{Penetration Chance} = \text{clamp}(0.20, \, 0.90, \, 0.55 + \text{margin} \times 0.12)$$

#### 4. Damage Allocation
- **Penetrating Hit**:
  $$\text{Damage} = \max(1, \, 3 + \text{margin} + \lfloor\text{random}() \times 3\rfloor)$$
- **Non-Penetrating Hit (Armor Held)**: Deals exactly $1$ point of concussion / surface damage.
- **Miss**: $0$ damage.

---

## 6. Scenario Schema Reference

A scenario file registers an object into `window.SCENARIOS`:

```javascript
window.SCENARIOS.myScenario = {
  id: 'my-scenario-id',
  title: 'Scenario Title',
  kicker: 'Subtitle or Region',
  turnSeconds: 30,
  turnLimit: 14,
  map: {
    columns: 52,
    rows: 32,
    hexSize: 30,          // Radius in pixels
    metersPerHex: 100,    // Tactical ground scale
    width: 2800,          // Canvas rendering width in px
    height: 1500          // Canvas rendering height in px
  },
  environment: {
    visibilityMeters: 3500,
    crosswindMps: 5,
    crosswindPenaltyBeyondMeters: 2200,
    crosswindAccuracyModifier: 0.95
  },
  assets: {
    baseTerrain: 'assets/imgs/hex-desert-terrain.jpg',
    explosion: 'assets/imgs/dmg_explosion.png',
    terrain: { urban: 'assets/svg/urban.svg', /* ... */ },
    units: { abrams: 'assets/imgs/abrams.png', /* ... */ },
    effects: { apache: 'assets/imgs/apaches_flying_in_formation.png' }
  },
  airSupport: {
    id: 'apache-cas',
    faction: 'US',
    turn: 3,
    image: 'apache',
    durationMs: 6500,
    strikes: 3,
    baseHitChance: 0.76,
    airDefenseModifier: 0.62,
    minimumDamage: 4,
    maximumDamage: 7
  },
  factions: {
    US: { name: 'U.S.', victoryName: 'USA', color: '#55aaff', turnMessage: '...' },
    OPFOR: { name: 'Opposing Force', victoryName: 'OPFOR', color: '#d94b42', turnMessage: '...' }
  },
  turnOrder: ['US', 'OPFOR'],
  ai: {
    OPFOR: { strategy: 'defensive-fire' }
  },
  terrainTypes: {
    urban: { label: 'Urban blocks', movementCost: 1.5, defense: 2 }
  },
  terrain: {
    urban: [[43, 2], [43, 3], /* [q, r] axial coordinates */]
  },
  objectives: [
    { name: 'Bridgehead', q: 26, r: 15 }
  ],
  unitTypes: {
    abrams: {
      name: 'M1A1 Abrams',
      image: 'abrams',
      health: 12,
      armor: 10,
      movement: 5,
      weapon: {
        name: '120 mm M256',
        maxRangeMeters: 3000,
        optimalRangeMeters: 2000,
        baseAccuracy: 0.84,
        longRangeAccuracy: 0.60,
        penetration: 11,
        stationaryOnly: false
      }
    }
  },
  units: [
    {
      id: 'SABER-1',
      faction: 'US',
      type: 'abrams',
      q: 4,
      r: 7,
      crewSkill: 1.06,
      morale: 0.84,
      facing: 0
    }
  ],
  intro: { title: '...', paragraphs: ['...'] },
  briefing: { dateLine: '...', situation: '...', sides: { US: '...', OPFOR: '...' } },
  outcomes: {
    US: { headline: '...', next: '...', internationalReaction: '...' }
  },
  determineWinner(game) { /* returns faction id or null */ },
  victoryMessage(winner) { /* returns summary string */ }
};
```

---

## 7. How to Run & Developer Workflow

### 6.1 Recommended Local Server Setup
When developing across Windows and WSL, **avoid opening files directly via `file:///`** or Windows Explorer network paths (`\\wsl$\...`), as this introduces latency and permission restrictions on asset fetching.

Run a lightweight HTTP server inside WSL:
```bash
# Using Python 3 (built-in):
python3 -m http.server 8000

# Or using Node:
npx serve .
```
Then navigate in your Windows browser to:
```
http://localhost:8000
```

### 6.2 URL Query Parameters
The engine supports direct routing and testing via query parameters:
- `?scenario=<scenario-id>`: Loads a specific scenario registered in `window.SCENARIOS` (e.g. `?scenario=bite-the-dust`).
- `?side=<faction-id>`: Bypasses the briefing side-selection modal and launches directly as that faction (e.g. `?side=US` or `?side=COALITION`).

### 6.3 Browser Console Debugging
When the game is running, the instance is exposed on the global scope:
- `window.game`: The active `HexWarGame` instance.
  - `window.game.units`: Array of all unit objects.
  - `window.game.activeFaction`: Active faction identifier.
  - `window.game.endTurn()`: Force the turn to conclude.
- `window.mapViewport`: The active `MapViewport` controller.

---

## 8. Performance & Optimization Notes

Key factors that contribute to browser lag and interaction delays:

1. **WSL-to-Windows File System Overhead**:
   Accessing files over the Windows 9P network redirector (`\\wsl.localhost\...` or `file://`) adds significant I/O latency on image decoding and asset loads compared to serving over `http://localhost:8000`.
2. **Canvas Clipping Overhead**:
   In `BattlefieldRenderer.drawCell`, the engine currently executes `ctx.save()`, `ctx.clip()`, and `ctx.restore()` for every single cell on the board ($52 \times 32 = 1,664$ hexes per redraw). Clipping is one of the most GPU/CPU-intensive Canvas operations. Pre-rendering the static terrain to an offscreen buffer resolves this completely.
3. **Linear Search in Click Coordinates**:
   `HexGrid.closestCell(x, y)` iterates through all $1,664$ cells with `Math.hypot` on every click or cursor event instead of converting $(x, y)$ directly to fractional axial coordinates using closed-form hex formulas.
4. **Pointer Capture Click Suppression**:
   In `MapViewport`, small pointer drags can set `suppressNextClick = true` which temporarily blocks click events on units if a click has slight mouse movement ($> 5\text{px}$).
