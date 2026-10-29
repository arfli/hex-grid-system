# Unit Weapons & Ammo Audit

## 1. Purpose
This document specifies the weapon and ammunition data model for every combat unit in the Hex War Engine. The system adds realistic weapon designations, calibers, ammunition classifications, and firing modes to support future ammunition selection and Phase 3 visual firing tracers.

> [!IMPORTANT]
> **Zero Combat Balance Changes**: All ballistic damage, penetration math, and ranges remain strictly identical to the baseline engine rules. The data structures and visual weapon selection logic introduced in this audit do not alter combat resolution outcomes.

---

## 2. Unit Audit Table

| Unit ID | Name | Class | Current Damage Model | Current Range |
| :--- | :--- | :--- | :--- | :--- |
| `abrams` | M1A1 Abrams Platoon | Tank (MBT) | Pen 11 vs armor $\rightarrow$ on pen: $\max(1, 3 + \text{margin} + [0..2])$; non-pen: $1$ | Max: 3,000 m (30 hexes)<br>Opt: 2,000 m (20 hexes) |
| `bradley` | M2 Bradley Mech Platoon | IFV | Pen 10 vs armor $\rightarrow$ on pen: $\max(1, 3 + \text{margin} + [0..2])$; non-pen: $1$ | Max: 3,750 m (37.5 hexes)<br>Opt: 2,500 m (25 hexes) |
| `type99` | ZTZ-99 MBT Platoon | Tank (MBT) | Pen 11 vs armor $\rightarrow$ on pen: $\max(1, 3 + \text{margin} + [0..2])$; non-pen: $1$ | Max: 3,000 m (30 hexes)<br>Opt: 2,000 m (20 hexes) |
| `zbd04` | ZBD-04 IFV Platoon | IFV | Pen 9 vs armor $\rightarrow$ on pen: $\max(1, 3 + \text{margin} + [0..2])$; non-pen: $1$ | Max: 4,000 m (40 hexes)<br>Opt: 2,200 m (22 hexes) |
| `irgc` | IRGC Fortified ATGM Platoon | ATGM team | Pen 9 vs armor $\rightarrow$ on pen: $\max(1, 3 + \text{margin} + [0..2])$; non-pen: $1$ | Max: 2,500 m (25 hexes)<br>Opt: 1,600 m (16 hexes) |
| `volunteers` | Iranian Volunteer Platoon | Infantry | Pen 6 vs armor $\rightarrow$ on pen: $\max(1, 3 + \text{margin} + [0..2])$; non-pen: $1$ | Max: 600 m (6 hexes)<br>Opt: 300 m (3 hexes) |
| `apache-cas` | Apache CAS (Air Support) | Helicopter | Fixed CAS strike roll: 4 to 7 damage (air defense adjusted) | Map-wide strike mission |

---

## 3. How Attacks Are Currently Resolved

1. **Target Legality & Range**: Checked in `attackableUnits(attacker)`:
   $$\text{distanceMeters} = \text{hexDistance} \times 100$$
   $$\text{In Range} \iff \text{distanceMeters} \le \min(\text{weapon.maxRangeMeters}, \text{environment.visibilityMeters})$$
2. **Hit Probability**:
   - Base accuracy is selected depending on range: `weapon.baseAccuracy` if $\le \text{optimalRangeMeters}$, else `weapon.longRangeAccuracy`.
   - Modifiers: $\times (\text{crewSkill} \times \text{morale})$.
   - Movement penalty: $\times 0.82$ if attacker moved this turn.
   - Crosswind penalty: $\times 0.95$ beyond 2,200 m.
   - Defensive cover: $- (\text{terrain.defense} \times 0.10)$.
   - Clamped between $5\%$ and $95\%$.
3. **Penetration & Damage Calculation**:
   $$\text{Margin} = \text{weapon.penetration} - \text{target.armor}$$
   $$\text{Penetration Chance} = \text{clamp}(0.20, \, 0.90, \, 0.55 + \text{Margin} \times 0.12)$$
   - Penetrating Hit: $\max(1, \, 3 + \text{Margin} + \lfloor\text{random}() \times 3\rfloor)$ damage.
   - Non-Penetrating Hit: $1$ damage (armor held).
   - Miss: $0$ damage.
4. **Visuals Prior to This Work**: Attacks instantly applied damage upon trigger, followed by an explosion sprite (`dmg_explosion.png`) at the target location. No projectile or tracer animations existed.

---

## 4. Weapon & Ammunition Loadouts

* **`abrams` (M1A1 Abrams Platoon)**
  * `abrams` -> M256A1 Smoothbore (120 mm) -> `APFSDS`, `HEAT` -> `single` -> Primary armor-piercing kinetic sabot dart and multi-purpose shaped-charge round.
  * `abrams` -> M240 Coaxial MG (7.62 mm) -> `MG_BALL_TRACER` -> `sustained` -> Coaxial antipersonnel suppression weapon.

* **`bradley` (M2 Bradley Mech Platoon)**
  * `bradley` -> BGM-71 TOW-2B Launcher (127 mm) -> `ATGM` -> `single` -> Heavy wire/wireless guided anti-tank missile fired while stationary.
  * `bradley` -> M242 Bushmaster (25 mm) -> `AUTOCANNON` -> `burst` -> Dual-feed autocannon for engaging light armor and infantry positions.

* **`type99` (ZTZ-99 MBT Platoon)**
  * `type99` -> ZPT-98 Smoothbore (125 mm) -> `APFSDS`, `HEAT` -> `single` -> Autoloaded high-velocity main gun firing kinetic rod penetrators.
  * `type99` -> Type 86 Coaxial MG (7.62 mm) -> `MG_BALL_TRACER` -> `sustained` -> Secondary coaxial machine gun for light target engagement.

