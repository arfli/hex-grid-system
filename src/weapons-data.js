(function (global) {
  'use strict';

  const AMMO_TYPES = {
    APFSDS: {
      label: 'APFSDS',
      name: 'Armour-Piercing Fin-Stabilized Discarding Sabot',
      kind: 'kinetic',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    },
    HEAT: {
      label: 'HEAT',
      name: 'High-Explosive Anti-Tank',
      kind: 'shaped_charge',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    },
    ATGM: {
      label: 'ATGM',
      name: 'Anti-Tank Guided Missile',
      kind: 'missile',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    },
    HE_FRAG: {
      label: 'HE / HE-FRAG',
      name: 'High-Explosive Fragmentation',
      kind: 'explosive',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    },
    AUTOCANNON: {
      label: 'Autocannon AP/APDS/HEI',
      name: 'Autocannon Mixed Belt',
      kind: 'ballistic_small',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    },
    MG_BALL_TRACER: {
      label: 'MG Ball + Tracer',
      name: 'Machine Gun Ball & Tracer Mix',
      kind: 'ballistic_small',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    },
    SMALL_ARMS: {
      label: 'Small Arms Ball',
      name: 'Rifle Ball Cartridge',
      kind: 'ballistic_small',
      // NOT wired into combat yet; damage still comes from the unit's existing damage stat.
      effectiveness: { vsArmor: 1, vsInfantry: 1, vsSoft: 1, vsStructure: 1, vsAir: 1 }
    }
  };

  const WEAPONS = {
    m256_120: {
      name: '120 mm M256A1 Smoothbore',
      caliber: 120,
      ammo: ['APFSDS', 'HEAT'],
      defaultAmmo: 'APFSDS',
      fireMode: 'single',
      rateOfFire: 6,
      tracerProfile: 'apfsds'
    },
    m240_coax: {
      name: '7.62 mm M240 Coaxial MG',
      caliber: 7.62,
      ammo: ['MG_BALL_TRACER'],
      defaultAmmo: 'MG_BALL_TRACER',
      fireMode: 'sustained',
      rateOfFire: 650,
      tracerProfile: 'mg'
    },
    tow_2b: {
      name: '127 mm BGM-71 TOW-2B',
      caliber: 127,
      ammo: ['ATGM'],
      defaultAmmo: 'ATGM',
      fireMode: 'single',
      rateOfFire: 2,
      tracerProfile: 'atgm'
    },
    m242_25: {
      name: '25 mm M242 Bushmaster',
      caliber: 25,
      ammo: ['AUTOCANNON'],
      defaultAmmo: 'AUTOCANNON',
      fireMode: 'burst',
      rateOfFire: 200,
      tracerProfile: 'autocannon'
    },
    zpt98_125: {
      name: '125 mm ZPT-98 Smoothbore',
      caliber: 125,
      ammo: ['APFSDS', 'HEAT'],
      defaultAmmo: 'APFSDS',
      fireMode: 'single',
      rateOfFire: 8,
      tracerProfile: 'apfsds'
    },
    type86_coax: {
      name: '7.62 mm Type 86 Coaxial MG',
      caliber: 7.62,
      ammo: ['MG_BALL_TRACER'],
      defaultAmmo: 'MG_BALL_TRACER',
      fireMode: 'sustained',
      rateOfFire: 700,
      tracerProfile: 'mg'
    },
    type03_100: {
      name: '100 mm 2A70-type / Type 03',
      caliber: 100,
      ammo: ['HE_FRAG', 'ATGM'],
      defaultAmmo: 'HE_FRAG',
      fireMode: 'single',
      rateOfFire: 10,
      tracerProfile: 'he_frag'
    },
    type02_30: {
      name: '30 mm 2A72-type Autocannon',
      caliber: 30,
      ammo: ['AUTOCANNON'],
      defaultAmmo: 'AUTOCANNON',
      fireMode: 'burst',
      rateOfFire: 330,
      tracerProfile: 'autocannon'
    },
    dehlavieh_atgm: {
      name: '152 mm Dehlavieh / Toophan ATGM', // ASSUMED Toophan reference alongside Dehlavieh
      caliber: 152,
      ammo: ['ATGM'],
      defaultAmmo: 'ATGM',
      fireMode: 'single',
      rateOfFire: 2,
      tracerProfile: 'atgm'
    },
    pkm_mg: {
      name: '7.62 mm PKM Machine Gun',
      caliber: 7.62,
      ammo: ['MG_BALL_TRACER'],
      defaultAmmo: 'MG_BALL_TRACER',
      fireMode: 'sustained',
      rateOfFire: 650,
      tracerProfile: 'mg'
    },
    rpg_launcher: {
      name: '105 mm RPG-7V / RPG-29',
      caliber: 105,
      ammo: ['HEAT'],
      defaultAmmo: 'HEAT',
      fireMode: 'single',
      rateOfFire: 4,
      tracerProfile: 'heat'
    },
    type56_akm: {
      name: '7.62 mm Type 56 / AKM Rifles',
      caliber: 7.62,
      ammo: ['SMALL_ARMS'],
      defaultAmmo: 'SMALL_ARMS',
      fireMode: 'burst',
      rateOfFire: 600,
      tracerProfile: 'small_arms'
    },
    hellfire_atgm: {
      name: '178 mm AGM-114 Hellfire',
      caliber: 178,
      ammo: ['ATGM'],
      defaultAmmo: 'ATGM',
      fireMode: 'single',
      rateOfFire: 4,
      tracerProfile: 'atgm'
    },
    m230_30: {
      name: '30 mm M230 Chain Gun',
      caliber: 30,
      ammo: ['AUTOCANNON'],
      defaultAmmo: 'AUTOCANNON',
      fireMode: 'burst',
      rateOfFire: 625,
      tracerProfile: 'autocannon'
    }
  };

  function getUnitWeapons(unit) {
    if (!unit || !unit.weapons) return [];
    return unit.weapons.map(id => WEAPONS[id]).filter(Boolean);
  }

  function getPrimaryWeapon(unit) {
    const weapons = getUnitWeapons(unit);
    return weapons.length ? weapons[0] : null;
  }

  function getAmmo(weaponId, ammoId) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return null;
    const targetAmmo = ammoId || weapon.defaultAmmo;
    return AMMO_TYPES[targetAmmo] || null;
  }

  // ASSUMED: Visual weapon selection heuristic for tracer rendering (does NOT affect combat damage)
  // - Primary weapon by default.
  // - If the target is infantry and the unit has an MG or autocannon, use that.
  // - If the target is armor and the unit has an ATGM or main gun, use that.
  function getVisualWeaponAndAmmo(attacker, target) {
    const weapons = getUnitWeapons(attacker);
    if (!weapons.length) return null;

    const isTargetInfantry = target && (target.type === 'irgc' || target.type === 'volunteers' || (target.armor && target.armor <= 4));
    const isTargetArmor = target && (target.armor && target.armor >= 5);

    let chosenWeapon = weapons[0]; // Primary by default

    if (isTargetInfantry) {
      const antiInfantry = weapons.find(w => w.ammo.includes('MG_BALL_TRACER') || w.ammo.includes('SMALL_ARMS') || w.ammo.includes('AUTOCANNON') || w.ammo.includes('HE_FRAG'));
      if (antiInfantry) chosenWeapon = antiInfantry;
    } else if (isTargetArmor) {
      const antiArmor = weapons.find(w => w.ammo.includes('APFSDS') || w.ammo.includes('ATGM') || w.ammo.includes('HEAT'));
      if (antiArmor) chosenWeapon = antiArmor;
    }

    let chosenAmmoId = chosenWeapon.defaultAmmo;
    if (isTargetInfantry && chosenWeapon.ammo.includes('HE_FRAG')) {
      chosenAmmoId = 'HE_FRAG';
    } else if (isTargetArmor && chosenWeapon.ammo.includes('APFSDS')) {
      chosenAmmoId = 'APFSDS';
    } else if (isTargetArmor && chosenWeapon.ammo.includes('ATGM')) {
      chosenAmmoId = 'ATGM';
    }

    return {
      weapon: chosenWeapon,
      ammo: AMMO_TYPES[chosenAmmoId],
      ammoId: chosenAmmoId
    };
  }

  function validateWeaponsData(unitTypes, weaponsTable = WEAPONS, ammoTable = AMMO_TYPES) {
    if (unitTypes) {
      for (const [unitId, def] of Object.entries(unitTypes)) {
        if (!def.weapons || !Array.isArray(def.weapons)) {
          throw new Error(`Validation Error: Unit type "${unitId}" is missing "weapons" array.`);
        }
        for (const wId of def.weapons) {
          if (!weaponsTable[wId]) {
            throw new Error(`Validation Error: Unit type "${unitId}" references unknown weapon ID: "${wId}".`);
          }
        }
      }
    }

    for (const [weaponId, weapon] of Object.entries(weaponsTable)) {
      if (!weapon.ammo || !Array.isArray(weapon.ammo) || !weapon.ammo.length) {
        throw new Error(`Validation Error: Weapon "${weaponId}" is missing valid ammo array.`);
      }
      for (const aId of weapon.ammo) {
        if (!ammoTable[aId]) {
          throw new Error(`Validation Error: Weapon "${weaponId}" references unknown ammo ID: "${aId}".`);
        }
      }
      if (!weapon.defaultAmmo || !weapon.ammo.includes(weapon.defaultAmmo)) {
        throw new Error(`Validation Error: Weapon "${weaponId}" defaultAmmo "${weapon.defaultAmmo}" is not in its ammo list.`);
      }
    }
    return true;
  }

  const exportObj = {
    AMMO_TYPES,
    WEAPONS,
    getUnitWeapons,
    getPrimaryWeapon,
    getAmmo,
    getVisualWeaponAndAmmo,
    validateWeaponsData
  };

  if (typeof global !== 'undefined') {
    global.HexWar = global.HexWar || {};
    Object.assign(global.HexWar, exportObj);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
}(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis)));

