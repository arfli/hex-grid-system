# Scenario authoring

The engine is scenario-driven. Generic rules and rendering live in `src/hex-war-engine.js`; battle-specific content lives in `scenarios/`.

## Create another scenario

1. Copy `scenarios/dust-line.js` to a new file.
2. Change its registry key, metadata, map, assets, factions, terrain, objectives, unit types, and units.
3. Implement `determineWinner(game)` and `victoryMessage(winner)` for the new mission.
4. Load the new file in `index.html` and select its registry key in `src/main.js`.

Scenario coordinates use axial hex coordinates (`q`, `r`). Terrain placement uses compact `[q, r]` pairs. Distances, movement, range, drawing, selection, combat, turns, effects, and UI updates are provided by the engine.

Weapon ranges are stored in meters and converted to hexes by the engine. A weapon may define `optimalRangeMeters`, `maxRangeMeters`, close/long-range accuracy, penetration, and `stationaryOnly`. Units separately define armor, health, mobility, and crew quality. Scenario-wide visibility and crosswind settings belong in `environment`.

`movement` is a per-turn movement-point allowance. Terrain consumes its configured `movementCost`, and units may move repeatedly until their points are gone.

## Extension points

- Add reusable rules to `HexWarGame`, not to a scenario file.
- Add reusable visuals to `BattlefieldRenderer`.
- Keep unit balance and asset paths inside each scenario.
- Inject `{ random }` into `HexWarGame` for deterministic combat tests.
- Use `window.game` in browser developer tools to inspect live state.

The current movement model charges terrain cost for the destination cell. A future pathfinding system can replace `reachableCells()` without changing scenario data.
