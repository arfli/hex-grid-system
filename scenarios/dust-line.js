window.SCENARIOS = window.SCENARIOS || {};

window.SCENARIOS.dustLine = {
  id: 'dust-line',
  title: 'Dust Line',
  kicker: 'Turn-based tactical engagement',
  turnSeconds: 30,
  turnLimit: 12,
  map: { columns: 48, rows: 30, hexSize: 32, metersPerHex: 100, width: 2750, height: 1510 },

  environment: {
    visibilityMeters: 4000,
    crosswindMps: 8,
    crosswindPenaltyBeyondMeters: 2000,
    crosswindAccuracyModifier: 0.92
  },
  assets: {
    baseTerrain: 'assets/imgs/hex-desert-terrain.jpg',
    explosion: 'assets/imgs/dmg_explosion.png',
    terrain: { crater:'assets/imgs/crater.png', ruins:'assets/imgs/destroyed_building_1.png' },
    units: { abrams:'assets/imgs/abrams.png', bradley:'assets/imgs/bradley.png', merkava:'assets/imgs/merkava-mk1.png' }
  },

  factions: {
    US: { name:'U.S.', victoryName:'USA', color:'#55aaff', turnMessage:'Break through and seize the relay station.' },
    ISRAEL: { name:'Israel', victoryName:'ISRAEL', color:'#f0cf5b', turnMessage:'Hold the objectives and blunt the advance.' }
  },
  turnOrder: ['US', 'ISRAEL'],

  terrainTypes: {
    crater: { label:'Crater', movementCost:2, defense:0 },
    ruins: { label:'Ruins', movementCost:1, defense:1 }
  },
  terrain: {
    ruins: [[20,7],[21,7],[22,7],[20,8],[21,8],[22,8],[30,18],[31,18],[32,18],[30,19],[31,19],[32,19]],
    crater: [[14,10],[17,18],[24,13],[27,22],[34,9],[37,16],[11,22],[25,6]]
  },

  objectives: [
    { q:21, r:8, name:'Relay Station' },
    { q:31, r:19, name:'Wadi Crossing' }
  ],

  unitTypes: {
    abrams: {
      name:'M1A1 Abrams', image:'abrams', health:12, armor:10, movement:5,
      weapon:{ name:'120 mm M256', maxRangeMeters:3000, optimalRangeMeters:2000, baseAccuracy:0.82, longRangeAccuracy:0.58, penetration:11 }
    },
    bradley: {
      name:'M2 Bradley', image:'bradley', health:7, armor:5, movement:6,
      weapon:{ name:'BGM-71 TOW', maxRangeMeters:3750, optimalRangeMeters:2500, baseAccuracy:0.78, longRangeAccuracy:0.60, penetration:10, stationaryOnly:true }
    },
    merkava: {
      name:'Merkava Mk.1', image:'merkava', health:11, armor:9, movement:4,
      weapon:{ name:'105 mm M68', maxRangeMeters:3000, optimalRangeMeters:1800, baseAccuracy:0.76, longRangeAccuracy:0.48, penetration:9 }
    }
  },
  units: [
    { id:'EAGLE-1', faction:'US', type:'abrams', q:3, r:8, crewSkill:1.05, facing:0 },
    { id:'EAGLE-2', faction:'US', type:'abrams', q:4, r:13, crewSkill:1.00, facing:0 },
    { id:'EAGLE-3', faction:'US', type:'abrams', q:2, r:19, crewSkill:0.94, facing:0 },
    { id:'VIPER-1', faction:'US', type:'bradley', q:5, r:10, crewSkill:1.00, facing:0 },
    { id:'VIPER-2', faction:'US', type:'bradley', q:4, r:22, crewSkill:0.96, facing:0 },
    { id:'CEDAR-1', faction:'ISRAEL', type:'merkava', q:30, r:6, crewSkill:1.08, facing:Math.PI },
    { id:'CEDAR-2', faction:'ISRAEL', type:'merkava', q:32, r:11, crewSkill:1.02, facing:Math.PI },
    { id:'CEDAR-3', faction:'ISRAEL', type:'merkava', q:29, r:16, crewSkill:1.00, facing:Math.PI },
    { id:'CEDAR-4', faction:'ISRAEL', type:'merkava', q:31, r:22, crewSkill:0.96, facing:Math.PI },
    { id:'CEDAR-5', faction:'ISRAEL', type:'merkava', q:29, r:26, crewSkill:0.94, facing:Math.PI }
  ],

  missionHtml: 'Scale: one counter is one vehicle; one hex is 100 m.<br><br>USA: control both objectives by the end of turn 12.<br><br>Israel: hold either objective or destroy the U.S. force.',
  openingLog: ['Two objectives identified: Relay Station and Wadi Crossing.', 'Contact! U.S. armor enters the western corridor.'],

  determineWinner(game) {
    const usAlive = game.hasLivingUnits('US');
    const israelAlive = game.hasLivingUnits('ISRAEL');
    const usaControlsAll = game.objectives.every(objective => game.objectiveOwner(objective) === 'US');
    if (!usAlive) return 'ISRAEL';
    if (!israelAlive || usaControlsAll) return 'US';
    if (game.turn > this.turnLimit) return 'ISRAEL';
    return null;
  },

  victoryMessage(winner) {
    return winner === 'US' ? 'The corridor is secured.' : 'The defensive line holds.';
  }
};
