# Scenario authoring

The engine is scenario-driven. Generic rules and rendering live in `src/hex-war-engine.js`; battle-specific content lives in `scenarios/`.

## Create another scenario

1. Copy `scenarios/bite-the-dust.js` to a new file.
2. Change its registry key, metadata, map, assets, factions, terrain, objectives, unit types, and units.
3. Implement `determineWinner(game)` and `victoryMessage(winner)` for the new mission.
4. Load the new file in `index.html` and select its registry key in `src/main.js`.

Scenario coordinates use axial hex coordinates (`q`, `r`). Terrain placement uses compact `[q, r]` pairs. Distances, movement, range, drawing, selection, combat, turns, effects, and UI updates are provided by the engine.

### Scale & Unit Echelons
- **1 Hex = 50 meters** center-to-center ground distance ($2,165.06\text{ m}^2$ or $\sim 0.217\text{ ha}$).
- **1 Unit Counter = 1 Individual Vehicle or 1 Infantry Squad/Team**:
  - **AFV**: 1 single tank or IFV (e.g. M1A1 Abrams MBT, M2A2 Bradley IFV, ZTZ-99A MBT, ZBD-04 IFV).
  - **Infantry**: 1 rifle squad (e.g. 9 soldiers) or 1 specialized crew (e.g. 4-man IRGC ATGM team).
- **Tactical Hex Footprint**: A modern armored vehicle (~7–10 m length, 3.5 m width) operates within a 50 m hex with authentic spacing for tactical dispersion, turret traverse clearance, hull-down berm positioning, and local terrain masking.
- **Unit Definition Fields**:
  - `unitClass`: `'afv'` or `'infantry'`.
  - `armorAspect`: `{ front, side, rear, top }` directional RHAe defense values.
  - `subsystems`: `{ tracks: 'operational', engine: 'operational', optics: 'operational', gun: 'operational' }`.
  - `soldiers`: Number of surviving squad members (infantry only; controls visual badge and suppression).
  - `company`, `platoon`, `role`, `isLeader`, `commandRadius`: Command & control hierarchy for C2 tethering.
  - `weapons`: Array of weapon keys (e.g. `['m256_120', 'm240_coax']`) defined in `src/weapons-data.js`.

Weapon ranges are stored in meters and converted to hexes by the engine. A weapon may define `optimalRangeMeters`, `maxRangeMeters`, close/long-range accuracy, penetration, and `stationaryOnly`. Units separately define armor, health, mobility, and crew quality. Scenario-wide visibility and crosswind settings belong in `environment`.

`movement` is a per-turn movement-point allowance. Terrain consumes its configured `movementCost`, and units may move repeatedly until their points are gone.

## Single-player AI

Each faction may select a reusable strategy under `scenario.ai`:

- `defensive-fire` holds position and prioritizes vulnerable, high-value targets in range.
- `breakthrough` fires when useful and spends movement points toward objectives or a configured `goalColumn`.

The human-controlled faction is passed to `HexWarGame` as `playerFaction`. AI timing and turn ownership are handled by `TacticalAI`; scenario files only choose strategies and goals.

## Extension points

- Add reusable rules to `HexWarGame`, not to a scenario file.
- Add reusable visuals to `BattlefieldRenderer`.
- Keep unit balance and asset paths inside each scenario.
- Inject `{ random }` into `HexWarGame` for deterministic combat tests.
- Use `window.game` in browser developer tools to inspect live state.

The current movement model charges terrain cost for the destination cell. A future pathfinding system can replace `reachableCells()` without changing scenario data.
