# Hex War Engine — Master Project TODO & Roadmap

This document catalogs all unfinished features, placeholders, planned architectural expansions, and documentation updates identified from skimming the `docs/` folder, codebase audits, and brainstorm sessions.

---

## 1. Weapons & Ammunition Mechanics (Unfinished from Weapons Audit)

### 1.1 Wire Ammo Effectiveness Matrix into Damage Math
- [ ] **Connect `AMMO_TYPES[ammoId].effectiveness` to Combat Resolution**:
  - In `src/weapons-data.js` and `docs/unit-weapons-audit.md`, every ammo type defines an `effectiveness` matrix (`vsArmor`, `vsInfantry`, `vsSoft`, `vsStructure`, `vsAir`) which currently defaults to `1.0` and is flagged as *"NOT wired into combat yet; damage still comes from the unit's existing damage stat"*.
  - Wire this multiplier into `calculateAttackOutcome()` so that:
    - `APFSDS` deals heavy damage to armor (`vsArmor: 1.25`) but overpenetrates infantry (`vsInfantry: 0.35`).
    - `HEAT` / `RPG` deals high damage to light/medium armor and fortifications (`vsArmor: 1.1`, `vsStructure: 1.3`).
    - `HE_FRAG` deals catastrophic area damage against infantry and unarmored targets (`vsInfantry: 1.6`, `vsSoft: 1.5`, `vsArmor: 0.4`).
    - `AUTOCANNON` and `MG_BALL_TRACER` shred soft vehicles and suppressed infantry (`vsInfantry: 1.4`, `vsSoft: 1.3`).

### 1.2 Manual Ammunition & Secondary Weapon Selection
- [ ] **Player Weapon / Ammo Selector in UI**:
  - Currently, weapons and ammo types are selected automatically via heuristic (`getVisualWeaponAndAmmo`).
  - Add UI controls on the Selected Unit card allowing players to manually choose between loaded ammo types (e.g. M1A1 Abrams switching between `APFSDS` and `HEAT`; ZBD-04 choosing between `HE_FRAG` shell or gun-launched `ATGM`).
- [ ] **Independent Secondary Weapon Attacks**:
  - Allow vehicles with coaxial machine guns or secondary autocannons to fire their secondary mount in the same turn, or allocate primary fire against armor and secondary fire against infantry.

### 1.3 Ammunition Capacity & Logistics
- [ ] **Track Ammunition Counts per Vehicle / Squad**:
  - Add ammo capacity counters (e.g. Abrams: 24x APFSDS, 16x HEAT, 10,000 rds 7.62mm; Bradley: 7x TOW-2B, 900 rds 25mm).
  - Deplete ammo count on firing; force reliance on secondary weapons when main gun ammo is exhausted.
  - Optional supply truck / ammo cache replenishment mechanic.

### 1.4 Rate of Fire (RoF) & Multi-Shot Allocation
- [ ] **Integrate `rateOfFire` into Tactical Turn**:
  - `WEAPONS` table defines `rateOfFire: 6`, `rateOfFire: 200`, etc., but units currently only fire once per turn (`hasFired: true`).
  - Allow fast-firing weapons (autocannons, machine guns) to split fire across multiple targets or fire multiple bursts if remaining stationary.

---

## 2. Armor Physics & Advanced Damage Modeling (Armored Brigade Vision)

### 2.1 Kinetic Energy (KE) vs. Chemical Energy (CE) Armor Differentiation
- [ ] **Dual RHAe Armor Envelopes**:
  - Currently `armorAspect` uses a single composite rating (`front`, `side`, `rear`, `top`).
  - Split vehicle armor into **`KE_RHAe`** (protection against kinetic dart penetrators like APFSDS and autocannon APDS) and **`CE_RHAe`** (protection against shaped-charge jets like HEAT, ATGMs, and RPGs).
- [ ] **Explosive Reactive Armor (ERA) & Slat Armor Degradation**:
  - Add ERA tile blocks to vehicles like ZTZ-99A and T-72/T-90.
  - First CE hit detonates ERA tile, negating or reducing shaped-charge penetration, but strips ERA protection from that aspect for subsequent hits.
- [ ] **Active Protection Systems (APS)**:
  - Model hardkill APS countermeasure charges (e.g. Trophy, Arena) intercepting incoming ATGMs and RPGs on an arc check with finite reload charges.

### 2.2 Advanced Subsystem & Crew Casualties
- [ ] **Turret Ring Traverse Jamming**:
  - When turret ring is damaged, lock turret to current facing or restrict traverse to 1 hex-face per turn.
- [ ] **Ammunition Rack Cook-Off vs. Blowout Panels**:
  - Full penetration into ammo stowage rolls for catastrophic ammunition explosion (`turret pop` / hull destruction) unless the vehicle is equipped with isolated blowout panels (e.g. M1 Abrams turret bustle).
- [ ] **Individual Crew Tracking**:
  - Track individual crewmen: Driver (mobility), Gunner (accuracy/FCS), Commander (spotting/C2), Loader (rate of fire).

