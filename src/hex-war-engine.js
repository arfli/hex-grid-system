(function (global) {
  'use strict';

  const SQRT_3 = Math.sqrt(3);

  class HexGrid {
    constructor(config) {
      this.columns = config.columns;
      this.rows = config.rows;
      this.size = config.hexSize;
      this.origin = config.origin || { x:74, y:70 };
      this.cells = this.createCells();
      this.cellMap = new Map(this.cells.map(cell => [this.key(cell), cell]));
    }

    createCells() {
      const cells = [];
      for (let row = 0; row < this.rows; row += 1) {
        for (let column = 0; column < this.columns; column += 1) {
          cells.push({ q:column - Math.floor(row / 2), r:row });
        }
      }
      return cells;
    }

    key(position) { return `${position.q},${position.r}`; }

    neighbors(position) {
      const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
      return directions.map(([q, r]) => this.cellMap.get(`${position.q + q},${position.r + r}`)).filter(Boolean);
    }

    distance(a, b) {
      return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
    }

    toPixel(position) {
      return {
        x:this.origin.x + this.size * SQRT_3 * (position.q + position.r / 2),
        y:this.origin.y + this.size * 1.5 * position.r
      };
    }

    polygon(position) {
      const center = this.toPixel(position);
      return Array.from({ length:6 }, (_, index) => {
        const angle = Math.PI / 3 * index + Math.PI / 6;
        return [center.x + this.size * Math.cos(angle), center.y + this.size * Math.sin(angle)];
      });
    }

    closestCell(x, y) {
      let closest = null;
      let closestDistance = Infinity;
      this.cells.forEach(cell => {
        const center = this.toPixel(cell);
        const distance = Math.hypot(x - center.x, y - center.y);
        if (distance < closestDistance) {
          closest = cell;
          closestDistance = distance;
        }
      });
      return closestDistance < this.size ? closest : null;
    }
  }

  class AssetStore {
    constructor(assetConfig, onLoad) {
      this.images = new Map();
      this.onLoad = onLoad;
      this.load('baseTerrain', assetConfig.baseTerrain);
      this.load('explosion', assetConfig.explosion);
      Object.entries(assetConfig.terrain || {}).forEach(([id, path]) => this.load(`terrain:${id}`, path));
      Object.entries(assetConfig.units || {}).forEach(([id, path]) => this.load(`unit:${id}`, path));
    }

    load(id, path) {
      const image = new Image();
      image.onload = () => this.onLoad?.();
      image.src = path;
      this.images.set(id, image);
    }

    get(id) { return this.images.get(id); }
  }

  class BattlefieldRenderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      this.game = game;
    }

    draw() {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const reachableKeys = new Set(this.game.reachableCells().map(cell => this.game.grid.key(cell)));
      this.game.grid.cells.forEach(cell => this.drawCell(cell, reachableKeys.has(this.game.grid.key(cell))));
      this.game.objectives.forEach((objective, index) => this.drawObjective(objective, index));
      this.game.livingUnits.forEach(unit => this.drawUnit(unit));
      this.drawTargets();
      this.drawImpacts();
    }

    hexPath(cell) {
      const points = this.game.grid.polygon(cell);
      this.context.beginPath();
      points.forEach((point, index) => index ? this.context.lineTo(...point) : this.context.moveTo(...point));
      this.context.closePath();
    }

    drawCell(cell, reachable) {
      const { context:ctx } = this;
      const center = this.game.grid.toPixel(cell);
      const size = this.game.grid.size;
      const terrainId = this.game.terrainAt(cell);
      this.hexPath(cell);
      ctx.save();
      ctx.clip();
      this.drawImage('baseTerrain', center.x - size, center.y - size, size * 2, size * 2, '#9a8658');
      if (terrainId) {
        const scale = terrainId === 'crater' ? 0.8 : 1;
        this.drawImage(`terrain:${terrainId}`, center.x - size * scale, center.y - size * scale, size * 2 * scale, size * 2 * scale);
      }
      ctx.restore();
      this.hexPath(cell);
      ctx.strokeStyle = '#3c3828';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (reachable) {
        this.hexPath(cell);
        ctx.fillStyle = '#4ea6e833';
        ctx.fill();
        ctx.strokeStyle = '#70c4ff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    drawImage(assetId, x, y, width, height, fallbackColor) {
      const image = this.game.assets.get(assetId);
      if (image?.complete && image.naturalWidth) this.context.drawImage(image, x, y, width, height);
      else if (fallbackColor) { this.context.fillStyle = fallbackColor; this.context.fillRect(x, y, width, height); }
    }

    drawObjective(objective, index) {
      const ctx = this.context;
      const center = this.game.grid.toPixel(objective);
      const owner = this.game.objectiveOwner(objective);
      ctx.fillStyle = owner ? this.game.factions[owner].color : '#ffe580';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◆', center.x, center.y - 23);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px ui-monospace';
      ctx.fillText(String(index + 1), center.x, center.y - 29);
    }

    drawUnit(unit) {
      const ctx = this.context;
      const center = this.game.grid.toPixel(unit);
      const color = this.game.factions[unit.faction].color;
      ctx.save();
      ctx.translate(center.x, center.y);
      // Vehicle source images point left (PI radians). Rotate that native
      // heading to the unit's persistent world-space facing direction.
      ctx.rotate(unit.facing - Math.PI);
      this.drawImage(`unit:${unit.image}`, -43, -25, 86, 50, '#333');
      ctx.restore();
      ctx.beginPath();
      ctx.arc(center.x, center.y, 34, 0, Math.PI * 2);
      ctx.strokeStyle = this.game.selected === unit ? '#fff' : color;
      ctx.lineWidth = this.game.selected === unit ? 4 : 2;
      ctx.stroke();
      ctx.fillStyle = '#111b';
      ctx.fillRect(center.x - 35, center.y + 29, 70, 16);
      ctx.fillStyle = color;
      ctx.font = 'bold 10px ui-monospace';
      ctx.textAlign = 'center';
      ctx.fillText(unit.id, center.x, center.y + 40);
      ctx.fillStyle = '#25251d';
      ctx.fillRect(center.x - 28, center.y - 34, 56, 5);
      ctx.fillStyle = unit.health / unit.maxHealth > 0.4 ? '#72b65d' : '#d95f43';
      ctx.fillRect(center.x - 28, center.y - 34, 56 * unit.health / unit.maxHealth, 5);
    }

    drawTargets() {
      const selected = this.game.selected;
      if (!selected || selected.hasFired || (selected.weapon.stationaryOnly && selected.hasMoved)) return;
      this.game.attackableUnits(selected).forEach(unit => {
        const center = this.game.grid.toPixel(unit);
        this.context.beginPath();
        this.context.arc(center.x, center.y, 41, 0, Math.PI * 2);
        this.context.strokeStyle = '#ff543f';
        this.context.setLineDash([6, 5]);
        this.context.lineWidth = 3;
        this.context.stroke();
        this.context.setLineDash([]);
      });
    }

    drawImpacts() {
      const now = performance.now();
      this.game.impacts.forEach(impact => {
        const center = this.game.grid.toPixel(impact);
        const progress = (now - impact.startedAt) / this.game.impactDuration;
        const size = 72 + progress * 38;
        this.context.save();
        this.context.globalAlpha = Math.min(1, (1 - progress) * 1.8);
        this.drawImage('explosion', center.x - size / 2, center.y - size / 2, size, size);
        this.context.restore();
      });
    }
  }

  class GameUI {
    constructor(game) {
      this.game = game;
      this.elements = Object.fromEntries(['kicker','scenarioTitle','scale','turnBox','turnTitle','turnSub','unitCard','mission','legend','log'].map(id => [id, document.getElementById(id)]));
    }

    initialize() {
      const scenario = this.game.scenario;
      const map = scenario.map;
      this.elements.kicker.textContent = scenario.kicker;
      this.elements.scenarioTitle.textContent = scenario.title;
      this.elements.scale.innerHTML = `<b>1 hex = ${map.metersPerHex} meters</b><br>Map: ${(map.columns * map.metersPerHex / 1000).toFixed(1)} × ${(map.rows * map.metersPerHex / 1000).toFixed(1)} km · 1 turn ≈ ${scenario.turnSeconds} sec`;
      this.elements.mission.innerHTML = scenario.missionHtml;
      this.elements.legend.innerHTML = Object.entries(this.game.factions).map(([, faction]) => `<span class="swatch" style="border-color:${faction.color}"></span><span>${faction.name}</span>`).join('') + Object.entries(scenario.terrainTypes).map(([, terrain]) => `<span>▧</span><span>${terrain.label}: ${terrain.defense ? `+${terrain.defense} defense` : `costs ${terrain.movementCost} movement`}</span>`).join('') + '<span class="objective">◆</span><span>Objective</span>';
    }

    update() {
      const game = this.game;
      const faction = game.factions[game.activeFaction];
      this.elements.turnBox.style.setProperty('--faction-color', faction.color);
      if (!game.gameOver) {
        this.elements.turnTitle.textContent = `${faction.name.toUpperCase()} TURN ${game.turn}`;
        this.elements.turnSub.textContent = faction.turnMessage;
      }
      this.updateUnitCard();
    }

    updateUnitCard() {
      const unit = this.game.selected;
      if (!unit) {
        const faction = this.game.factions[this.game.activeFaction];
        this.elements.unitCard.textContent = `Select a ${faction.name} unit to begin.`;
        return;
      }
      const meters = this.game.scenario.map.metersPerHex;
      const stationary = unit.weapon.stationaryOnly ? ' · stationary fire' : '';
      this.elements.unitCard.innerHTML = `<b>${unit.id}</b> · ${unit.name}<div class="bar"><i style="width:${100 * unit.health / unit.maxHealth}%"></i></div><div class="statline"><span>Armor integrity</span><span>${unit.health}/${unit.maxHealth}</span><span>Armor strength</span><span>${unit.armor}</span><span>Movement points</span><span>${unit.movementPoints}/${unit.movement}</span><span>Reach remaining</span><span>${unit.movementPoints * meters} m</span><span>Facing</span><span>${this.game.facingName(unit.facing)}</span><span>Weapon</span><span>${unit.weapon.name}</span><span>Effective reach</span><span>${unit.weapon.maxRangeMeters} m</span><span>Crew quality</span><span>${Math.round(unit.crewSkill * 100)}%</span><span>Moved / fired</span><span>${unit.hasMoved ? '✓' : '○'} / ${unit.hasFired ? '✓' : '○'}</span></div><small>${stationary}</small>`;
    }

    log(message) {
      const entry = document.createElement('div');
      entry.className = 'entry';
      entry.textContent = `T${this.game.turn} · ${message}`;
      this.elements.log.prepend(entry);
    }

    showWinner(factionId, message) {
      this.elements.turnTitle.textContent = `${this.game.factions[factionId].victoryName} VICTORY`;
      this.elements.turnSub.textContent = message;
    }
  }

  class HexWarGame {
    constructor(canvas, scenario, options = {}) {
      this.canvas = canvas;
      this.scenario = scenario;
      this.random = options.random || Math.random;
      this.grid = new HexGrid(scenario.map);
      this.factions = scenario.factions;
      this.objectives = scenario.objectives.map(item => ({ ...item }));
      this.terrain = this.createTerrainMap(scenario.terrain);
      this.units = this.createUnits(scenario.units, scenario.unitTypes);
      this.activeFaction = scenario.turnOrder[0];
      this.turn = 1;
      this.selected = null;
      this.gameOver = false;
      this.impacts = [];
      this.impactDuration = 900;
      this.assets = new AssetStore(scenario.assets, () => this.render());
      this.renderer = new BattlefieldRenderer(canvas, this);
      this.ui = new GameUI(this);
    }

    start() {
      this.canvas.width = this.scenario.map.width;
      this.canvas.height = this.scenario.map.height;
      this.ui.initialize();
      this.canvas.addEventListener('click', event => this.handleClick(event));
      document.getElementById('endTurn').addEventListener('click', () => this.endTurn());
      this.scenario.openingLog.forEach(message => this.ui.log(message));
      this.update();
    }

    createTerrainMap(groups) {
      const map = new Map();
      Object.entries(groups || {}).forEach(([terrainId, cells]) => cells.forEach(([q, r]) => map.set(`${q},${r}`, terrainId)));
      return map;
    }

    createUnits(definitions, types) {
      return definitions.map(definition => {
        const type = types[definition.type];
        return { ...definition, ...type, facing:definition.facing ?? 0, crewSkill:definition.crewSkill || 1, health:type.health, maxHealth:type.health, movementPoints:type.movement, hasMoved:false, hasFired:false, reactionFired:false };
      });
    }

    get livingUnits() { return this.units.filter(unit => unit.health > 0); }
    hasLivingUnits(faction) { return this.livingUnits.some(unit => unit.faction === faction); }
    terrainAt(cell) { return this.terrain.get(this.grid.key(cell)); }
    unitAt(cell) { return this.livingUnits.find(unit => unit.q === cell.q && unit.r === cell.r); }

    movementCost(destination) {
      const terrainId = this.terrainAt(destination);
      return this.scenario.terrainTypes[terrainId]?.movementCost || 1;
    }

    reachableCells() {
      const unit = this.selected;
      if (!unit || unit.movementPoints <= 0 || unit.faction !== this.activeFaction) return [];
      return [...this.buildMovementMap(unit).values()].filter(node => node.cost > 0).map(node => node.cell);
    }

    buildMovementMap(unit) {
      const startKey = this.grid.key(unit);
      const nodes = new Map([[startKey, { cell:{ q:unit.q, r:unit.r }, cost:0, previous:null }]]);
      const frontier = [nodes.get(startKey)];
      while (frontier.length) {
        frontier.sort((a, b) => a.cost - b.cost);
        const current = frontier.shift();
        this.grid.neighbors(current.cell).forEach(cell => {
          if (this.unitAt(cell) && this.grid.key(cell) !== startKey) return;
          const cost = current.cost + this.movementCost(cell);
          const key = this.grid.key(cell);
          if (cost > unit.movementPoints || (nodes.has(key) && nodes.get(key).cost <= cost)) return;
          const node = { cell, cost, previous:this.grid.key(current.cell) };
          nodes.set(key, node);
          frontier.push(node);
        });
      }
      return nodes;
    }

    pathTo(unit, destination) {
      const nodes = this.buildMovementMap(unit);
      let node = nodes.get(this.grid.key(destination));
      if (!node) return null;
      const path = [];
      while (node.previous) { path.unshift(node.cell); node = nodes.get(node.previous); }
      return { cells:path, cost:nodes.get(this.grid.key(destination)).cost };
    }

    attackableUnits(attacker) {
      const rangeInHexes = attacker.weapon.maxRangeMeters / this.scenario.map.metersPerHex;
      const visibilityInHexes = this.scenario.environment.visibilityMeters / this.scenario.map.metersPerHex;
      return this.livingUnits.filter(unit => unit.faction !== attacker.faction && this.grid.distance(attacker, unit) <= Math.min(rangeInHexes, visibilityInHexes));
    }

    objectiveOwner(objective) {
      const factions = new Set(this.livingUnits.filter(unit => this.grid.distance(unit, objective) <= 1).map(unit => unit.faction));
      return factions.size === 1 ? [...factions][0] : null;
    }

    handleClick(event) {
      if (this.gameOver) return;
      const bounds = this.canvas.getBoundingClientRect();
      const cell = this.grid.closestCell((event.clientX - bounds.left) * this.canvas.width / bounds.width, (event.clientY - bounds.top) * this.canvas.height / bounds.height);
      if (!cell) return;
      const clickedUnit = this.unitAt(cell);
      if (clickedUnit?.faction === this.activeFaction) return this.select(clickedUnit);
      if (this.selected && clickedUnit && !this.selected.hasFired && this.attackableUnits(this.selected).includes(clickedUnit)) {
        if (this.selected.weapon.stationaryOnly && this.selected.hasMoved) {
          this.ui.log(`${this.selected.id} must remain stationary to fire ${this.selected.weapon.name}.`);
          return;
        }
        return this.attack(this.selected, clickedUnit);
      }
      if (this.selected && !clickedUnit && this.reachableCells().some(item => this.grid.key(item) === this.grid.key(cell))) this.move(this.selected, cell);
    }

    select(unit) { this.selected = unit; this.ui.log(`Selected ${unit.id}.`); this.update(); }

    move(unit, destination) {
      const route = this.pathTo(unit, destination);
      if (!route) return;
      const startingPoints = unit.movementPoints;
      for (const step of route.cells) {
        unit.facing = this.directionAngle(unit, step);
        unit.q = step.q;
        unit.r = step.r;
        unit.movementPoints -= this.movementCost(step);
        this.resolveReactionFire(unit);
        if (unit.health <= 0) break;
      }
      unit.hasMoved = true;
      const spent = startingPoints - unit.movementPoints;
      this.ui.log(`${unit.id} spent ${spent} movement point${spent === 1 ? '' : 's'}; ${unit.movementPoints} remain.`);
      if (unit.health <= 0) this.selected = null;
      this.checkWinner();
      this.update();
    }

    resolveReactionFire(movingUnit) {
      const reactors = this.attackableEnemies(movingUnit).filter(unit =>
        !unit.reactionFired && !(unit.weapon.stationaryOnly && unit.hasMoved)
      );
      reactors.forEach(reactor => {
        if (movingUnit.health <= 0) return;
        reactor.reactionFired = true;
        reactor.facing = this.directionAngle(reactor, movingUnit);
        const modifier = this.scenario.combat?.reactionAccuracyModifier ?? 0.75;
        this.resolveAttack(reactor, movingUnit, { reaction:true, accuracyModifier:modifier });
      });
    }

    attackableEnemies(target) {
      return this.livingUnits.filter(unit => unit.faction !== target.faction && this.attackableUnits(unit).includes(target));
    }

    attack(attacker, target) {
      attacker.hasFired = true;
      attacker.facing = this.directionAngle(attacker, target);
      this.resolveAttack(attacker, target);
      this.checkWinner();
      this.update();
    }

    resolveAttack(attacker, target, options = {}) {
      const distance = this.grid.distance(attacker, target);
      const distanceMeters = distance * this.scenario.map.metersPerHex;
      const accuracy = this.calculateAccuracy(attacker, target, distanceMeters) * (options.accuracyModifier || 1);
      const hit = this.random() <= accuracy;
      const penetrationMargin = attacker.weapon.penetration - target.armor;
      const penetrated = hit && this.random() <= Math.max(0.2, Math.min(0.9, 0.55 + penetrationMargin * 0.12));
      const damage = penetrated ? Math.max(1, 3 + penetrationMargin + Math.floor(this.random() * 3)) : hit ? 1 : 0;
      const result = !hit ? 'miss' : penetrated ? `PENETRATION for ${damage}` : 'hit, armor held';
      const prefix = options.reaction ? 'REACTION — ' : '';
      this.ui.log(`${prefix}${attacker.id} fires at ${target.id} (${distanceMeters} m, ${Math.round(accuracy * 100)}% solution): ${result}.`);
      if (hit) { target.health = Math.max(0, target.health - damage); this.showImpact(target); }
      if (!target.health) this.ui.log(`${target.id} destroyed.`);
    }

    directionAngle(from, to) {
      const start = this.grid.toPixel(from);
      const end = this.grid.toPixel(to);
      const rawAngle = Math.atan2(end.y - start.y, end.x - start.x);
      const sixtyDegrees = Math.PI / 3;
      return Math.round(rawAngle / sixtyDegrees) * sixtyDegrees;
    }

    facingName(angle) {
      const normalized = ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
      return ['Right', 'Down-right', 'Down-left', 'Left', 'Up-left', 'Up-right'][normalized];
    }

    calculateAccuracy(attacker, target, distanceMeters) {
      const weapon = attacker.weapon;
      const environment = this.scenario.environment;
      let accuracy = distanceMeters <= weapon.optimalRangeMeters ? weapon.baseAccuracy : weapon.longRangeAccuracy;
      accuracy *= attacker.crewSkill;
      if (attacker.hasMoved) accuracy *= 0.82;
      if (distanceMeters > environment.crosswindPenaltyBeyondMeters) accuracy *= environment.crosswindAccuracyModifier;
      const targetTerrain = this.scenario.terrainTypes[this.terrainAt(target)];
      accuracy -= (targetTerrain?.defense || 0) * 0.10;
      return Math.max(0.05, Math.min(0.95, accuracy));
    }

    showImpact(unit) {
      this.impacts.push({ q:unit.q, r:unit.r, startedAt:performance.now() });
      requestAnimationFrame(time => this.animateImpacts(time));
    }

    animateImpacts(time) {
      this.impacts = this.impacts.filter(impact => time - impact.startedAt < this.impactDuration);
      this.render();
      if (this.impacts.length) requestAnimationFrame(nextTime => this.animateImpacts(nextTime));
    }

    endTurn() {
      if (this.gameOver) return;
      this.selected = null;
      const currentIndex = this.scenario.turnOrder.indexOf(this.activeFaction);
      const nextIndex = (currentIndex + 1) % this.scenario.turnOrder.length;
      if (nextIndex === 0) this.turn += 1;
      this.activeFaction = this.scenario.turnOrder[nextIndex];
      this.units.forEach(unit => { unit.reactionFired = false; });
      this.units.filter(unit => unit.faction === this.activeFaction).forEach(unit => { unit.movementPoints = unit.movement; unit.hasMoved = false; unit.hasFired = false; });
      this.ui.log(`${this.factions[this.activeFaction].name} begins turn ${this.turn}.`);
      this.checkWinner();
      this.update();
    }

    checkWinner() {
      const winner = this.scenario.determineWinner(this);
      if (!winner) return;
      this.gameOver = true;
      this.ui.showWinner(winner, this.scenario.victoryMessage(winner));
      this.ui.log(`SCENARIO COMPLETE — ${this.factions[winner].victoryName} wins.`);
    }

    render() { this.renderer?.draw(); }
    update() { this.render(); this.ui.update(); }
  }

  global.HexWar = { HexGrid, HexWarGame };
}(window));
