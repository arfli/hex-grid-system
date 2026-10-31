# Hex War Engine — Technical Documentation & Architecture Guide

A modular, scenario-driven tactical wargame engine built with vanilla ES6 JavaScript and HTML5 Canvas. The engine simulates turn-based combined-arms combat on a hexagonal grid with realistic ballistics, terrain modifiers, unit morale, and tactical AI.

---

## 1. System Overview

### Core Principles
- **Scenario-Driven Architecture**: Generic game rules, mathematical models, AI behaviors, and rendering logic live in the core engine (`src/hex-war-engine.js`), while all battle parameters, rosters, terrain layouts, and win conditions are defined in scenario definitions (`scenarios/*.js`).
- **Standard Military Ground Scale**: 
  - **1 Hex = 50 meters** center-to-center ground distance (configurable via `map.metersPerHex`).
  - Unit weapons use real-world ballistic ranges (e.g., 3,000 m for tank main guns, 3,750 m for ATGMs, 600 m for squad small arms).
  - One unit counter represents an **individual vehicle** (1 MBT / 1 IFV) or an **individual infantry squad / weapon team** (1 rifle squad / 1 ATGM crew), eliminating artificial death-stacks and preserving authentic tactical dispersion.
  - One turn represents approximately 30 seconds of tactical combat.
- **Zero External Dependencies**: Pure vanilla JavaScript, standard Web APIs (2D Canvas, Pointer Events, DOM), and zero build step or npm bundle requirement.

---

## 2. Scale & Military Echelon Reference

### 2.1 What 1 Hex Represents (Geometry & Square Meters)

The engine models pointy-topped regular hexagons configured through `map.metersPerHex` (default: **50 meters**).

In hexagonal wargames and within `HexGrid.distance(a, b)`:
- **Center-to-Center Distance**: Moving between two adjacent hex centers equals exactly **$50\text{ meters}$**.
- **Flat-to-Flat Width ($W$)**: $50\text{ meters}$ (the diameter between opposite parallel edges).
- **Apothem / Inradius ($r$)**: Distance from the center to any edge midpoint is $r = \frac{W}{2} = 25\text{ meters}$.
- **Side Length ($s$) & Circumradius ($R$)**:
  $$R = s = \frac{W}{\sqrt{3}} = \frac{50}{\sqrt{3}} \approx 28.868\text{ meters}$$
- **Vertex-to-Vertex Diameter ($2R$)**: $\approx 57.735\text{ meters}$.

#### Exact Area Calculation:
The ground footprint of a single regular hex is:
$$\text{Area} = 2\sqrt{3} \times r^2 = 2\sqrt{3} \times (25\text{ m})^2 = 1250\sqrt{3} \approx \mathbf{2{,}165.06\text{ m}^2}$$

In practical units:
- **$\approx 2{,}165\text{ square meters}$**
- **$\approx 0.217\text{ hectares}$**
- **$\approx 0.535\text{ acres}$**

#### Tactical Ground Truth: Why 50m Fits 1 Armored Vehicle:
- A modern armored combat vehicle (e.g. M1A1 Abrams MBT: $\sim 9.8\text{ m}$ length with gun forward, $3.66\text{ m}$ hull width; ZTZ-99A: $\sim 10\text{ m}$ length, $3.5\text{ m}$ width) occupies a physical vehicle footprint of approximately $35\text{ m}^2$.
- In tactical doctrine (*Steel Panthers*, *Armored Brigade*), an armored vehicle does not operate in isolation on a point; it requires:
  1. **Immediate Maneuver Box**: Cross-country maneuvering, neutral hull turning, and reversing into cover.
  2. **Turret Traverse Arc & Stand-off**: 360° main gun traverse radius without clipping vegetation, structures, or friendly vehicles.
  3. **Hull-Down Berm Clearance & Defilade**: Concealment behind terrain crests, road embankments, and earth revetments.
  4. **Standoff & Spacing**: Safety radius from secondary blast, spall, and ammunition cook-off.