---

## 3. Tactical Environment, Terrain & Command Rules

### 3.1 True 3D Elevation & Hull-Down Defilade
- [ ] **Integer Elevation per Hex (`elevation: 0, 1, 2, 3`)**:
  - Upgrade elevation from purely decorative canvas contour rings to functional terrain height levels.
  - Firing from higher elevation grants line-of-sight over low obstacles and downward angle penetration advantages.
- [ ] **Hull-Down Positions**:
  - Units positioned behind ridgelines, highway embankments, or in prepared berms gain "Hull-Down" status, concealing the hull and presenting only the heavily armored turret face (reducing target hit box and using turret aspect armor exclusively).

### 3.2 Dynamic Geometric Line-of-Sight (LOS) & Fog of War
- [ ] **Shadowcasting Raycast Line-of-Sight**:
  - Replace radial Euclidean distance (`distance <= visibilityMeters`) with raytraced line-of-sight that casts true sight shadows behind urban blocks, dense forest lines, and ridges.
- [ ] **Concealment & Camouflage**:
  - Units in trenches, tree lines, or buildings remain hidden until they fire or an enemy recon element closes within spotting range.
- [ ] **Smoke Dischargers & Smoke Screens**:
  - Allow vehicles and mortar support to deploy smoke screens, generating temporary LOS-blocking smoke clouds that degrade thermal vision and laser guidance.

### 3.3 Reaction / Opportunity Fire (Overwatch)
- [ ] **Overwatch State & Reaction Interrupts**:
  - Units that preserve movement points can enter *Overwatch* mode.
  - Moving enemy units that cross an overwatching unit's field of fire trigger reactionary opportunity fire, interrupting movement mid-stride.

---

## 4. Sandbox, Procedural Generation & Multi-Scenario Content

### 4.1 Algorithmic Procedural Map Generator
- [ ] **Perlin/Simplex Noise Map Synthesis**:
  - Connect the Force Builder's parameter sliders (elevation steepness, moisture, forest density, urban sprawl) to a procedural noise map generator that generates unique tactical maps with roads, canals, bridges, and wadis on demand.

### 4.2 Multi-Scenario Expansion & National Orders of Battle
- [ ] **Cold War 1980s Scenario (Fulda Gap)**:
  - US Army (M1IP Abrams, M2 Bradley, M113, TOW-ITV, AH-1 Cobra) vs. Soviet Group of Forces in Germany (T-80B, T-72A, BMP-2, BTR-80, Mi-24 Hind).
- [ ] **Points-Based Force Purchasing**:
  - Build an interactive force-selection screen where players spend a points budget (e.g. 2,000 pts) to draft custom platoons and companies from national rosters.

### 4.3 Scenario Rescaling & Map Realism
- [x] **Rescale 'Bite the Dust' Scenario to 1:1 Scale Representation**:
  - Expanded map grid from 52×32 (2.8×1.5 km) to **68×38 hexes** ($6.8 \times 3.8\text{ km}$ at 100 m/hex, canvas $3700 \times 1850\text{ px}$) to accurately reflect the real-world western approaches to Ahvaz across the irrigation canal network.
  - Scaled Order of Battle to authentic combined-arms task-force invasion echelons:
    - **U.S. Vanguard Spearhead (18 units)**: 8x M1A1 Abrams MBTs (Saber & Dagger platoons), 8x M2A2 Bradley IFVs (Ranger & Ghost platoons), 2x M2A2 Bradley Cavalry Scouts (Recon section).
    - **Coalition Defense (24 units)**: 8x ZTZ-99A MBTs (Dragon & Tiger platoons), 4x ZBD-04 IFVs (Jade platoon), 6x IRGC Dehlavieh ATGM teams in prepared trenches, 6x Volunteer infantry squads defending the urban perimeter.
  - Remapped terrain features to 68×38 layout: north-south canal barrier at column 34 with 3 crossing bridges (North, Highway, South), central highway approach with artillery craters, forward and reserve trench networks (cols 48 & 52), and Ahvaz urban outskirts (cols 56–67).
  - Updated victory breach threshold to Column 60+ and turn limit to 18 turns.

---

## 5. Documentation Synchronization Debt

- [ ] **Update `docs/DOCS.md`**:
  - Section 2 still describes the legacy platoon scale (4 tanks per counter, 12 HP = 4 tanks) rather than individual vehicle and squad counters.
  - Section 4 & 5 still describe flat armor values rather than directional aspect armor, subsystem critical damage, and infantry suppression meters.
  - Add documentation for the newly added C2 network datalinks, OOB Tree inspector, and Force Builder tooling.
- [ ] **Update `docs/SCENARIOS.md`**:
  - Line 7 references the removed legacy file `scenarios/dust-line.js`.
  - Update unit creation instructions to document `unitClass`, `armorAspect`, `subsystems`, `soldiers`, `company`, `platoon`, and `isLeader` fields.

