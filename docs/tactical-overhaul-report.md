# Tactical Overhaul Report: Steel Panthers × Armored Brigade Engine
**Transitioning to Granular Units, Directional Armor, Subsystem Simulation, and In-Engine Tooling**

**Date:** October 31, 2026  
**Status:** Completed & Verified  
**File:** `docs/tactical-overhaul-report.md`

---

## 1. Executive Summary

This report documents the architectural overhaul of the Hex War Engine, completing the departure from legacy abstract spreadsheet mechanics toward a modern tactical simulation combining:
1. The **clarity, command pacing, and sandbox freedom** of turn-based hex warfare (Steel Panthers style).
2. The **visual precision, ballistics, and deep component damage** of modern tactical simulators (Armored Brigade style).

All four planned phases—**Unit Granularity Refactor**, **Subsystem & Aspect Armor Data Schema**, **Tactical GIS Map Renderer**, and **Scenario & Force Builder Tooling**—have been implemented and verified.

---

## 2. Key Architecture Pillars Delivered

### 2.1 Pillar 1: Unit Granularity & Authentic Order of Battle (OOB)
* **1 Counter = 1 Entity:** Counters no longer represent abstract 4-vehicle platoons. Each counter is now **one physical vehicle** (e.g. single M1A1 Abrams MBT, M2A2 Bradley IFV, ZTZ-99A MBT) or **one infantry squad / weapons team** (e.g. 9-soldier Volunteer squad, 4-soldier IRGC ATGM team).
* **Military Hierarchy:** Units are structured into realistic parent formations:
  - **US Task Force 1-64 Armor:** 1st Platoon (Saber-1 Platoon Leader, Saber-2, Saber-3 Platoon Sergeant, Saber-4).
  - **US Task Force 3-15 Infantry:** 2nd Mech Platoon (Ranger-1 Mech Platoon Leader, Ranger-2, Ranger-3).
  - **Coalition 124th Armored Brigade:** 1st Armored Platoon (Dragon-1 Platoon Leader, Dragon-2, Dragon-3, Dragon-4) and 2nd Mech Platoon (Jade-1 Platoon Leader, Jade-2).
  - **Coalition Defense Forces:** 3rd ATGM Defense Section (IRGC-1 Section Leader, IRGC-2, IRGC-3, IRGC-4) and 1st Volunteer Detachment (Vol-1 Squad Leader, Vol-2, Vol-3).
* **Command & Control (C2) Radius:** Platoon Leaders project a command radius (6–8 hexes = 600–800 m). Units in range maintain an active C2 link; units beyond range suffer out-of-command status (-10% accuracy penalty and slower suppression recovery).

### 2.2 Pillar 2: Directional Aspect Armor & Subsystem Component Simulation
* **Aspect Angle Detection:** Incoming fire calculates the relative angle between the projectile trajectory and the target's world facing:
  - **Front Aspect ($|\Delta\theta| \le 45^\circ$):** Heavy frontal glacis/turret armor.
  - **Rear Aspect ($|\Delta\theta| \ge 135^\circ$):** Thin rear engine deck/hull armor.
  - **Side Aspect ($45^\circ < |\Delta\theta| < 135^\circ$):** Flank armor.
  *Example:* An M1A1 Abrams front armor (10) vs. rear armor (4) enables realistic flanking tactics.
* **Vehicle Subsystem Damage:** Penetrating hits trigger critical component damage checks:
  - **Tracks:** `mobility_kill` (movement points set to 0; vehicle cannot move).
  - **Engine:** `damaged` (movement points halved; movement cost increased by 50%).
  - **Optics / FCS:** `damaged` (-25% base accuracy penalty).
  - **Main Gun:** `damaged` (-35% gun traverse penalty).
* **Infantry Squad Dynamics:**
  - **Soldier Headcount:** Squads track active personnel (e.g. 9 soldiers $\rightarrow$ 6 $\rightarrow$ 3).
  - **Suppression Meter:** Direct hits and near-misses build suppression (0.0 to 1.0):
    - $\ge 0.35$: Suppressed (-20% to -45% accuracy penalty).
    - $\ge 0.70$: Pinned (cannot move or retreat out of hex).
    - Rallies each turn: -35% suppression if in command, -15% if severed from C2.