- At $100\text{ m}$ per hex ($8,660\text{ m}^2$ or nearly $1\text{ hectare}$), a single vehicle occupying an entire hex was unrealistically cavernous. A **$50\text{ m}$ hex ($2,165\text{ m}^2$)** provides the exact operational maneuver envelope for a single armored vehicle or a dispersed 9-soldier infantry squad.

#### Total Battlefield Dimensions:
In the standard scenario (`columns: 68, rows: 38` at $50\text{ m/hex}$):
- **Map Width**: $68 \times 50\text{ m} = \mathbf{3.4\text{ km}}$
- **Map Height**: $38 \times 50\text{ m} = \mathbf{1.9\text{ km}}$
- **Total Engagement Envelope**: $3.4\text{ km} \times 1.9\text{ km} = \mathbf{6.46\text{ km}^2}$ ($646\text{ hectares}$ across 2,584 hexes).

---

### 2.2 What 1 Unit Counter Represents (Tactical Scale: 1 Counter = 1 Vehicle or 1 Squad)

Following the *Steel Panthers* and *Armored Brigade* combined-arms design model, each unit counter represents **1 Individual Vehicle** or **1 Infantry Squad / Weapon Team**:

| Counter Type | Unit Scale | Tactical Role | Example in Code | Crew / Manpower |
| :--- | :--- | :--- | :--- | :--- |
| **Main Battle Tank (MBT)** | **1 Individual Tank** | Heavy breakthrough, direct kinetic/chemical fire | `SABER-1` (Plt Leader), `DRAGON-1` | 4 crewmen |
| **Infantry Fighting Vehicle (IFV)** | **1 Individual IFV** | Troop transport, autocannon & ATGM fire | `RANGER-1` (Mech Leader), `JADE-1` | 3 crewmen (+ dismount section) |
| **ATGM Team** | **1 Weapon Section / Team** | Fortified long-range guided missile defense | `IRGC-1` (Section Leader, Dehlavieh) | 4 crewmen |
| **Volunteer Squad** | **1 Infantry Squad** | Close-range defense, urban & trench combat | `VOL-1` (Squad Leader), `VOL-2` | 9 soldiers |

#### Tactical Architecture & Mechanics:
- **Directional Aspect Armor**: Each vehicle has explicit RHAe armor ratings across four headings: `front`, `side`, `rear`, and `top`. Incoming attacks dynamically calculate the relative impact angle to test against the corresponding armor aspect.
- **Granular Subsystem Damage**: Penetrating and high-explosive hits can critically damage individual subsystems:
  - `tracks`: Immobilizes the vehicle (`movement = 0`).
  - `engine`: Cuts vehicle mobility in half.
  - `optics`: Reduces targeting accuracy by 25%.
  - `gun`: Traverses jammed or barrel compromised; reduces accuracy by 35%.
- **Infantry Soldier Tracking & Suppression**:
  - Infantry squads track living soldier counts (e.g. 9 soldiers for `VOL`, 4 for `IRGC`).
  - Incoming fire accumulates suppression on a 0.0–1.0 scale:
    - `Suppression > 0.6` $\rightarrow$ **SUPPRESSED** (degraded accuracy, cannot advance).
    - `Suppression > 0.85` $\rightarrow$ **PINNED** (completely immobilized, zero offensive fire).
- **Command & Control (C2) Datalink Network**:
  - Platoon and section leaders (`isLeader: true`) project an authentic `commandRadius` (6–8 hexes).
  - Wingmen and subordinate squads maintain visual C2 datalink lines with their leader.
  - Units outside command radius suffer morale degradation, slower rally from suppression, and a 10% accuracy penalty.
- **Player Command Scope (Task Force Echelon)**:
  - The player commands a **Combined-Arms Task Force Vanguard**:
    - **U.S. Spearhead (18 counters)**: 8× M1A1 Abrams MBTs (Saber & Dagger platoons), 8× M2A2 Bradleys (Ranger & Ghost platoons), 2× Bradley Scouts.
    - **Coalition Defense (24 counters)**: 8× ZTZ-99A MBTs (Dragon & Tiger platoons), 4× ZBD-04 IFVs (Jade platoon), 6× IRGC ATGM teams, 6× Volunteer rifle squads.

