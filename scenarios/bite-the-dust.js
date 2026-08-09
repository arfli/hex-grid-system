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
    turnLimit: 14,
    map: { columns:52, rows:32, hexSize:30, metersPerHex:100, width:2800, height:1500 },

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
      id:'apache-cas', faction:'US', turn:3, image:'apache', durationMs:6500,
      strikes:3, baseHitChance:0.76, airDefenseModifier:0.62, minimumDamage:4, maximumDamage:7
    },

    factions: {
      US: { name:'U.S.', victoryName:'USA', color:'#55aaff', turnMessage:'Maintain tempo. Pierce the defense before cohesion collapses.' },
      COALITION: { name:'Chinese–Iranian Alliance', victoryName:'ALLIANCE', color:'#d94b42', turnMessage:'Hold the Ahvaz defensive belt and bleed the spearhead.' }
    },
    turnOrder:['US', 'COALITION'],
    ai: {
      US:{ strategy:'breakthrough', goalColumn:45 },
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
      field:[...block(12,2,10,7), ...block(29,1,8,6), ...block(8,22,13,8), ...block(28,24,9,7)],
      road:[...row(0,51,15), ...row(0,51,16)],
      canal:column(26,0,31),
      bridge:[...row(26,26,15), ...row(26,26,16)],
      urban:[...block(43,2,9,28), ...block(39,7,4,6), ...block(40,21,3,7)],
      trench:[...column(37,3,13), ...column(38,18,29), ...row(35,39,14), ...row(36,40,17)],
      crater:[axial(10,15),axial(14,16),axial(19,15),axial(23,16),axial(31,15),axial(34,16),axial(40,15),axial(41,16)]
    },

    objectives:[
      objective('Northern Breach',47,6),
      objective('Ahvaz Highway',47,16),
      objective('Southern Breach',47,26)
    ],

    unitTypes: {
      abrams:{ name:'M1A1 Abrams', image:'abrams', health:12, armor:10, movement:5, weapon:{ name:'120 mm M256', maxRangeMeters:3000, optimalRangeMeters:2000, baseAccuracy:0.84, longRangeAccuracy:0.60, penetration:11 } },
      bradley:{ name:'M2 Bradley', image:'bradley', health:7, armor:5, movement:6, weapon:{ name:'BGM-71 TOW', maxRangeMeters:3750, optimalRangeMeters:2500, baseAccuracy:0.80, longRangeAccuracy:0.61, penetration:10, stationaryOnly:true } },
      type99:{ name:'ZTZ-99 MBT', image:'type99', health:12, armor:10, movement:5, weapon:{ name:'125 mm smoothbore', maxRangeMeters:3000, optimalRangeMeters:2000, baseAccuracy:0.79, longRangeAccuracy:0.56, penetration:11 } },
      zbd04:{ name:'ZBD-04 IFV', image:'zbd04', health:8, armor:6, movement:6, weapon:{ name:'100 mm gun / ATGM', maxRangeMeters:4000, optimalRangeMeters:2200, baseAccuracy:0.74, longRangeAccuracy:0.52, penetration:9 } },
      irgc:{ name:'IRGC fortified infantry', image:'irgc', health:8, armor:4, movement:0, rotateSprite:false, weapon:{ name:'ATGM team', maxRangeMeters:2500, optimalRangeMeters:1600, baseAccuracy:0.68, longRangeAccuracy:0.43, penetration:9, stationaryOnly:true } },
      volunteers:{ name:'Iranian volunteers', image:'volunteers', health:5, armor:2, movement:0, rotateSprite:false, weapon:{ name:'Rifle / RPG team', maxRangeMeters:600, optimalRangeMeters:300, baseAccuracy:0.52, longRangeAccuracy:0.27, penetration:6, stationaryOnly:true } }
    },

    units: [
      place('SABER-1','US','abrams',4,7,{ crewSkill:1.06, morale:0.84, facing:0 }),
      place('SABER-2','US','abrams',5,12,{ crewSkill:1.03, morale:0.82, facing:0 }),
      place('SABER-3','US','abrams',4,18,{ crewSkill:1.04, morale:0.86, facing:0 }),
      place('SABER-4','US','abrams',5,24,{ crewSkill:1.00, morale:0.80, facing:0 }),
      place('RANGER-1','US','bradley',7,9,{ crewSkill:1.02, morale:0.84, facing:0 }),
      place('RANGER-2','US','bradley',7,15,{ crewSkill:1.00, morale:0.82, facing:0 }),
      place('RANGER-3','US','bradley',7,21,{ crewSkill:1.01, morale:0.83, facing:0 }),
      place('DRAGON-1','COALITION','type99',35,6,{ crewSkill:1.02, morale:1.05, facing:Math.PI }),
      place('DRAGON-2','COALITION','type99',36,13,{ crewSkill:1.00, morale:1.04, facing:Math.PI }),
      place('DRAGON-3','COALITION','type99',36,22,{ crewSkill:0.98, morale:1.04, facing:Math.PI }),
      place('DRAGON-4','COALITION','type99',35,28,{ crewSkill:1.01, morale:1.05, facing:Math.PI }),
      place('JADE-1','COALITION','zbd04',38,9,{ crewSkill:0.98, morale:1.02, facing:Math.PI }),
      place('JADE-2','COALITION','zbd04',38,25,{ crewSkill:0.96, morale:1.02, facing:Math.PI }),
      place('IRGC-1','COALITION','irgc',37,4,{ crewSkill:0.96, morale:1.12, facing:Math.PI }),
      place('IRGC-2','COALITION','irgc',37,14,{ crewSkill:1.00, morale:1.12, facing:Math.PI }),
      place('IRGC-3','COALITION','irgc',38,19,{ crewSkill:0.98, morale:1.10, facing:Math.PI }),
      place('IRGC-4','COALITION','irgc',38,29,{ crewSkill:0.94, morale:1.10, facing:Math.PI }),
      place('VOL-1','COALITION','volunteers',40,11,{ crewSkill:0.78, morale:1.08, facing:Math.PI }),
      place('VOL-2','COALITION','volunteers',40,17,{ crewSkill:0.76, morale:1.08, facing:Math.PI }),
      place('VOL-3','COALITION','volunteers',40,24,{ crewSkill:0.74, morale:1.06, facing:Math.PI })
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
        US:'Command the armored spearhead. Preserve strength, cross the canal, and penetrate the eastern defensive belt before aggregate strength falls to 50%. An Apache formation arrives on turn 3 to provide CAS-guided precision strikes, but coalition air defenses reduce—and randomize—the chance of hitting each target.',
        COALITION:'Command the combined defense. Use Chinese armor, prepared IRGC positions, and volunteers to hold the line or reduce the U.S. spearhead to half strength.'
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

    missionHtml:'Scale: one counter is one vehicle or infantry position; one hex is 100 m.<br><br><b>USA:</b> breach the eastern defensive line. At 50% aggregate starting strength, the regiment withdraws. Apache CAS arrives on turn 3, subject to coalition air defenses.<br><br><b>Alliance:</b> prevent a breach and reduce the U.S. spearhead to half strength.',
    openingLog:['Missile impacts walk across the Ahvaz highway—but the defense remains intact.','Unexpected contact: Chinese armor and Iranian prepared positions ahead.','U.S. cohesion is fragile. A 50% strength loss will force withdrawal.'],

    determineWinner(game) {
      const usUnits = game.units.filter(unit => unit.faction === 'US');
      const currentStrength = usUnits.reduce((sum, unit) => sum + unit.health, 0);
      const startingStrength = usUnits.reduce((sum, unit) => sum + unit.maxHealth, 0);
      const breached = game.livingUnits.some(unit => unit.faction === 'US' && unit.q + Math.floor(unit.r / 2) >= 45);
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
