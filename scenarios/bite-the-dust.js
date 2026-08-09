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
      }
    },

    factions: {
      US: { name:'U.S.', victoryName:'USA', color:'#55aaff', turnMessage:'Maintain tempo. Pierce the defense before cohesion collapses.' },
      COALITION: { name:'Chinese–Iranian Alliance', victoryName:'ALLIANCE', color:'#d94b42', turnMessage:'Hold the Ahvaz defensive belt and bleed the spearhead.' }
    },
    turnOrder:['US', 'COALITION'],

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

    missionHtml:'Scale: one counter is one vehicle or infantry position; one hex is 100 m.<br><br><b>USA:</b> breach the eastern defensive line. At 50% aggregate starting strength, the regiment withdraws.<br><br><b>Alliance:</b> prevent a breach and reduce the U.S. spearhead to half strength.',
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