---

## 3. Project Directory Structure

```
hex-grid-system/
├── index.html               # Main entrypoint: UI layout, canvas, modal dialogs, and HUD
├── styles.css               # Styling for tactical terminal HUD, OOB inspector, and dialogs
├── src/
│   ├── weapons-data.js      # AMMO_TYPES and WEAPONS ballistic tables and tracer styles
│   ├── hex-war-engine.js    # Core wargame engine: geometry, AI, OOB, subsystems, renderer
│   └── main.js              # Application bootstrapper, query param routing, scenario mounting
├── scenarios/
│   └── bite-the-dust.js     # Scenario: Battle on western approaches to Ahvaz (68x38 grid, 50m/hex)
├── svg/                     # Original top-down tactical unit sprites (US infantry single/squad/snow)
├── docs/
│   ├── DOCS.md              # Core system and architecture documentation (this file)
│   ├── SCENARIOS.md         # Guide for authoring custom scenarios
│   ├── unit-weapons-audit.md # Weapons loadout audit and ballistic reference
│   └── tactical-overhaul-report.md # Report on individual vehicle & subsystem tactical overhaul
├── TODO.md                  # Master project roadmap and backlog
└── assets/
    ├── imgs/                # Vehicle sprites, background textures, effects, explosions
    ├── svg/                 # Terrain overlay SVGs and legacy counter icons
    └── audio/               # SFX audio tracks (engines, weapons fire)
```

---

## 4. Architecture & Engine Components

The engine is encapsulated under the global namespace `window.HexWar` and composed of modular, decoupled classes:

### 4.1 `HexGrid`
Handles axial coordinate mathematics, distance calculations, neighbor lookups, and screen-space conversions:
- **Coordinate System**: Pointy-topped axial coordinates $(q, r)$, derived from rectangular grid columns and rows:
  $$q = \text{column} - \lfloor \text{row} / 2 \rfloor, \quad r = \text{row}$$
- **Hex Distance**: Standard Hexagonal Manhattan metric:
  $$\text{dist}(a, b) = \frac{|a.q - b.q| + |a.q + a.r - b.q - b.r| + |a.r - b.r|}{2}$$
- **Pixel Projection**:
  $$x = \text{origin.x} + \text{hexSize} \times \sqrt{3} \times (q + r / 2)$$
  $$y = \text{origin.y} + \text{hexSize} \times 1.5 \times r$$
- **Closest Cell Lookup**: Converts screen coordinates $(x, y)$ to nearest axial hex center with closed-form bounding math.

### 4.2 `AssetStore`
Asynchronously preloads image assets required by the scenario (`baseTerrain`, `explosion`, terrain decals, unit sprites, and air support models). Invokes an `onLoad` callback on completion of each asset to trigger canvas repaints.

### 4.3 `BattlefieldRenderer`
Renders tactical elements to the HTML5 Canvas with modern Armored Brigade-style military cartography:
1. **Offscreen Terrain Caching (`cachedTerrainCanvas`)**: Bakes static terrain textures, roads, canals, bridges, urban blocks, and trenches into an offscreen buffer at devicePixelRatio resolution once, blitting in a single `drawImage` call for sustained 60fps performance.
2. **Topographic Elevation Contours**: Stylized concentric contour bands and military elevation badges indicating local terrain height.
3. **Military Grid Reference System (MGRS) Ticks**: Edge grid coordinate indicators along board margins.
4. **C2 Datalink Overlays**: Glowing tactical tether lines connecting subordinate vehicles and squads to their designated platoon leaders.
5. **Dynamic Weapon Engagement Envelopes**: Dashed range rings illustrating primary gun reach and optimal engagement envelopes.
6. **Tactical Counter Badges**: Subsystem damage indicators (`TRK`, `ENG`, `OPT`, `GUN`), infantry soldier headcount badges, and suppression tags (`PINNED`, `SUPPR`).
7. **Ballistic Projectile & Tracer FX**: High-speed animated tracer streaks tailored per ammunition type (APFSDS, HEAT, ATGM, HE-FRAG, Autocannon, Machine Gun) with realistic muzzle flashes and impact smoke.

