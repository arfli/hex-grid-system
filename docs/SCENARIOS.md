# Scenario authoring

The engine is scenario-driven. Generic rules and rendering live in `src/hex-war-engine.js`; battle-specific content lives in `scenarios/`.

## Create another scenario

1. Copy `scenarios/dust-line.js` to a new file.
2. Change its registry key, metadata, map, assets, factions, terrain, objectives, unit types, and units.
3. Implement `determineWinner(game)` and `victoryMessage(winner)` for the new mission.
4. Load the new file in `index.html` and select its registry key in `src/main.js`.

Scenario coordinates use axial hex coordinates (`q`, `r`). Terrain placement uses compact `[q, r]` pairs. Distances, movement, range, drawing, selection, combat, turns, effects, and UI updates are provided by the engine.

### Scale & Unit Echelons
- **1 Hex = 100 meters** center-to-center ($8,660.25\text{ m}^2$ or $\sim 0.866\text{ ha}$).
- **1 Unit Counter = 1 Platoon** (e.g., Tank Platoon of 3–4 MBTs, Mechanized Platoon of 3–4 IFVs + dismounts, ATGM Battery of 3–4 missile posts, or Infantry Platoon of 30–40 riflemen).
- **Player Command Scope**: A company-sized vanguard / battalion combat team (e.g., 7 platoons representing ~28 combat vehicles) serving as the spearhead of a larger armored regiment.
- **Platoon Frontage**: Fits within the $100\text{ m}$ hex diameter, reflecting realistic doctrinal tactical frontage and dispersion.

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