* **`zbd04` (ZBD-04 IFV Platoon)**
  * `zbd04` -> 2A70-type / Type 03 (100 mm) -> `HE_FRAG`, `ATGM` -> `single` -> Low-pressure rifled gun firing HE-FRAG or gun-launched Bastion/GP105 ATGMs.
  * `zbd04` -> 2A72-type Autocannon (30 mm) -> `AUTOCANNON` -> `burst` -> Coaxially mounted rapid-fire autocannon for light vehicle suppression.

* **`irgc` (IRGC Fortified ATGM Platoon)**
  * `irgc` -> Dehlavieh / Toophan ATGM Network (152 mm) -> `ATGM` -> `single` -> Prepared fortified positions firing Kornet-derived Dehlavieh (152 mm) // ASSUMED Toophan reference.
  * `irgc` -> PKM Machine Gun (7.62 mm) -> `MG_BALL_TRACER` -> `sustained` -> Defensive trench suppression weapon.

* **`volunteers` (Iranian Volunteer Platoon)**
  * `volunteers` -> RPG-7V / RPG-29 Launcher (105 mm) -> `HEAT` -> `single` -> Shoulder-fired shaped-charge rockets for close-range ambush.
  * `volunteers` -> Type 56 / AKM Assault Rifles (7.62 mm) -> `SMALL_ARMS` -> `burst` -> Volunteer rifle fire from trench and urban positions.

* **`apache-cas` (AH-64 Apache CAS)**
  * `apache-cas` -> AGM-114 Hellfire (178 mm) -> `ATGM` -> `single` -> Precision air-to-ground guided anti-armor missiles.
  * `apache-cas` -> M230 Chain Gun (30 mm) -> `AUTOCANNON` -> `burst` -> Chin-mounted area suppression weapon.

### 4.1 Implemented Data Registry (`src/weapons-data.js`)

| Unit ID | Weapon ID | Weapon Name | Caliber | Ammo Options | Default Ammo | Fire Mode | RoF (rpm) | Tracer Profile |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `abrams` | `m256_120` | 120 mm M256A1 Smoothbore | 120 mm | `APFSDS`, `HEAT` | `APFSDS` | `single` | 6 | `apfsds` |
| | `m240_coax` | 7.62 mm M240 Coaxial MG | 7.62 mm | `MG_BALL_TRACER` | `MG_BALL_TRACER` | `sustained` | 650 | `mg` |
| `bradley` | `tow_2b` | 127 mm BGM-71 TOW-2B | 127 mm | `ATGM` | `ATGM` | `single` | 2 | `atgm` |
| | `m242_25` | 25 mm M242 Bushmaster | 25 mm | `AUTOCANNON` | `AUTOCANNON` | `burst` | 200 | `autocannon` |
| `type99` | `zpt98_125` | 125 mm ZPT-98 Smoothbore | 125 mm | `APFSDS`, `HEAT` | `APFSDS` | `single` | 8 | `apfsds` |
| | `type86_coax` | 7.62 mm Type 86 Coaxial MG | 7.62 mm | `MG_BALL_TRACER` | `MG_BALL_TRACER` | `sustained` | 700 | `mg` |
| `zbd04` | `type03_100` | 100 mm 2A70-type / Type 03 | 100 mm | `HE_FRAG`, `ATGM` | `HE_FRAG` | `single` | 10 | `he_frag` |
| | `type02_30` | 30 mm 2A72-type Autocannon | 30 mm | `AUTOCANNON` | `AUTOCANNON` | `burst` | 330 | `autocannon` |
| `irgc` | `dehlavieh_atgm` | 152 mm Dehlavieh / Toophan | 152 mm | `ATGM` | `ATGM` | `single` | 2 | `atgm` |
| | `pkm_mg` | 7.62 mm PKM Machine Gun | 7.62 mm | `MG_BALL_TRACER` | `MG_BALL_TRACER` | `sustained` | 650 | `mg` |
| `volunteers` | `rpg_launcher` | 105 mm RPG-7V / RPG-29 | 105 mm | `HEAT` | `HEAT` | `single` | 4 | `heat` |
| | `type56_akm` | 7.62 mm Type 56 / AKM Rifles | 7.62 mm | `SMALL_ARMS` | `SMALL_ARMS` | `burst` | 600 | `small_arms` |
| `apache-cas` | `hellfire_atgm` | 178 mm AGM-114 Hellfire | 178 mm | `ATGM` | `ATGM` | `single` | 4 | `atgm` |
| | `m230_30` | 30 mm M230 Chain Gun | 30 mm | `AUTOCANNON` | `AUTOCANNON` | `burst` | 625 | `autocannon` |

---

## 5. Reserved for Later (Phase 2 Placeholders)

Each ammo type contains a reserved effectiveness matrix for future combat calculations:

```javascript
// NOT wired into combat yet; damage still comes from the unit's existing damage stat.
effectiveness: {
  vsArmor: 1.0,
  vsInfantry: 1.0,
  vsSoft: 1.0,
  vsStructure: 1.0,
  vsAir: 1.0
}
```

---

## 6. Project Status

- [x] **Phase 1: Weapon & Ammo Audit** — Completed.
- [x] **Phase 2: Data Model Implementation** — Completed (data tables created in `src/weapons-data.js`, validated, and verified byte-identical in combat).
- [ ] **Phase 3: Firing Tracer Visuals** — Pending confirmation.
- [ ] **Phase 4: Verification & Final Report** — Pending.