### 4.4 `HexWarGame`
The central state machine and coordinator:
- Manages game state (`activeFaction`, `turn`, `selected`, `gameOver`, `livingUnits`).
- Runs pathfinding and multi-step movement execution with easing and facing rotation.
- Evaluates directional aspect armor, ballistic penetration, subsystem damage rolls, and suppression accumulation.
- Coordinates turn progression, automated AI scheduling, C2 status evaluation, and victory checks (`determineWinner()`).

### 4.5 `TacticalAI`
Autonomous decision-making engine for computer-controlled factions:
- **`defensive-fire`**: Identifies highest-threat, high-vulnerability targets within firing range and executes defensive fire while maintaining fortified positions.
- **`breakthrough`**: Prioritizes attacking vulnerable targets, evaluates the optimal advance hex toward scenario objectives or target columns using Dijkstra movement maps, moves the unit, and conducts follow-up strikes if the unit's weapon allows firing on the move.

### 4.6 `MapViewport`
Provides interactive navigation over large battlefield maps:
- Smooth drag-and-drop panning with pointer capture.
- Zoom slider and `Ctrl + Wheel` zooming centered on the mouse position.
- "Fit Map" viewport calculation to frame the entire engagement area.

### 4.7 Tactical Modals (`OOB Tree` & `Force Builder`)
- **OOB Tree Inspector (`btnOob`)**: Interactive hierarchical military tree modal visualizing Company $\rightarrow$ Platoon $\rightarrow$ Individual Vehicle / Squad status, leader tethers, and readiness.
- **Force Builder (`btnForceBuilder`)**: In-engine tactical scenario draft tool for custom force ratios, unit rosters, and environmental parameters.

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

#### 3. Directional Aspect Armor Roll
Incoming fire does not hit a generic armor rating. Instead, the engine dynamically calculates the projectile's relative impact angle $\theta$ against the target's current facing:
$$\theta = \text{wrapToPi}(\text{atan2}(y_{\text{att}} - y_{\text{tgt}}, \, x_{\text{att}} - x_{\text{tgt}}) - \text{target.facing})$$
$$\text{Aspect Hit} = \begin{cases} \mathbf{front} & \text{if } |\theta| \le 45^\circ \\ \mathbf{side} & \text{if } 45^\circ < |\theta| \le 135^\circ \\ \mathbf{rear} & \text{if } |\theta| > 135^\circ \end{cases}$$
The effective armor rating is looked up from `target.armorAspect[aspect]` (e.g. M1A1: front 10, side 6, rear 4).

If an attack hits ($\text{random}() \le \text{Accuracy}$):
$$\text{margin} = \text{weapon.penetration} - \text{effectiveArmor}$$
$$\text{Penetration Chance} = \text{clamp}(0.20, \, 0.90, \, 0.55 + \text{margin} \times 0.12)$$

#### 4. Damage Allocation & Subsystem Criticals
- **Penetrating Hit**:
  $$\text{Damage} = \max(1, \, 3 + \text{margin} + \lfloor\text{random}() \times 3\rfloor)$$
  - **Vehicle Subsystem Rolls**: Full penetrations roll for critical component failures:
    - `tracks` damaged: Vehicle completely immobilized (`movement = 0`).
    - `engine` damaged: Mobility permanently reduced by $50\%$.
    - `optics` damaged: Fire control degraded; targeting accuracy reduced by $25\%$.
    - `gun` damaged: Traverse or breech jammed; targeting accuracy reduced by $35\%$.
  - **Infantry Casualties & Suppression**:
    - Reduces surviving soldier headcount (`target.soldiers`).
    - Adds suppression points ($+0.35$ per penetrating hit, $+0.15$ on near-miss concussion).
    - `Suppression > 0.60`: **SUPPRESSED** (accuracy degraded, cannot initiate advance).
    - `Suppression > 0.85`: **PINNED** (completely disabled from movement or fire).
