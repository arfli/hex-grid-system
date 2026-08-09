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
      Object.entries(assetConfig.effects || {}).forEach(([id, path]) => this.load(`effect:${id}`, path));
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
      this.drawAirMissions();
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
      if (unit.rotateSprite !== false) ctx.rotate(unit.facing - Math.PI);
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

    drawAirMissions() {
      const now = performance.now();
      this.game.airMissions.forEach(mission => {
        const progress = Math.max(0, Math.min(1, (now - mission.startedAt) / mission.duration));
        const width = 270;
        const height = 214;
        const x = -width + progress * (this.canvas.width + width * 2);
        const y = mission.y + Math.sin(progress * Math.PI * 2) * 16;
        this.context.save();
        this.context.globalAlpha = Math.min(1, progress * 8, (1 - progress) * 8);
        this.drawImage(`effect:${mission.image}`, x, y, width, height);
        this.context.restore();
      });
    }
  }

  class StoryIntro {
    constructor(root) {
      this.root = root;
      this.title = root.querySelector('#storyIntroTitle');
      this.text = root.querySelector('#storyText');
      this.status = root.querySelector('#storyStatus');
      this.control = root.querySelector('#storyControl');
      this.timer = null;
      this.typing = false;
    }

    play({ title, paragraphs, characterDelay = 16 }) {
      const fullText = paragraphs.join('\n\n');
      this.title.textContent = title;
      this.text.textContent = '';
      this.status.textContent = 'TRANSMISSION';
      this.control.textContent = 'Skip transmission';
      this.root.hidden = false;
      this.control.focus();

      return new Promise(resolve => {
        let index = 0;
        const completeTyping = () => {
          clearTimeout(this.timer);
          this.typing = false;
          this.text.textContent = fullText;
          this.text.scrollTop = 0;
          this.status.textContent = 'TRANSMISSION COMPLETE';
          this.control.textContent = 'Continue to briefing';
        };
        const close = () => {
          clearTimeout(this.timer);
          this.root.hidden = true;
          document.removeEventListener('keydown', onKeyDown);
          resolve();
        };
        const onControl = () => this.typing ? completeTyping() : close();
        const onKeyDown = event => {
          if (event.key === 'Escape') this.typing ? completeTyping() : close();
        };
        const typeNext = () => {
          if (!this.typing) return;
          index += 1;
          this.text.textContent = fullText.slice(0, index);
          this.text.scrollTop = this.text.scrollHeight;
          if (index >= fullText.length) { completeTyping(); return; }
          const current = fullText[index - 1];
          const pause = current === '.' ? characterDelay * 7 : current === '\n' ? characterDelay * 4 : characterDelay;
          this.timer = setTimeout(typeNext, pause);
        };

        this.control.onclick = onControl;
        document.addEventListener('keydown', onKeyDown);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) completeTyping();
        else { this.typing = true; typeNext(); }
      });
    }
  }

  class ModalDialog {
    constructor(root) {
      this.root = root;
      this.eyebrow = root.querySelector('#dialogEyebrow');
      this.title = root.querySelector('#dialogTitle');
      this.body = root.querySelector('#dialogBody');
      this.actions = root.querySelector('#dialogActions');
    }

    show({ eyebrow = '', title, bodyHtml, actions = [] }) {
      this.eyebrow.textContent = eyebrow;
      this.title.textContent = title;
      this.body.innerHTML = bodyHtml;
      this.actions.replaceChildren();
      actions.forEach(action => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        if (action.primary) button.classList.add('primary');
        button.addEventListener('click', action.onClick);
        this.actions.append(button);
      });
      this.root.hidden = false;
      this.actions.querySelector('button')?.focus();
    }

    hide() { this.root.hidden = true; }
  }

  class GameUI {
    constructor(game) {
      this.game = game;
      this.elements = Object.fromEntries(['kicker','scenarioTitle','scale','turnBox','turnTitle','turnSub','unitCard','mission','legend','log','endTurn'].map(id => [id, document.getElementById(id)]));
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
        this.elements.turnSub.textContent = faction.turnMessage + (game.cinematicRunning ? ' Air support operation in progress…' : game.aiRunning ? ' AI is issuing orders…' : '');
      }
      this.elements.endTurn.disabled = game.aiRunning || game.cinematicRunning || game.gameOver;
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
      this.elements.unitCard.innerHTML = `<b>${unit.id}</b> · ${unit.name}<div class="bar"><i style="width:${100 * unit.health / unit.maxHealth}%"></i></div><div class="statline"><span>Armor integrity</span><span>${unit.health}/${unit.maxHealth}</span><span>Armor strength</span><span>${unit.armor}</span><span>Movement points</span><span>${this.game.formatPoints(unit.movementPoints)}/${unit.movement}</span><span>Reach remaining</span><span>${Math.round(unit.movementPoints * meters)} m</span><span>Facing</span><span>${this.game.facingName(unit.facing)}</span><span>Weapon</span><span>${unit.weapon.name}</span><span>Effective reach</span><span>${unit.weapon.maxRangeMeters} m</span><span>Crew quality</span><span>${Math.round(unit.crewSkill * 100)}%</span><span>Morale</span><span>${Math.round(unit.morale * 100)}%</span><span>Moved / fired</span><span>${unit.hasMoved ? '✓' : '○'} / ${unit.hasFired ? '✓' : '○'}</span></div><small>${stationary}</small>`;
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
      this.showOutcome(factionId);
    }

    showOutcome(winnerId) {
      if (!this.game.dialog) return;
      const scenario = this.game.scenario;
      const loserId = scenario.turnOrder.find(id => id !== winnerId);
      const outcome = scenario.outcomes?.[winnerId];
      const winner = this.game.factions[winnerId];
      const loser = this.game.factions[loserId];
      const body = outcome ? `<p><b>${winner.name} wins.</b> ${loser.name} loses.</p><h3>Immediate aftermath</h3><p>${outcome.next}</p><h3>International reaction — speculative</h3><p>${outcome.internationalReaction}</p>` : `<p><b>${winner.name} wins.</b> ${loser.name} loses.</p>`;
      this.game.dialog.show({
        eyebrow:'Scenario complete · fictional outcome',
        title:outcome?.headline || `${winner.victoryName} victory`,
        bodyHtml:body,
        actions:[
          { label:'Play again', primary:true, onClick:() => window.location.reload() },
          { label:'Choose another side', onClick:() => { const url = new URL(window.location.href); url.searchParams.delete('side'); window.location.href = url.toString(); } }
        ]
      });
    }
  }

  class TacticalAI {
    constructor(game) { this.game = game; }

    async takeTurn() {
      const game = this.game;
      const faction = game.activeFaction;
      const config = game.scenario.ai?.[faction] || { strategy:'defensive-fire' };
      const units = game.livingUnits.filter(unit => unit.faction === faction);
      game.ui.log(`${game.factions[faction].name} AI begins issuing orders.`);

      for (const unit of units) {
        if (game.gameOver) return;
        if (config.strategy === 'breakthrough') await this.useBreakthroughUnit(unit, config);
        else await this.useDefensiveUnit(unit);
      }

      if (game.gameOver) return;
      await this.pause(350);
      game.aiRunning = false;
      game.endTurn(true);
    }

    async useDefensiveUnit(unit) {
      const target = this.chooseTarget(unit);
      if (!target) return;
      this.game.attack(unit, target);
      await this.pause(260);
    }

    async useBreakthroughUnit(unit, config) {
      let target = this.chooseTarget(unit);
      if (target) {
        this.game.attack(unit, target);
        await this.pause(220);
        if (this.game.gameOver) return;
      }

      const mustRemainStationary = unit.weapon.stationaryOnly && unit.hasFired;
      if (unit.health > 0 && unit.movementPoints > 0 && !mustRemainStationary) {
        const destination = this.chooseAdvanceCell(unit, config);
        if (destination) {
          this.game.selected = unit;
          this.game.move(unit, destination);
          await this.pause(260);
          if (this.game.gameOver) return;
        }
      }

      if (!unit.hasFired && unit.health > 0) {
        target = this.chooseTarget(unit);
        if (target && !(unit.weapon.stationaryOnly && unit.hasMoved)) {
          this.game.attack(unit, target);
          await this.pause(220);
        }
      }
    }

    chooseTarget(attacker) {
      const candidates = this.game.attackableUnits(attacker);
      return candidates.sort((a, b) => this.targetScore(attacker, b) - this.targetScore(attacker, a))[0] || null;
    }

    targetScore(attacker, target) {
      const distanceMeters = this.game.grid.distance(attacker, target) * this.game.scenario.map.metersPerHex;
      const accuracy = this.game.calculateAccuracy(attacker, target, distanceMeters);
      const vulnerability = Math.max(1, attacker.weapon.penetration - target.armor + 3);
      const damagePriority = 1 - target.health / target.maxHealth;
      return accuracy * vulnerability + damagePriority * 2;
    }

    chooseAdvanceCell(unit, config) {
      const nodes = [...this.game.buildMovementMap(unit).values()].filter(node => node.cost > 0);
      if (!nodes.length) return null;
      const objectives = this.game.objectives;
      const score = node => {
        const column = node.cell.q + Math.floor(node.cell.r / 2);
        if (Number.isFinite(config.goalColumn)) return column * 100 - node.cost;
        const objectiveDistance = Math.min(...objectives.map(objective => this.game.grid.distance(node.cell, objective)));
        return -objectiveDistance * 100 - node.cost;
      };
      nodes.sort((a, b) => score(b) - score(a));
      return nodes[0].cell;
    }

    pause(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
  }

  class HexWarGame {
    constructor(canvas, scenario, options = {}) {
      this.canvas = canvas;
      this.scenario = scenario;
      this.random = options.random || Math.random;
      this.playerFaction = options.playerFaction || scenario.turnOrder[0];
      this.dialog = options.dialog || null;
      this.grid = new HexGrid(scenario.map);
      this.factions = scenario.factions;
      this.objectives = scenario.objectives.map(item => ({ ...item }));
      this.terrain = this.createTerrainMap(scenario.terrain);
      this.units = this.createUnits(scenario.units, scenario.unitTypes);
      this.activeFaction = scenario.turnOrder[0];
      this.turn = 1;
      this.selected = null;
      this.gameOver = false;
      this.aiRunning = false;
      this.cinematicRunning = false;
      this.triggeredEvents = new Set();
      this.airMissions = [];
      this.impacts = [];
      this.impactDuration = 900;
      this.assets = new AssetStore(scenario.assets, () => this.render());
      this.renderer = new BattlefieldRenderer(canvas, this);
      this.ui = new GameUI(this);
      this.ai = new TacticalAI(this);
    }

    start() {
      this.canvas.width = this.scenario.map.width;
      this.canvas.height = this.scenario.map.height;
      this.ui.initialize();
      this.canvas.addEventListener('click', event => this.handleClick(event));
      document.getElementById('endTurn').addEventListener('click', () => this.endTurn());
      this.scenario.openingLog.forEach(message => this.ui.log(message));
      this.update();
      this.scheduleAITurn();
    }

    createTerrainMap(groups) {
      const map = new Map();
      Object.entries(groups || {}).forEach(([terrainId, cells]) => cells.forEach(([q, r]) => map.set(`${q},${r}`, terrainId)));
      return map;
    }

    createUnits(definitions, types) {
      return definitions.map(definition => {
        const type = types[definition.type];
        return { ...definition, ...type, facing:definition.facing ?? 0, crewSkill:definition.crewSkill || 1, morale:definition.morale || 1, health:type.health, maxHealth:type.health, movementPoints:type.movement, hasMoved:false, hasFired:false };
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
      if (this.gameOver || this.aiRunning || this.cinematicRunning || this.activeFaction !== this.playerFaction) return;
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
      }
      unit.hasMoved = true;
      const spent = startingPoints - unit.movementPoints;
      this.ui.log(`${unit.id} spent ${spent} movement point${spent === 1 ? '' : 's'}; ${unit.movementPoints} remain.`);
      this.checkWinner();
      this.update();
    }

    attack(attacker, target) {
      if (attacker.hasFired || attacker.health <= 0 || target.health <= 0) return;
      if (attacker.weapon.stationaryOnly && attacker.hasMoved) return;
      attacker.hasFired = true;
      attacker.facing = this.directionAngle(attacker, target);
      this.resolveAttack(attacker, target);
      this.checkWinner();
      this.update();
    }

    resolveAttack(attacker, target) {
      const distance = this.grid.distance(attacker, target);
      const distanceMeters = distance * this.scenario.map.metersPerHex;
      const accuracy = this.calculateAccuracy(attacker, target, distanceMeters);
      const hit = this.random() <= accuracy;
      const penetrationMargin = attacker.weapon.penetration - target.armor;
      const penetrated = hit && this.random() <= Math.max(0.2, Math.min(0.9, 0.55 + penetrationMargin * 0.12));
      const damage = penetrated ? Math.max(1, 3 + penetrationMargin + Math.floor(this.random() * 3)) : hit ? 1 : 0;
      const result = !hit ? 'miss' : penetrated ? `PENETRATION for ${damage}` : 'hit, armor held';
      this.ui.log(`${attacker.id} fires at ${target.id} (${distanceMeters} m, ${Math.round(accuracy * 100)}% solution): ${result}.`);
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

    formatPoints(points) { return Number.isInteger(points) ? points : points.toFixed(1); }

    calculateAccuracy(attacker, target, distanceMeters) {
      const weapon = attacker.weapon;
      const environment = this.scenario.environment;
      let accuracy = distanceMeters <= weapon.optimalRangeMeters ? weapon.baseAccuracy : weapon.longRangeAccuracy;
      accuracy *= attacker.crewSkill * attacker.morale;
      if (attacker.hasMoved) accuracy *= 0.82;
      if (distanceMeters > environment.crosswindPenaltyBeyondMeters) accuracy *= environment.crosswindAccuracyModifier;
      const targetTerrain = this.scenario.terrainTypes[this.terrainAt(target)];
      accuracy -= (targetTerrain?.defense || 0) * 0.10;
      return Math.max(0.05, Math.min(0.95, accuracy));
    }

    showImpact(unit) { this.showImpactAt(unit); }

    showImpactAt(position) {
      this.impacts.push({ q:position.q, r:position.r, startedAt:performance.now() });
      requestAnimationFrame(time => this.animateImpacts(time));
    }

    animateImpacts(time) {
      this.impacts = this.impacts.filter(impact => time - impact.startedAt < this.impactDuration);
      this.render();
      if (this.impacts.length) requestAnimationFrame(nextTime => this.animateImpacts(nextTime));
    }

    endTurn(fromAI = false) {
      if (this.gameOver || this.cinematicRunning || (this.aiRunning && !fromAI)) return;
      this.selected = null;
      const currentIndex = this.scenario.turnOrder.indexOf(this.activeFaction);
      const nextIndex = (currentIndex + 1) % this.scenario.turnOrder.length;
      if (nextIndex === 0) this.turn += 1;
      this.activeFaction = this.scenario.turnOrder[nextIndex];
      this.units.filter(unit => unit.faction === this.activeFaction).forEach(unit => { unit.movementPoints = unit.movement; unit.hasMoved = false; unit.hasFired = false; });
      this.ui.log(`${this.factions[this.activeFaction].name} begins turn ${this.turn}.`);
      this.checkWinner();
      const eventStarted = !this.gameOver && this.triggerTurnEvent();
      this.update();
      if (!eventStarted) this.scheduleAITurn();
    }

    triggerTurnEvent() {
      const support = this.scenario.airSupport;
      if (!support || this.triggeredEvents.has(support.id)) return false;
      if (this.activeFaction !== support.faction || this.turn !== support.turn) return false;
      const launched = this.launchAirSupport(support);
      if (launched) this.triggeredEvents.add(support.id);
      return launched;
    }

    launchAirSupport(config) {
      const enemies = this.livingUnits.filter(unit => unit.faction !== config.faction);
      const targets = [...enemies].sort(() => this.random() - 0.5).slice(0, Math.min(config.strikes, enemies.length));
      if (!targets.length) return false;
      const averageY = targets.reduce((sum, target) => sum + this.grid.toPixel(target).y, 0) / targets.length;
      const mission = {
        image:config.image,
        startedAt:performance.now(),
        duration:config.durationMs,
        y:Math.max(35, Math.min(this.canvas.height - 250, averageY - 107)),
        config,
        strikes:targets.map(target => ({ target, resolved:false, triggerX:this.grid.toPixel(target).x }))
      };
      this.cinematicRunning = true;
      this.airMissions.push(mission);
      this.ui.log(`Turn ${this.turn}: Apache formation enters from the west. Coalition air defenses are active.`);
      this.update();
      requestAnimationFrame(time => this.animateAirSupport(mission, time));
      return true;
    }

    animateAirSupport(mission, now) {
      const progress = Math.max(0, Math.min(1, (now - mission.startedAt) / mission.duration));
      const formationCenterX = -135 + progress * (this.canvas.width + 540);
      mission.strikes.forEach(strike => {
        if (!strike.resolved && formationCenterX >= strike.triggerX) this.resolveAirStrike(strike, mission.config);
      });
      this.render();
      if (progress < 1) {
        requestAnimationFrame(time => this.animateAirSupport(mission, time));
        return;
      }
      mission.strikes.filter(strike => !strike.resolved).forEach(strike => this.resolveAirStrike(strike, mission.config));
      this.airMissions = this.airMissions.filter(item => item !== mission);
      this.cinematicRunning = false;
      this.checkWinner();
      this.update();
      this.scheduleAITurn();
    }

    resolveAirStrike(strike, config) {
      strike.resolved = true;
      const target = strike.target;
      if (target.health <= 0) return;
      const hitChance = Math.max(0.05, Math.min(0.95, config.baseHitChance * config.airDefenseModifier));
      const hit = this.random() <= hitChance;
      if (hit) {
        const damageRange = config.maximumDamage - config.minimumDamage + 1;
        const damage = config.minimumDamage + Math.floor(this.random() * damageRange);
        target.health = Math.max(0, target.health - damage);
        this.showImpact(target);
        this.ui.log(`CAS strike hits ${target.id} (${Math.round(hitChance * 100)}% adjusted chance) for ${damage} damage.`);
        if (!target.health) this.ui.log(`${target.id} destroyed by precision air attack.`);
      } else {
        const nearby = this.grid.neighbors(target);
        const miss = nearby[Math.floor(this.random() * nearby.length)] || target;
        this.showImpactAt(miss);
        this.ui.log(`CAS strike misses ${target.id}; air defenses disrupt the attack (${Math.round(hitChance * 100)}% adjusted chance).`);
      }
    }

    scheduleAITurn() {
      if (this.gameOver || this.cinematicRunning || this.activeFaction === this.playerFaction || this.aiRunning) return;
      this.aiRunning = true;
      this.update();
      setTimeout(() => this.ai.takeTurn(), 450);
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

  class MapViewport {
    constructor(viewport, canvas, controls) {
      this.viewport = viewport;
      this.canvas = canvas;
      this.slider = controls.slider;
      this.output = controls.output;
      this.fitButton = controls.fitButton;
      this.scale = 1;
      this.drag = null;
      this.suppressNextClick = false;
    }

    start() {
      this.slider.addEventListener('input', () => this.setZoom(Number(this.slider.value) / 100));
      this.fitButton.addEventListener('click', () => this.fitMap());
      this.viewport.addEventListener('pointerdown', event => this.beginPan(event));
      this.viewport.addEventListener('pointermove', event => this.pan(event));
      this.viewport.addEventListener('pointerup', event => this.endPan(event));
      this.viewport.addEventListener('pointercancel', event => this.endPan(event));
      this.viewport.addEventListener('click', event => this.filterClick(event), true);
      this.viewport.addEventListener('wheel', event => this.handleWheel(event), { passive:false });
      this.setZoom(1);
    }

    beginPan(event) {
      if (event.button !== 0 || event.target.closest('#mapControls')) return;
      this.drag = {
        pointerId:event.pointerId,
        captureTarget:event.target,
        startX:event.clientX,
        startY:event.clientY,
        scrollLeft:this.viewport.scrollLeft,
        scrollTop:this.viewport.scrollTop,
        moved:false
      };
      event.target.setPointerCapture?.(event.pointerId);
    }

    pan(event) {
      if (!this.drag || event.pointerId !== this.drag.pointerId) return;
      const deltaX = event.clientX - this.drag.startX;
      const deltaY = event.clientY - this.drag.startY;
      if (Math.hypot(deltaX, deltaY) > 5) {
        this.drag.moved = true;
        this.viewport.classList.add('is-panning');
      }
      if (!this.drag.moved) return;
      this.viewport.scrollLeft = this.drag.scrollLeft - deltaX;
      this.viewport.scrollTop = this.drag.scrollTop - deltaY;
      event.preventDefault();
    }

    endPan(event) {
      if (!this.drag || event.pointerId !== this.drag.pointerId) return;
      if (this.drag.moved) {
        this.suppressNextClick = true;
        setTimeout(() => { this.suppressNextClick = false; }, 0);
      }
      if (this.drag.captureTarget.hasPointerCapture?.(event.pointerId)) {
        this.drag.captureTarget.releasePointerCapture(event.pointerId);
      }
      this.viewport.classList.remove('is-panning');
      this.drag = null;
    }

    filterClick(event) {
      if (!this.suppressNextClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    setZoom(scale) {
      const oldScale = this.scale;
      const contentCenterX = (this.viewport.scrollLeft + this.viewport.clientWidth / 2) / oldScale;
      const contentCenterY = (this.viewport.scrollTop + this.viewport.clientHeight / 2) / oldScale;
      this.scale = Math.max(0.35, Math.min(1.4, scale));
      this.canvas.style.width = `${this.canvas.width * this.scale}px`;
      this.canvas.style.height = `${this.canvas.height * this.scale}px`;
      this.slider.value = String(Math.round(this.scale * 100));
      this.output.value = `${Math.round(this.scale * 100)}%`;
      this.viewport.scrollLeft = contentCenterX * this.scale - this.viewport.clientWidth / 2;
      this.viewport.scrollTop = contentCenterY * this.scale - this.viewport.clientHeight / 2;
    }

    fitMap() {
      const horizontalScale = (this.viewport.clientWidth - 36) / this.canvas.width;
      const verticalScale = (this.viewport.clientHeight - 36) / this.canvas.height;
      this.setZoom(Math.min(horizontalScale, verticalScale, 1));
      this.viewport.scrollTo({ left:0, top:0, behavior:'smooth' });
    }

    handleWheel(event) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 0.05 : -0.05;
      this.setZoom(this.scale + direction);
    }
  }

  global.HexWar = { HexGrid, HexWarGame, TacticalAI, MapViewport, ModalDialog, StoryIntro };
}(window));