### 2.3 Pillar 3: Tactical GIS Map Renderer
* **Topographic Elevation Contours:** Elevation contours (`+10m`, `+15m`, `+20m`) and military coordinate tick marks (`GR 120 // LN 80`) baked directly onto the map.
* **Tactical Datalinks (C2 Tethers):** Renders glowing dashed datalink lines between platoon members and their Platoon Leader. Active links render in faction blue/red; severed links render in muted amber.
* **Weapon Engagement Envelopes:** Selecting a unit renders its forward engagement cone with max range arcs and optimal engagement cones.
* **Tactical Status Badges:** Rendered above/below the counter:
  - `[MOB-KILL]`, `[ENG]`, `[OPT]`, `[GUN]` for vehicle subsystems.
  - `[PINNED]`, `[SUPPR]`, and soldier count (`9/9 SOL`) for infantry squads.
  - `[!C2]` for severed command links.

### 2.4 Pillar 4: Force Builder & Order of Battle (OOB) Tooling
* **Order of Battle Tree (`btnOob`):** In-game modal displaying the full military hierarchy (Task Force $\rightarrow$ Companies $\rightarrow$ Platoons $\rightarrow$ Individual Units). Shows live health bars, C2 link status, subsystem damage, and soldier counts.
* **Force & Battlefield Builder (`btnForceBuilder`):** Sandbox configuration modal allowing live customization of:
  - Turn limits (10, 14, 20 turns).
  - Weather & visibility (Clear 3500m, Dust Storm 2200m, Night 1500m).
  - Crosswind severity (Light 5 m/s vs. High Gale 12 m/s).
  - Apache CAS sorties (0, 3, 5 Hellfire missile strikes).

---

## 3. Modified & Created Files Summary

| File | Type | Changes |
| :--- | :--- | :--- |
| `scenarios/bite-the-dust.js` | Scenario Data | Updated `unitTypes` to individual vehicle/squad definitions with `armorAspect` and soldier counts; structured all 20 units into companies and platoons with designated leaders. |
| `src/hex-war-engine.js` | Core Engine | Added aspect-angle geometry, subsystem component damage, suppression tracking, C2 command radius, topographic GIS baking, datalink tethers, engagement envelopes, and OOB/Builder modals. |
| `index.html` | Interface | Added `btnOob` ("OOB Tree") and `btnForceBuilder` ("Force Builder") header controls. |
| `styles.css` | Stylesheet | Added button styling for header tools and OOB tree hierarchy display. |
| `src/main.js` | Web Application | Attached event listeners for the OOB Tree and Force Builder modal dialogs. |
| `docs/brainstorm-sessions/steel-panthers-x-armored-brigade-vision.md` | Vision Doc | Purged legacy wargame references; updated with the completed 4-pillar tactical architecture. |
| `docs/tactical-overhaul-report.md` | Report Doc | This document. |

---

## 4. Verification & Testing

The overhaul was verified using automated Node.js test scripts simulating headless execution and animated gameplay:
1. **Unit & OOB Integrity:** Confirmed all 20 units correctly inherit individual classes, aspect armor matrices (`front`, `side`, `rear`, `top`), subsystem objects, soldier headcounts, and platoon leadership links.
2. **C2 Command Tethers:** Verified that units within command radius report `isInCommand: true`, while severed units correctly report `isInCommand: false` and receive the -10% accuracy penalty.
3. **Aspect Angle Combat:** Confirmed that frontal attacks evaluate against frontal armor, while flank and rear attacks dynamically match side and rear armor ratings.
4. **Subsystem Critical Hits:** Verified that penetrating hits roll for subsystem damage (tracks mobility kill, engine damage, optics blinding, gun damage) and log them cleanly in the battle feed.
5. **Modal Tooling:** Confirmed that `showOrderOfBattleModal()` and `showForceBuilderModal()` open cleanly through the engine's `ModalDialog` component without throwing errors.

---

> [!NOTE]
> *The Hex War Engine now operates as a complete, modern tactical turn-based wargame embodying the deep physical simulation of Armored Brigade while preserving the clarity and strategic command of turn-based hex warfare.*

