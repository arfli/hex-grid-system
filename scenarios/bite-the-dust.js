(function () {
  'use strict';

  window.SCENARIOS = window.SCENARIOS || {};

  const axial = (column, row) => [column - Math.floor(row / 2), row];
  const row = (from, to, r) => Array.from({ length:to - from + 1 }, (_, i) => axial(from + i, r));
  const column = (c, from, to) => Array.from({ length:to - from + 1 }, (_, i) => axial(c, from + i));
  const block = (left, top, width, height) => Array.from({ length:height }, (_, y) => row(left, left + width - 1, top + y)).flat();
  const place = (id, faction, type, column, row, extra = {}) => ({ id, faction, type, q:column - Math.floor(row / 2), r:row, ...extra });
  const objective = (name, column, row) => ({ name, q:column - Math.floor(row / 2), r:row });

  window.SCENARIOS.biteTheDust = {
    id: 'bite-the-dust',
    title: 'Bite the Dust',
    kicker: 'The western approaches to Ahvaz',
    turnSeconds: 30,
    turnLimit: 18,
    map: { columns:68, rows:38, hexSize:30, metersPerHex:100, width:3700, height:1850 },

    environment: {
      visibilityMeters:3500,
      crosswindMps:5,
      crosswindPenaltyBeyondMeters:2200,
      crosswindAccuracyModifier:0.95
    },
    assets: {
      baseTerrain:'assets/imgs/hex-desert-terrain.jpg',
      explosion:'assets/imgs/dmg_explosion.png',
      terrain: {
        field:'assets/svg/field.svg', road:'assets/svg/road.svg', urban:'assets/svg/urban.svg',
        trench:'assets/svg/trench.svg', canal:'assets/svg/canal.svg', bridge:'assets/svg/bridge.svg',
        crater:'assets/imgs/crater.png'
      },
      units: {
        abrams:'assets/imgs/abrams.png', bradley:'assets/imgs/bradley.png',
        type99:'assets/imgs/Type_99CN.png', zbd04:'assets/imgs/ZBD04CN.png',
        irgc:'assets/svg/irgc-infantry.svg', volunteers:'assets/svg/volunteers.svg'
      },
      effects:{ apache:'assets/imgs/apaches_flying_in_formation.png' }
    },

    airSupport:{
      id:'apache-cas', faction:'US', turn:4, image:'apache', durationMs:6500,
      weapons:['hellfire_atgm', 'm230_30'],
      strikes:4, baseHitChance:0.76, airDefenseModifier:0.62, minimumDamage:4, maximumDamage:7
    },

    factions: {
      US: { name:'U.S.', victoryName:'USA', color:'#55aaff', turnMessage:'Maintain tempo. Pierce the defense before cohesion collapses.' },
      COALITION: { name:'Chinese–Iranian Alliance', victoryName:'ALLIANCE', color:'#d94b42', turnMessage:'Hold the Ahvaz defensive belt and bleed the spearhead.' }
    },
    turnOrder:['US', 'COALITION'],
    ai: {
      US:{ strategy:'breakthrough', goalColumn:60 },
      COALITION:{ strategy:'defensive-fire' }
    },

    terrainTypes: {
      field:{ label:'Irrigated field', movementCost:1.2, defense:0 },
      road:{ label:'Highway', movementCost:0.5, defense:0 },
      urban:{ label:'Urban blocks', movementCost:1.5, defense:2 },
      trench:{ label:'Prepared defenses', movementCost:1.5, defense:2 },
      canal:{ label:'Irrigation canal', movementCost:Infinity, defense:0 },
      bridge:{ label:'Canal bridge', movementCost:0.5, defense:0 },
      crater:{ label:'Missile crater', movementCost:2, defense:0 }
    },
    terrain: {
      field:[
        ...block(10, 2, 14, 12),
        ...block(10, 23, 14, 12),
        ...block(38, 2, 8, 12),
        ...block(38, 23, 8, 12)
      ],
      road:[
        ...row(0, 67, 18),
        ...row(0, 67, 19),
        ...row(35, 56, 8),
        ...row(35, 56, 29)
      ],
      canal:column(34, 0, 37),
      bridge:[
        ...row(34, 34, 8),
        ...row(34, 34, 9),
        ...row(34, 34, 18),
        ...row(34, 34, 19),
        ...row(34, 34, 28),
        ...row(34, 34, 29)
      ],
      urban:[
        ...block(56, 1, 12, 36),
        ...block(53, 6, 3, 8),
        ...block(53, 23, 3, 8)
      ],
      trench:[
        ...column(48, 2, 15),
        ...column(48, 22, 35),
        ...row(45, 52, 16),
        ...row(45, 52, 21),
        ...column(52, 5, 14),
        ...column(52, 23, 32)
      ],
      crater:[
        axial(12, 18), axial(16, 19), axial(22, 18),
        axial(28, 19), axial(32, 18), axial(38, 19),
        axial(44, 18), axial(47, 19), axial(50, 18)
      ]
    },

    objectives:[
      objective('Northern Breach (Kianpars Approach)', 62, 8),
      objective('Central Highway Junction', 62, 19),
      objective('Southern Breach (Khorramshahr Junction)', 62, 30)
    ],

    unitTypes: {
      abrams:{
        name:'M1A1 Abrams MBT',
        unitClass:'afv',
        image:'abrams',
        health:12,
        armor:10,
        armorAspect:{ front:10, side:6, rear:4, top:3 },
        movement:5,
        weapons:['m256_120', 'm240_coax'],
        weapon:{ name:'120 mm M256', maxRangeMeters:3000, optimalRangeMeters:2000, baseAccuracy:0.84, longRangeAccuracy:0.60, penetration:11 }
      },
      bradley:{
        name:'M2A2 Bradley IFV',
        unitClass:'afv',
        image:'bradley',
        health:7,
        armor:5,
        armorAspect:{ front:5, side:3, rear:2, top:2 },
        movement:6,
        weapons:['tow_2b', 'm242_25'],
        weapon:{ name:'BGM-71 TOW', maxRangeMeters:3750, optimalRangeMeters:2500, baseAccuracy:0.80, longRangeAccuracy:0.61, penetration:10, stationaryOnly:true }
      },
      type99:{
        name:'ZTZ-99A MBT',
        unitClass:'afv',
        image:'type99',
        health:12,
        armor:10,
        armorAspect:{ front:10, side:6, rear:4, top:3 },
        movement:5,
        weapons:['zpt98_125', 'type86_coax'],
        weapon:{ name:'125 mm smoothbore', maxRangeMeters:3000, optimalRangeMeters:2000, baseAccuracy:0.79, longRangeAccuracy:0.56, penetration:11 }
      },
      zbd04:{
        name:'ZBD-04 IFV',
        unitClass:'afv',
        image:'zbd04',
        health:8,
        armor:6,
        armorAspect:{ front:6, side:3, rear:2, top:2 },
        movement:6,
        weapons:['type03_100', 'type02_30'],
        weapon:{ name:'100 mm gun / ATGM', maxRangeMeters:4000, optimalRangeMeters:2200, baseAccuracy:0.74, longRangeAccuracy:0.52, penetration:9 }
      },
      irgc:{
        name:'IRGC ATGM Team (Dehlavieh)',
        unitClass:'infantry',
        soldiers:4,
        image:'irgc',
        health:8,
        armor:4,
        armorAspect:{ front:4, side:4, rear:3, top:2 },
        movement:0,
        rotateSprite:false,
        weapons:['dehlavieh_atgm', 'pkm_mg'],
        weapon:{ name:'ATGM network', maxRangeMeters:2500, optimalRangeMeters:1600, baseAccuracy:0.68, longRangeAccuracy:0.43, penetration:9, stationaryOnly:true }
      },
      volunteers:{
        name:'Iranian Volunteer Squad',
        unitClass:'infantry',
        soldiers:9,
        image:'volunteers',
        health:5,
        armor:2,
        armorAspect:{ front:2, side:2, rear:2, top:1 },
        movement:0,
        rotateSprite:false,
        weapons:['rpg_launcher', 'type56_akm'],
        weapon:{ name:'Rifle / RPG concentration', maxRangeMeters:600, optimalRangeMeters:300, baseAccuracy:0.52, longRangeAccuracy:0.27, penetration:6, stationaryOnly:true }
      }
    },

    units: [
      // US Task Force 1-64 Armor ("Desert Rogues", A Company)
      // 1st Platoon (Saber Platoon - 4x M1A1 Abrams)
      place('SABER-1','US','abrams',4,8,{ crewSkill:1.06, morale:0.86, facing:0, company:'A Co, 1-64 AR', platoon:'1st Platoon (Saber)', role:'Platoon Leader', isLeader:true, commandRadius:7 }),
      place('SABER-2','US','abrams',5,12,{ crewSkill:1.03, morale:0.84, facing:0, company:'A Co, 1-64 AR', platoon:'1st Platoon (Saber)', role:'Wingman' }),
      place('SABER-3','US','abrams',4,15,{ crewSkill:1.04, morale:0.85, facing:0, company:'A Co, 1-64 AR', platoon:'1st Platoon (Saber)', role:'Platoon Sergeant' }),
      place('SABER-4','US','abrams',5,17,{ crewSkill:1.00, morale:0.82, facing:0, company:'A Co, 1-64 AR', platoon:'1st Platoon (Saber)', role:'Wingman' }),

      // 2nd Platoon (Dagger Platoon - 4x M1A1 Abrams)
      place('DAGGER-1','US','abrams',4,20,{ crewSkill:1.05, morale:0.85, facing:0, company:'A Co, 1-64 AR', platoon:'2nd Platoon (Dagger)', role:'Platoon Leader', isLeader:true, commandRadius:7 }),
      place('DAGGER-2','US','abrams',5,23,{ crewSkill:1.02, morale:0.83, facing:0, company:'A Co, 1-64 AR', platoon:'2nd Platoon (Dagger)', role:'Wingman' }),
      place('DAGGER-3','US','abrams',4,26,{ crewSkill:1.03, morale:0.84, facing:0, company:'A Co, 1-64 AR', platoon:'2nd Platoon (Dagger)', role:'Platoon Sergeant' }),
      place('DAGGER-4','US','abrams',5,30,{ crewSkill:1.00, morale:0.81, facing:0, company:'A Co, 1-64 AR', platoon:'2nd Platoon (Dagger)', role:'Wingman' }),

      // US Task Force 3-15 Infantry ("China Recon", B Company)
      // 1st Mech Platoon (Ranger Platoon - 4x M2A2 Bradley)
      place('RANGER-1','US','bradley',7,7,{ crewSkill:1.02, morale:0.85, facing:0, company:'B Co, 3-15 IN', platoon:'1st Mech Platoon (Ranger)', role:'Mech Platoon Leader', isLeader:true, commandRadius:7 }),
      place('RANGER-2','US','bradley',8,10,{ crewSkill:1.00, morale:0.83, facing:0, company:'B Co, 3-15 IN', platoon:'1st Mech Platoon (Ranger)', role:'Wingman' }),
      place('RANGER-3','US','bradley',7,13,{ crewSkill:1.01, morale:0.84, facing:0, company:'B Co, 3-15 IN', platoon:'1st Mech Platoon (Ranger)', role:'Platoon Sergeant' }),
      place('RANGER-4','US','bradley',8,16,{ crewSkill:0.99, morale:0.82, facing:0, company:'B Co, 3-15 IN', platoon:'1st Mech Platoon (Ranger)', role:'Wingman' }),

      // 2nd Mech Platoon (Ghost Platoon - 4x M2A2 Bradley)
      place('GHOST-1','US','bradley',7,21,{ crewSkill:1.03, morale:0.85, facing:0, company:'B Co, 3-15 IN', platoon:'2nd Mech Platoon (Ghost)', role:'Mech Platoon Leader', isLeader:true, commandRadius:7 }),
      place('GHOST-2','US','bradley',8,24,{ crewSkill:1.00, morale:0.83, facing:0, company:'B Co, 3-15 IN', platoon:'2nd Mech Platoon (Ghost)', role:'Wingman' }),
      place('GHOST-3','US','bradley',7,27,{ crewSkill:1.02, morale:0.84, facing:0, company:'B Co, 3-15 IN', platoon:'2nd Mech Platoon (Ghost)', role:'Platoon Sergeant' }),
      place('GHOST-4','US','bradley',8,31,{ crewSkill:0.98, morale:0.81, facing:0, company:'B Co, 3-15 IN', platoon:'2nd Mech Platoon (Ghost)', role:'Wingman' }),

      // Recon Cavalry Section (2x M2A2 Bradley Scouts)
      place('RECON-1','US','bradley',10,14,{ crewSkill:1.05, morale:0.88, facing:0, company:'HHC Recon Platoon', platoon:'Scout Section', role:'Lead Scout', isLeader:true, commandRadius:6 }),
      place('RECON-2','US','bradley',10,23,{ crewSkill:1.03, morale:0.86, facing:0, company:'HHC Recon Platoon', platoon:'Scout Section', role:'Wing Scout' }),

      // Coalition PLA 124th Armored Brigade: 1st Armored Company
      // 1st Armored Platoon (Dragon Platoon - 4x ZTZ-99A MBT)
      place('DRAGON-1','COALITION','type99',46,7,{ crewSkill:1.02, morale:1.05, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'1st Armored Platoon (Dragon)', role:'Platoon Leader', isLeader:true, commandRadius:7 }),
      place('DRAGON-2','COALITION','type99',47,11,{ crewSkill:1.00, morale:1.04, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'1st Armored Platoon (Dragon)', role:'Wingman' }),
      place('DRAGON-3','COALITION','type99',46,14,{ crewSkill:0.99, morale:1.04, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'1st Armored Platoon (Dragon)', role:'Platoon Sergeant' }),
      place('DRAGON-4','COALITION','type99',47,17,{ crewSkill:1.01, morale:1.05, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'1st Armored Platoon (Dragon)', role:'Wingman' }),

      // 2nd Armored Platoon (Tiger Platoon - 4x ZTZ-99A MBT)
      place('TIGER-1','COALITION','type99',46,20,{ crewSkill:1.03, morale:1.05, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'2nd Armored Platoon (Tiger)', role:'Platoon Leader', isLeader:true, commandRadius:7 }),
      place('TIGER-2','COALITION','type99',47,23,{ crewSkill:1.00, morale:1.04, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'2nd Armored Platoon (Tiger)', role:'Wingman' }),
      place('TIGER-3','COALITION','type99',46,26,{ crewSkill:0.98, morale:1.04, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'2nd Armored Platoon (Tiger)', role:'Platoon Sergeant' }),
      place('TIGER-4','COALITION','type99',47,30,{ crewSkill:1.00, morale:1.04, facing:Math.PI, company:'1st Tank Co, 124th Bde', platoon:'2nd Armored Platoon (Tiger)', role:'Wingman' }),

      // Coalition PLA 124th Armored Brigade: 2nd Mech Company
      // 1st Mech Platoon (Jade Platoon - 4x ZBD-04 IFV)
      place('JADE-1','COALITION','zbd04',50,10,{ crewSkill:0.99, morale:1.02, facing:Math.PI, company:'2nd Mech Co, 124th Bde', platoon:'1st Mech Platoon (Jade)', role:'Mech Platoon Leader', isLeader:true, commandRadius:7 }),
      place('JADE-2','COALITION','zbd04',51,15,{ crewSkill:0.97, morale:1.02, facing:Math.PI, company:'2nd Mech Co, 124th Bde', platoon:'1st Mech Platoon (Jade)', role:'Wingman' }),
      place('JADE-3','COALITION','zbd04',50,22,{ crewSkill:0.98, morale:1.02, facing:Math.PI, company:'2nd Mech Co, 124th Bde', platoon:'1st Mech Platoon (Jade)', role:'Platoon Sergeant' }),
      place('JADE-4','COALITION','zbd04',51,27,{ crewSkill:0.96, morale:1.02, facing:Math.PI, company:'2nd Mech Co, 124th Bde', platoon:'1st Mech Platoon (Jade)', role:'Wingman' }),

      // Coalition Fortified ATGM Defense Network (IRGC 3rd Defense Section)
      place('IRGC-1','COALITION','irgc',48,5,{ crewSkill:0.97, morale:1.12, facing:Math.PI, company:'IRGC Ahvaz Defense Force', platoon:'3rd ATGM Defense Section', role:'Section Leader', isLeader:true, commandRadius:8 }),
      place('IRGC-2','COALITION','irgc',48,12,{ crewSkill:1.00, morale:1.12, facing:Math.PI, company:'IRGC Ahvaz Defense Force', platoon:'3rd ATGM Defense Section', role:'ATGM Team 2' }),
      place('IRGC-3','COALITION','irgc',45,16,{ crewSkill:0.98, morale:1.10, facing:Math.PI, company:'IRGC Ahvaz Defense Force', platoon:'3rd ATGM Defense Section', role:'ATGM Team 3' }),
      place('IRGC-4','COALITION','irgc',45,21,{ crewSkill:0.99, morale:1.10, facing:Math.PI, company:'IRGC Ahvaz Defense Force', platoon:'3rd ATGM Defense Section', role:'ATGM Team 4' }),
      place('IRGC-5','COALITION','irgc',48,25,{ crewSkill:0.96, morale:1.10, facing:Math.PI, company:'IRGC Ahvaz Defense Force', platoon:'3rd ATGM Defense Section', role:'ATGM Team 5' }),
      place('IRGC-6','COALITION','irgc',48,32,{ crewSkill:0.94, morale:1.10, facing:Math.PI, company:'IRGC Ahvaz Defense Force', platoon:'3rd ATGM Defense Section', role:'ATGM Team 6' }),

      // Coalition Local Popular Defense (Khuzestan Volunteer Infantry Squads)
      place('VOL-1','COALITION','volunteers',52,8,{ crewSkill:0.80, morale:1.08, facing:Math.PI, company:'Khuzestan Popular Defense', platoon:'1st Volunteer Detachment', role:'Squad Leader', isLeader:true, commandRadius:6 }),
      place('VOL-2','COALITION','volunteers',52,13,{ crewSkill:0.77, morale:1.08, facing:Math.PI, company:'Khuzestan Popular Defense', platoon:'1st Volunteer Detachment', role:'Rifle Squad 2' }),
      place('VOL-3','COALITION','volunteers',54,17,{ crewSkill:0.76, morale:1.06, facing:Math.PI, company:'Khuzestan Popular Defense', platoon:'1st Volunteer Detachment', role:'Rifle Squad 3' }),
      place('VOL-4','COALITION','volunteers',54,20,{ crewSkill:0.78, morale:1.08, facing:Math.PI, company:'Khuzestan Popular Defense', platoon:'1st Volunteer Detachment', role:'Rifle Squad 4' }),
      place('VOL-5','COALITION','volunteers',52,25,{ crewSkill:0.75, morale:1.06, facing:Math.PI, company:'Khuzestan Popular Defense', platoon:'1st Volunteer Detachment', role:'Rifle Squad 5' }),
      place('VOL-6','COALITION','volunteers',52,30,{ crewSkill:0.73, morale:1.06, facing:Math.PI, company:'Khuzestan Popular Defense', platoon:'1st Volunteer Detachment', role:'Rifle Squad 6' })
    ],

    intro:{
      title:'Operation Bite the Dust',
      characterDelay:14,
      paragraphs:[
        'FICTIONAL NEAR-FUTURE SCENARIO.',
        'Tension between the United States and Iran has reached breaking point over control and security in the Strait of Hormuz. With maritime pressure failing to force Tehran to surrender, Washington authorizes a daring and tightly concealed land campaign.',
        'To avoid the delay and visibility of a major military buildup, a regiment-sized U.S. armored force crosses from the Iraqi frontier. Its mission is audacious: seize the oil-rich province of Khuzestan, secure its capital at Ahvaz, and confront the Iranian government with a rapid strategic defeat.',
        'The advance from the border is unexpectedly swift. Coordinated missile strikes tear into strategic positions, communications sites, and approach routes. American commanders begin to believe that speed and surprise have broken organized resistance.',
        'Then the spearhead reaches the western outskirts of Ahvaz.',
        'Beyond the dust and damaged highway, new silhouettes wait in prepared positions. Chinese armor, Iranian Revolutionary Guard troops, and local volunteers have formed a joint defensive alliance around the city.',
        'The road to Ahvaz is no longer open. The battle for Khuzestan begins here.'
      ]
    },

    briefing:{
      dateLine:'Fictional near-future scenario · Ahvaz approaches',
      situation:'After a rapid U.S. drive into Khuzestan meets little resistance, its lead armored regiment reaches the western outskirts of Ahvaz. Missile strikes have damaged the approach corridor, but a concealed Chinese–Iranian defensive belt remains operational. The U.S. formation has superior machinery but brittle morale and must break through before losses force withdrawal.',
      sides:{
        US:'Command the armored spearhead. Preserve strength, cross the canal, and penetrate the eastern defensive belt before aggregate strength falls to 50%. An Apache formation arrives on turn 4 to provide CAS-guided precision strikes, but coalition air defenses reduce—and randomize—the chance of hitting each target.',
        COALITION:'Command the combined defense. Use Chinese armor platoons, prepared IRGC positions, and volunteer platoons to hold the line or reduce the U.S. spearhead to half strength.'
      }
    },

    outcomes:{
      US:{
        headline:'The Ahvaz line is breached',
        next:'The spearhead establishes a narrow lodgment on the urban edge, but the regiment is too small to secure the entire city. Iranian forces prepare counterattacks while U.S. commanders face an immediate choice between reinforcement, consolidation, or withdrawal.',
        internationalReaction:'Washington publicly protests the revelation of a previously undisclosed Chinese–Iranian military alliance, arguing that Beijing secretly expanded the conflict and endangered U.S. forces. Beijing rejects the accusation and describes its involvement as international solidarity against war, invasion, and imperialism. Chinese diplomats call for recognition of Iran’s sovereignty, territorial borders, and government, while demanding an immediate U.S. withdrawal. Regional governments press for a ceasefire, energy markets react sharply, and humanitarian agencies warn that further fighting around Ahvaz could displace civilians. Whether the tactical breach can produce Iranian surrender remains deeply uncertain.'
      },
      COALITION:{
        headline:'The spearhead breaks against Ahvaz',
        next:'With half its combat strength lost or disabled, the U.S. regiment abandons the assault and falls back toward its supply corridor. The alliance retains the approaches and portrays the defense as proof that the wider campaign has stalled.',
        internationalReaction:'Washington condemns the previously undisclosed Chinese–Iranian military alliance and claims that covert Chinese participation transformed a limited campaign into a wider international confrontation. Beijing answers that the defense of Ahvaz represents international solidarity against war, invasion, and imperialism. It calls on other governments to defend Iran’s sovereignty, territorial borders, and recognized government and demands the complete withdrawal of U.S. forces. Iran and China celebrate the defensive victory, while U.S. partners call for an investigation and rapid de-escalation. International mediators seek talks before either side introduces larger formations.'
      }
    },

    missionHtml:'Scale: 1 counter = 1 individual vehicle or infantry squad/team. 1 hex = 100 m (Grid: 6.8 × 3.8 km).<br><br><b>USA:</b> Breach the eastern defensive line (Column 60+). At 50% aggregate starting strength, the spearhead withdraws. Apache CAS arrives on turn 4, subject to coalition air defenses.<br><br><b>Alliance:</b> Prevent a breach and reduce the U.S. spearhead to half strength.',
    openingLog:['Missile impacts walk across the Ahvaz highway—but the defense remains intact.','Unexpected contact: Chinese armor and Iranian prepared positions ahead.','U.S. cohesion is fragile. A 50% strength loss will force withdrawal.'],

    determineWinner(game) {
      const usUnits = game.units.filter(unit => unit.faction === 'US');
      const currentStrength = usUnits.reduce((sum, unit) => sum + unit.health, 0);
      const startingStrength = usUnits.reduce((sum, unit) => sum + unit.maxHealth, 0);
      const breached = game.livingUnits.some(unit => unit.faction === 'US' && unit.q + Math.floor(unit.r / 2) >= 60);
      if (breached) return 'US';
      if (currentStrength <= startingStrength * 0.5 || !game.hasLivingUnits('US')) return 'COALITION';
      if (game.turn > this.turnLimit) return 'COALITION';
      return null;
    },

    victoryMessage(winner) {
      return winner === 'US' ? 'The defensive belt is breached; the road to Ahvaz is open.' : 'The spearhead withdraws after unacceptable losses.';
    }
  };
}());