- **Non-Penetrating Hit (Armor Held)**: Deals exactly $1$ point of concussion / spall damage.
- **Miss**: $0$ damage.

#### 5. Ballistic Projectile & Tracer FX
Every attack dispatches an animated projectile tracer whose visual speed, color, geometry, and smoke trail depend on the ammunition type in `src/weapons-data.js`:
- `APFSDS`: Hyper-velocity thin cyan/white kinetic dart with brief fading wake.
- `HEAT` / `RPG`: High-speed bright amber streak with dense smoke particles.
- `ATGM`: Slower rocket missile with exhaust puff particles and wire/guidance flare.
- `HE_FRAG`: Heavy high-arc explosive shell with massive dirt/spall detonation.
- `AUTOCANNON`: Rapid 4-shot pulse stream of glowing yellow/orange tracers.
- `MG_BALL_TRACER`: Sustained 8-shot bullet stream with 1:4 tracer mix.

---

## 6. Scenario Schema Reference

A scenario file registers an object into `window.SCENARIOS`:

```javascript
window.SCENARIOS.myScenario = {
  id: 'my-scenario-id',
  title: 'Scenario Title',
  kicker: 'Subtitle or Region',
  turnSeconds: 30,
  turnLimit: 18,
  map: {
    columns: 68,
    rows: 38,
    hexSize: 30,          // Radius in pixels
    metersPerHex: 50,     // 50 meters ground scale (canonical Steel Panthers scale)
    width: 3700,          // Canvas rendering width in px
    height: 1850          // Canvas rendering height in px
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
    turn: 4,
    image: 'apache',
    durationMs: 6500,
    weapons: ['hellfire_atgm', 'm230_30'],
    strikes: 4,
    baseHitChance: 0.76,
    airDefenseModifier: 0.62,
    minimumDamage: 4,
    maximumDamage: 7
  },
  factions: {
    US: { name: 'U.S.', victoryName: 'USA', color: '#55aaff', turnMessage: '...' },
    COALITION: { name: 'Chinese–Iranian Alliance', victoryName: 'ALLIANCE', color: '#d94b42', turnMessage: '...' }
  },
  turnOrder: ['US', 'COALITION'],
  ai: {
    US: { strategy: 'breakthrough', goalColumn: 60 },
    COALITION: { strategy: 'defensive-fire' }
  },
  terrainTypes: {
    urban: { label: 'Urban blocks', movementCost: 1.5, defense: 2 }
  },
  terrain: {
    urban: [[56, 2], [56, 3], /* [q, r] axial coordinates */]
  },
  objectives: [
    { name: 'Central Highway Junction', q: 52, r: 19 }
  ],
  unitTypes: {
    abrams: {
      name: 'M1A1 Abrams MBT',
      unitClass: 'afv',
      image: 'abrams',
      health: 12,
      armor: 10,
      armorAspect: { front: 10, side: 6, rear: 4, top: 3 },
      movement: 5,
      weapons: ['m256_120', 'm240_coax'],
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
      q: 0,
      r: 8,
      crewSkill: 1.06,
      morale: 0.86,
      facing: 0,
      company: 'A Co, 1-64 AR',
      platoon: '1st Platoon (Saber)',
      role: 'Platoon Leader',
      isLeader: true,
      commandRadius: 7
    }
  ],
  intro: { title: '...', paragraphs: ['...'] },
  briefing: { dateLine: '...', situation: '...', sides: { US: '...', COALITION: '...' } },
  outcomes: {
    US: { headline: '...', next: '...', internationalReaction: '...' }
  },
  determineWinner(game) { /* returns faction id or null */ },
  victoryMessage(winner) { /* returns summary string */ }
};
```
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
