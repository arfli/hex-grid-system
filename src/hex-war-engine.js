(function (global) {
  'use strict';

  const SQRT_3 = Math.sqrt(3);
  const isHeadless = typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined';
  const nowTime = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  const MOVE_ANIM = {
    enabled: true,
    durationPerHex: 240, // ms per hex (~0.24s for smooth tank glide)
    settleDuration: 130, // ms for arrival bounce/settle
    bob: true,           // subtle vertical hop while moving
    bobHeight: 5,        // max pixel bob height
    shadow: true,        // soft ground shadow under moving unit
    dust: true,          // dust particles at entered hexes
    settle: true         // slight bounce on arrival
  };

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
      this.cachedTerrainCanvas = null;
      this.terrainCacheDirty = true;
      this.perfStats = null;
    }

    invalidateTerrainCache() {
      this.terrainCacheDirty = true;
    }

    createOffscreenCanvas(width, height) {
      if (typeof OffscreenCanvas !== 'undefined') {
        try {
          return new OffscreenCanvas(width, height);
        } catch (_) { /* fallback to document.createElement */ }
      }
      if (typeof document !== 'undefined' && document.createElement) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        return c;
      }
      return null;
    }

    bakeTerrain() {
      if (!this.canvas) {
        this.terrainCacheDirty = false;
        return;
      }
      const w = this.canvas.width;
      const h = this.canvas.height;
      if (!this.cachedTerrainCanvas || this.cachedTerrainCanvas.width !== w || this.cachedTerrainCanvas.height !== h) {
        this.cachedTerrainCanvas = this.createOffscreenCanvas(w, h);
      }
      if (!this.cachedTerrainCanvas || typeof this.cachedTerrainCanvas.getContext !== 'function') return;
      const ctx = this.cachedTerrainCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      this.game.grid.cells.forEach(cell => this.bakeCell(cell, ctx));
      this.bakeTopographicOverlay(ctx, w, h);
      this.terrainCacheDirty = false;
    }

    bakeTopographicOverlay(ctx, w, h) {
      ctx.save();
      ctx.strokeStyle = 'rgba(75, 65, 45, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 6]);

      // Subtle topographic elevation contours
      const contourCenters = [
        { x: w * 0.25, y: h * 0.35, r1: 140, r2: 260, label: '+20m' },
        { x: w * 0.72, y: h * 0.40, r1: 160, r2: 300, label: '+10m' },
        { x: w * 0.45, y: h * 0.75, r1: 180, r2: 320, label: '+15m' }
      ];

      ctx.fillStyle = 'rgba(120, 105, 80, 0.55)';
      ctx.font = 'bold 9px ui-monospace';

      for (const c of contourCenters) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r1, c.r1 * 0.65, -0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(c.label, c.x + c.r1 * 0.8, c.y);

        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r2, c.r2 * 0.65, -0.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Military tactical grid tick marks along map edges
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(140, 130, 95, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.fillStyle = 'rgba(160, 150, 115, 0.5)';
      ctx.font = '9px ui-monospace';

      for (let x = 100; x < w; x += 300) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, 8);
        ctx.moveTo(x, h - 8); ctx.lineTo(x, h);
        ctx.stroke();
        ctx.fillText(`GR ${Math.round(x / 10)}`, x + 3, 14);
      }
      for (let y = 100; y < h; y += 250) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(8, y);
        ctx.moveTo(w - 8, y); ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillText(`LN ${Math.round(y / 10)}`, 10, y - 2);
      }

      ctx.restore();
    }

    bakeCell(cell, ctx) {
      const center = this.game.grid.toPixel(cell);
      const size = this.game.grid.size;
      const terrainId = this.game.terrainAt(cell);
      this.hexPath(cell, ctx);
      ctx.save();
      ctx.clip();
      this.drawImage('baseTerrain', center.x - size, center.y - size, size * 2, size * 2, '#9a8658', ctx);
      if (terrainId) {
        const scale = terrainId === 'crater' ? 0.8 : 1;
        this.drawImage(`terrain:${terrainId}`, center.x - size * scale, center.y - size * scale, size * 2 * scale, size * 2 * scale, null, ctx);
      }
      ctx.restore();
      this.hexPath(cell, ctx);
      ctx.strokeStyle = '#3c3828';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    drawReachableHighlight(cell) {
      const ctx = this.context;
      this.hexPath(cell, ctx);
      ctx.fillStyle = '#4ea6e833';
      ctx.fill();
      ctx.strokeStyle = '#70c4ff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    drawParticles() {
      this.drawGroundParticles();
      this.drawAirParticles();
    }

    drawGroundParticles() {
      const pool = this.game.particlePool;
      if (!pool) return;
      const ctx = this.context;
      for (const p of pool) {
        if (!p.active || p.alpha <= 0.01 || p.type !== 'dust') continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(185, 165, 125, ${p.alpha.toFixed(2)})`;
        ctx.fill();
        ctx.restore();
      }
    }

    drawAirParticles() {
      const pool = this.game.particlePool;
      if (!pool) return;
      const ctx = this.context;
      for (const p of pool) {
        if (!p.active || p.alpha <= 0.01 || p.type === 'dust') continue;
        ctx.save();
        if (p.type === 'muzzle') {
          ctx.translate(p.x, p.y);
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color || '#fde047';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else if (p.type === 'spark') {
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx || 0) * 4, p.y - (p.vy || 0) * 4);
          ctx.strokeStyle = p.color || '#fef08a';
          ctx.lineWidth = Math.max(1, p.size);
          ctx.stroke();
        } else if (p.type === 'smoke') {
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color || 'rgba(180, 180, 180, 0.4)';
          ctx.fill();
        } else if (p.type === 'ring') {
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = p.color || '#f97316';
          ctx.lineWidth = Math.max(1, 3 * p.alpha);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawTracers() {
      const pool = this.game.projectilePool;
      if (!pool) return;
      const ctx = this.context;
      const trailScale = this.game.tracerConfig?.trailLength || 1.0;

      for (const p of pool) {
        if (!p.active || p.delay > 0) continue;

        const headX = p.currentX;
        const headY = p.currentY;
        const profile = p.profile || {};
        const profileType = profile.type || 'kinetic';

        if (profileType === 'missile') {
          ctx.save();
          ctx.translate(headX, headY);
          ctx.rotate(p.angle);

          const bodyLen = p.length;
          const bodyW = p.width;

          // Rocket flame / exhaust jet
          const flicker = (Math.random() - 0.5) * 3;
          ctx.beginPath();
          ctx.moveTo(-bodyLen, -bodyW * 0.7);
          ctx.lineTo(-bodyLen - 10 + flicker, 0);
          ctx.lineTo(-bodyLen, bodyW * 0.7);
          ctx.fillStyle = p.glowColor || '#f97316';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-bodyLen, -bodyW * 0.35);
          ctx.lineTo(-bodyLen - 5, 0);
          ctx.lineTo(-bodyLen, bodyW * 0.35);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Missile body
          ctx.fillStyle = '#334155';
          ctx.fillRect(-bodyLen, -bodyW / 2, bodyLen, bodyW);

          // Nose cone
          ctx.beginPath();
          ctx.moveTo(0, -bodyW / 2);
          ctx.lineTo(bodyW * 1.2, 0);
          ctx.lineTo(0, bodyW / 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();

          // Steering fins
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-bodyLen * 0.8, -bodyW * 1.1);
          ctx.lineTo(-bodyLen * 0.95, -bodyW / 2);
          ctx.lineTo(-bodyLen * 0.8, bodyW * 1.1);
          ctx.stroke();

          ctx.restore();
        } else {
          const len = p.length * trailScale;
          const tailDist = Math.min(len, p.progress * p.distance);
          const tailX = headX - Math.cos(p.angle) * tailDist;
          const tailY = headY - Math.sin(p.angle) * tailDist;

          ctx.save();
          // Outer glow pass
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.strokeStyle = p.glowColor || '#60a5fa';
          ctx.lineWidth = p.width * 2.2;
          ctx.globalAlpha = (profile.trailAlpha || 0.8) * 0.45;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Inner core pass
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.strokeStyle = p.coreColor || '#ffffff';
          ctx.lineWidth = p.width;
          ctx.globalAlpha = profile.trailAlpha || 0.9;
          ctx.stroke();

          // Tip glow point
          ctx.beginPath();
          ctx.arc(headX, headY, p.width * 1.1, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 1.0;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    hexPath(cell, ctx = this.context) {
      const points = this.game.grid.polygon(cell);
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(...point) : ctx.moveTo(...point));
      ctx.closePath();
    }

    drawImage(assetId, x, y, width, height, fallbackColor, ctx = this.context) {
      const image = this.game.assets.get(assetId);
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, x, y, width, height);
      else if (fallbackColor) { ctx.fillStyle = fallbackColor; ctx.fillRect(x, y, width, height); }
    }

    draw() {
      const measure = BattlefieldRenderer.DEBUG_PERF || this.game.debugPerf;
      const t0 = measure ? nowTime() : 0;

      if (this.terrainCacheDirty || !this.cachedTerrainCanvas) {
        this.bakeTerrain();
      }

      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.cachedTerrainCanvas) {
        this.context.drawImage(this.cachedTerrainCanvas, 0, 0);
      } else {
        this.game.grid.cells.forEach(cell => this.bakeCell(cell, this.context));
      }

      // Hide reachable highlights while animating to avoid visual noise
      if (!this.game.isAnimating()) {
        const reachable = this.game.getReachableCells();
        if (reachable && reachable.length) {
          reachable.forEach(cell => this.drawReachableHighlight(cell));
        }
      }

      this.game.objectives.forEach((objective, index) => this.drawObjective(objective, index));
      this.drawGroundParticles();
      this.drawTacticalDatalinks();
      this.drawEngagementEnvelopes();
      this.game.livingUnits.forEach(unit => this.drawUnit(unit));
      this.drawAirParticles();
      this.drawTracers();
      this.drawTargets();
      this.drawImpacts();
      this.drawAirMissions();

      if (t0) {
        this.recordPerf(nowTime() - t0);
      }
    }

    recordPerf(duration) {
      if (!this.perfStats) {
        this.perfStats = { count: 0, total: 0, worst: 0, last: 0 };
      }
      this.perfStats.count++;
      this.perfStats.total += duration;
      this.perfStats.last = duration;
      if (duration > this.perfStats.worst) this.perfStats.worst = duration;
    }

    getPerfReport() {
      if (!this.perfStats || !this.perfStats.count) return 'No perf data';
      const avg = (this.perfStats.total / this.perfStats.count).toFixed(2);
      const worst = this.perfStats.worst.toFixed(2);
      const last = this.perfStats.last.toFixed(2);
      return `Frames: ${this.perfStats.count}, Last: ${last}ms, Avg: ${avg}ms, Worst: ${worst}ms`;
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

    drawTacticalDatalinks() {
      const ctx = this.context;
      const living = this.game.livingUnits;
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);

      for (const unit of living) {
        if (unit.isLeader) continue;
        const leader = this.game.getLeaderFor(unit);
        if (!leader || leader === unit || leader.health <= 0) continue;

        const uPos = this.game.getUnitRenderPosition(unit);
        const lPos = this.game.getUnitRenderPosition(leader);
        const inCmd = this.game.isInCommand(unit);

        if (inCmd) {
          ctx.strokeStyle = unit.faction === 'US' ? 'rgba(85, 170, 255, 0.35)' : 'rgba(217, 75, 66, 0.35)';
        } else {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
        }

        ctx.beginPath();
        ctx.moveTo(uPos.x, uPos.y);
        ctx.lineTo(lPos.x, lPos.y);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawEngagementEnvelopes() {
      const selected = this.game.selected;
      if (!selected || selected.health <= 0) return;
      const ctx = this.context;
      const pos = this.game.getUnitRenderPosition(selected);
      const hexMeters = this.game.scenario.map.metersPerHex || 100;
      const hexSize = this.game.grid.size;
      const pixelPerMeter = (hexSize * Math.sqrt(3)) / hexMeters;

      const weapon = selected.weapon;
      if (!weapon) return;

      const maxR = weapon.maxRangeMeters * pixelPerMeter;
      const optR = (weapon.optimalRangeMeters || weapon.maxRangeMeters * 0.6) * pixelPerMeter;
      const facing = selected.facing !== undefined ? selected.facing : 0;
      const halfArc = (Math.PI / 3) * 1.5;

      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, maxR, facing - halfArc, facing + halfArc);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, optR, facing - halfArc, facing + halfArc);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, optR, facing - halfArc, facing + halfArc);
      ctx.closePath();
      ctx.fillStyle = 'rgba(96, 165, 250, 0.04)';
      ctx.fill();

      ctx.restore();
    }

    drawUnit(unit) {
      const ctx = this.context;
      const anim = unit.animState;
      const center = anim ? { x: anim.renderX, y: anim.renderY } : this.game.grid.toPixel(unit);
      const bobY = (anim && anim.bobY) || 0;
      const facing = (anim && anim.renderFacing !== undefined) ? anim.renderFacing : unit.facing;
      const color = this.game.factions[unit.faction].color;

      if (anim && this.game.animConfig?.shadow) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + 14, 28, 12, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(center.x, center.y + bobY);
      // Vehicle source images point left (PI radians). Rotate that native
      // heading to the unit's persistent world-space facing direction.
      if (unit.rotateSprite !== false) ctx.rotate(facing - Math.PI);
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

      // Subsystem and tactical status badges
      let badgeY = center.y + 49;
      if (unit.subsystems) {
        const badges = [];
        if (unit.subsystems.tracks === 'mobility_kill') badges.push({ text: 'MOB', color: '#ef4444' });
        else if (unit.subsystems.engine === 'damaged') badges.push({ text: 'ENG', color: '#f59e0b' });
        if (unit.subsystems.gun === 'damaged') badges.push({ text: 'GUN', color: '#ef4444' });
        if (unit.subsystems.optics === 'damaged') badges.push({ text: 'OPT', color: '#f59e0b' });
        if (!this.game.isInCommand(unit)) badges.push({ text: '!C2', color: '#f97316' });

        if (badges.length) {
          const totalW = badges.length * 28;
          let bx = center.x - totalW / 2;
          ctx.font = 'bold 9px ui-monospace';
          for (const b of badges) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(bx, badgeY, 26, 12);
            ctx.fillStyle = b.color;
            ctx.fillText(b.text, bx + 13, badgeY + 9);
            bx += 28;
          }
        }
      } else if (unit.unitClass === 'infantry') {
        const badges = [];
        if (unit.suppression >= 0.7) badges.push({ text: 'PINNED', color: '#ef4444' });
        else if (unit.suppression >= 0.35) badges.push({ text: 'SUPPR', color: '#f59e0b' });
        if (!this.game.isInCommand(unit)) badges.push({ text: '!C2', color: '#f97316' });

        if (unit.soldiers !== null && unit.soldiers !== undefined) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(center.x - 28, badgeY, 56, 12);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 9px ui-monospace';
          ctx.fillText(`${unit.soldiers}/${unit.maxSoldiers} SOL`, center.x, badgeY + 9);
          badgeY += 14;
        }

        if (badges.length) {
          const totalW = badges.length * 36;
          let bx = center.x - totalW / 2;
          ctx.font = 'bold 8px ui-monospace';
          for (const b of badges) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(bx, badgeY, 34, 12);
            ctx.fillStyle = b.color;
            ctx.fillText(b.text, bx + 17, badgeY + 9);
            bx += 36;
          }
        }
      }
    }

    drawTargets() {
      const selected = this.game.selected;
      if (!selected || selected.hasFired || (selected.weapon.stationaryOnly && selected.hasMoved)) return;
      this.game.attackableUnits(selected).forEach(unit => {
        const anim = unit.animState;
        const center = anim ? { x: anim.renderX, y: anim.renderY } : this.game.grid.toPixel(unit);
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
      const now = nowTime();
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
      const now = nowTime();
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

  BattlefieldRenderer.DEBUG_PERF = false;

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
      const inCmd = this.game.isInCommand(unit);
      const c2Status = unit.isLeader
        ? `<span style="color:#60a5fa">★ Platoon HQ</span>`
        : inCmd
          ? `<span style="color:#72b65d">Linked (In C2)</span>`
          : `<span style="color:#ef4444">Severed (Out of C2)</span>`;

      const armorHtml = unit.armorAspect
        ? `<span>Armor (F/S/R)</span><span>${unit.armorAspect.front} / ${unit.armorAspect.side} / ${unit.armorAspect.rear}</span>`
        : `<span>Armor strength</span><span>${unit.armor}</span>`;

      let detailHtml = '';
      if (unit.subsystems) {
        const s = unit.subsystems;
        const eStr = s.engine === 'operational' ? 'OK' : '<b style="color:#f59e0b">DMG</b>';
        const tStr = s.tracks === 'operational' ? 'OK' : '<b style="color:#ef4444">KILL</b>';
        const oStr = s.optics === 'operational' ? 'OK' : '<b style="color:#f59e0b">DMG</b>';
        const gStr = s.gun === 'operational' ? 'OK' : '<b style="color:#ef4444">DMG</b>';
        detailHtml = `<span>Subsystems</span><span>ENG:${eStr} TRK:${tStr} OPT:${oStr} GUN:${gStr}</span>`;
      } else if (unit.unitClass === 'infantry') {
        const supprPct = Math.round((unit.suppression || 0) * 100);
        const supprLabel = unit.suppression >= 0.7 ? '<b style="color:#ef4444">PINNED</b>' : unit.suppression >= 0.35 ? '<b style="color:#f59e0b">SUPPR</b>' : 'Steady';
        detailHtml = `<span>Squad strength</span><span>${unit.soldiers || unit.health}/${unit.maxSoldiers || unit.maxHealth} Soldiers</span><span>Suppression</span><span>${supprPct}% (${supprLabel})</span>`;
      }

      this.elements.unitCard.innerHTML = `
        <div style="margin-bottom:2px"><b>${unit.id}</b> · ${unit.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${unit.platoon || 'Tactical Element'} · ${unit.role || ''}</div>
        <div class="bar"><i style="width:${100 * unit.health / unit.maxHealth}%"></i></div>
        <div class="statline">
          <span>Combat strength</span><span>${unit.health}/${unit.maxHealth}</span>
          ${armorHtml}
          <span>C2 Datalink</span><span>${c2Status}</span>
          ${detailHtml}
          <span>Movement points</span><span>${this.game.formatPoints(unit.movementPoints)}/${unit.movement}</span>
          <span>Reach remaining</span><span>${Math.round(unit.movementPoints * meters)} m</span>
          <span>Facing</span><span>${this.game.facingName(unit.facing)}</span>
          <span>Primary Weapon</span><span>${unit.weapon.name}</span>
          <span>Effective reach</span><span>${unit.weapon.maxRangeMeters} m</span>
          <span>Crew quality</span><span>${Math.round(unit.crewSkill * 100)}%</span>
          <span>Morale</span><span>${Math.round(unit.morale * 100)}%</span>
          <span>Moved / fired</span><span>${unit.hasMoved ? '✓' : '○'} / ${unit.hasFired ? '✓' : '○'}</span>
        </div>
        <small>${stationary}</small>
      `;
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
      await this.game.waitForAnimations();
      await this.pause(260);
    }

    async useBreakthroughUnit(unit, config) {
      let target = this.chooseTarget(unit);
      if (target) {
        this.game.attack(unit, target);
        await this.game.waitForAnimations();
        await this.pause(220);
        if (this.game.gameOver) return;
      }

      const mustRemainStationary = unit.weapon.stationaryOnly && unit.hasFired;
      if (unit.health > 0 && unit.movementPoints > 0 && !mustRemainStationary) {
        const destination = this.chooseAdvanceCell(unit, config);
        if (destination) {
          this.game.selected = unit;
          this.game.move(unit, destination);
          await this.game.waitForAnimations();
          await this.pause(140);
          if (this.game.gameOver) return;
        }
      }

      if (!unit.hasFired && unit.health > 0) {
        target = this.chooseTarget(unit);
        if (target && !(unit.weapon.stationaryOnly && unit.hasMoved)) {
          this.game.attack(unit, target);
          await this.game.waitForAnimations();
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
      this.assets = new AssetStore(scenario.assets, () => {
        this.invalidateTerrainCache();
        this.render();
      });
      this.renderer = new BattlefieldRenderer(canvas, this);
      this.ui = new GameUI(this);
      this.ai = new TacticalAI(this);
      this.animConfig = { ...MOVE_ANIM, ...(options.animConfig || {}) };
      const defaultTracerConfig = (typeof HexWar !== 'undefined' && HexWar.TRACER_FX)
        ? HexWar.TRACER_FX
        : { enabled: true, speedScale: 1.0, trailLength: 1.0, muzzleFlash: true, impactFlash: true, smokeTrail: true };
      this.tracerConfig = { ...defaultTracerConfig, ...(options.tracerConfig || {}) };
      this.animatingUnits = [];
      this.animWaiters = [];
      this.animRafId = null;
      this.lastAnimTime = 0;
      this.projectilePool = this.createProjectilePool(32);
      this.particlePool = this.createParticlePool(96);
      this.cachedReachableCells = null;
      this.cachedReachableKeys = new Set();
      this.debugPerf = !!options.debugPerf;
    }

    start() {
      this.canvas.width = this.scenario.map.width;
      this.canvas.height = this.scenario.map.height;
      this.ui.initialize();
      this.invalidateTerrainCache();
      this.invalidateReachableCache();
      this.canvas.addEventListener('click', event => this.handleClick(event));
      if (!isHeadless) {
        window.addEventListener('keydown', () => {
          if (this.isAnimating()) this.skipAnimations();
        });
      }
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
        const type = types[definition.type] || {};
        const isInfantry = type.unitClass === 'infantry' || type.rotateSprite === false;
        const unitClass = type.unitClass || (isInfantry ? 'infantry' : 'afv');

        const defaultAspect = isInfantry
          ? { front: type.armor || 2, side: type.armor || 2, rear: Math.max(1, (type.armor || 2) - 1), top: 1 }
          : { front: type.armor || 10, side: Math.max(1, Math.round((type.armor || 10) * 0.6)), rear: Math.max(1, Math.round((type.armor || 10) * 0.4)), top: Math.max(1, Math.round((type.armor || 10) * 0.3)) };

        const soldiers = definition.soldiers || type.soldiers || (isInfantry ? (type.health * 1.5) : null);

        return {
          ...definition,
          ...type,
          unitClass,
          armorAspect: type.armorAspect ? { ...type.armorAspect } : defaultAspect,
          subsystems: isInfantry ? null : {
            optics: 'operational',
            gun: 'operational',
            engine: 'operational',
            tracks: 'operational'
          },
          soldiers: soldiers,
          maxSoldiers: soldiers,
          suppression: 0,
          facing: definition.facing ?? 0,
          turretFacing: definition.facing ?? 0,
          crewSkill: definition.crewSkill || 1,
          morale: definition.morale || 1,
          health: type.health,
          maxHealth: type.health,
          movementPoints: type.movement,
          hasMoved: false,
          hasFired: false,
          company: definition.company || (definition.faction === 'US' ? 'A Co, 1-64 AR' : '1st Co, 124th Bde'),
          platoon: definition.platoon || '1st Platoon',
          role: definition.role || (definition.isLeader ? 'Platoon Leader' : 'Element'),
          isLeader: !!definition.isLeader,
          commandRadius: definition.commandRadius || (definition.isLeader ? 7 : 0),
          inCommand: true
        };
      });
    }

    isInCommand(unit) {
      if (!unit || unit.health <= 0) return false;
      if (unit.isLeader) return true;
      const platoonLeader = this.livingUnits.find(u => u.faction === unit.faction && u.platoon === unit.platoon && u.isLeader);
      if (platoonLeader) {
        const dist = this.grid.distance(unit, platoonLeader);
        if (dist <= (platoonLeader.commandRadius || 7)) return true;
      }
      const companyLeader = this.livingUnits.find(u => u.faction === unit.faction && u.isLeader);
      if (companyLeader) {
        const dist = this.grid.distance(unit, companyLeader);
        if (dist <= (companyLeader.commandRadius || 7) + 2) return true;
      }
      return false;
    }

    getLeaderFor(unit) {
      if (!unit) return null;
      if (unit.isLeader) return unit;
      return this.livingUnits.find(u => u.faction === unit.faction && u.platoon === unit.platoon && u.isLeader)
        || this.livingUnits.find(u => u.faction === unit.faction && u.isLeader)
        || null;
    }

    get livingUnits() { return this.units.filter(unit => unit.health > 0); }
    hasLivingUnits(faction) { return this.livingUnits.some(unit => unit.faction === faction); }
    terrainAt(cell) { return this.terrain.get(this.grid.key(cell)); }
    unitAt(cell) { return this.livingUnits.find(unit => unit.q === cell.q && unit.r === cell.r); }

    movementCost(destination) {
      const terrainId = this.terrainAt(destination);
      return this.scenario.terrainTypes[terrainId]?.movementCost || 1;
    }

    invalidateTerrainCache() {
      this.renderer?.invalidateTerrainCache();
    }

    invalidateReachableCache() {
      this.cachedReachableCells = null;
      this.cachedReachableKeys.clear();
    }

    getReachableCells() {
      if (this.cachedReachableCells !== null) {
        return this.cachedReachableCells;
      }
      const unit = this.selected;
      if (!unit || unit.movementPoints <= 0 || unit.faction !== this.activeFaction) {
        this.cachedReachableCells = [];
        this.cachedReachableKeys.clear();
        return this.cachedReachableCells;
      }
      if (unit.subsystems?.tracks === 'mobility_kill' || (unit.unitClass === 'infantry' && unit.suppression >= 0.7)) {
        this.cachedReachableCells = [];
        this.cachedReachableKeys.clear();
        return this.cachedReachableCells;
      }
      this.cachedReachableCells = [...this.buildMovementMap(unit).values()].filter(node => node.cost > 0).map(node => node.cell);
      this.cachedReachableKeys = new Set(this.cachedReachableCells.map(cell => this.grid.key(cell)));
      return this.cachedReachableCells;
    }

    reachableCells() {
      return this.getReachableCells();
    }

    buildMovementMap(unit) {
      const startKey = this.grid.key(unit);
      const nodes = new Map([[startKey, { cell:{ q:unit.q, r:unit.r }, cost:0, previous:null }]]);
      const frontier = [nodes.get(startKey)];
      const isDamagedEngine = unit.subsystems?.engine === 'damaged';
      while (frontier.length) {
        frontier.sort((a, b) => a.cost - b.cost);
        const current = frontier.shift();
        this.grid.neighbors(current.cell).forEach(cell => {
          if (this.unitAt(cell) && this.grid.key(cell) !== startKey) return;
          const baseCost = this.movementCost(cell);
          const cost = current.cost + (isDamagedEngine ? baseCost * 1.5 : baseCost);
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
      if (this.isAnimating()) {
        this.skipAnimations();
        return;
      }
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
      if (this.selected && !clickedUnit && this.getReachableCells().some(item => this.grid.key(item) === this.grid.key(cell))) this.move(this.selected, cell);
    }

    select(unit) { this.selected = unit; this.invalidateReachableCache(); this.ui.log(`Selected ${unit.id}.`); this.update(); }

    move(unit, destination) {
      if (unit.subsystems?.tracks === 'mobility_kill') {
        this.ui.log(`${unit.id} has suffered a mobility kill (tracks broken) and cannot maneuver.`);
        return;
      }
      if (unit.unitClass === 'infantry' && unit.suppression >= 0.7) {
        this.ui.log(`${unit.id} is pinned down by enemy fire and cannot maneuver.`);
        return;
      }
      this.invalidateReachableCache();
      const route = this.pathTo(unit, destination);
      if (!route || !route.cells.length) return;
      const startingPoints = unit.movementPoints;
      const startCell = { q: unit.q, r: unit.r };
      const steps = [...route.cells];
      const isDamagedEngine = unit.subsystems?.engine === 'damaged';
      for (const step of steps) {
        unit.facing = this.directionAngle(unit, step);
        unit.q = step.q;
        unit.r = step.r;
        const stepCost = this.movementCost(step) * (isDamagedEngine ? 1.5 : 1);
        unit.movementPoints -= stepCost;
      }
      unit.hasMoved = true;
      const spent = startingPoints - unit.movementPoints;
      this.ui.log(`${unit.id} spent ${this.formatPoints(spent)} movement points; ${this.formatPoints(unit.movementPoints)} remain.`);
      this.checkWinner();

      if (this.animConfig?.enabled && !isHeadless && steps.length > 0) {
        this.startUnitAnimation(unit, startCell, steps);
      } else {
        unit.animState = null;
        this.update();
      }
    }

    isAnimating() {
      return this.animatingUnits.length > 0 || this.hasActiveProjectiles();
    }

    hasActiveProjectiles() {
      return this.projectilePool ? this.projectilePool.some(p => p.active) : false;
    }

    waitForAnimations() {
      if (!this.isAnimating()) return Promise.resolve();
      return new Promise(resolve => {
        this.animWaiters.push(resolve);
      });
    }

    resolveAnimationWaiters() {
      if (this.animWaiters && this.animWaiters.length) {
        const waiters = this.animWaiters.splice(0);
        waiters.forEach(resolve => resolve());
      }
    }

    stopUnitAnimation(unit) {
      if (!unit) return;
      unit.animState = null;
      const idx = this.animatingUnits.indexOf(unit);
      if (idx !== -1) {
        this.animatingUnits.splice(idx, 1);
      }
      if (!this.isAnimating()) {
        this.resolveAnimationWaiters();
      }
    }

    skipAnimations() {
      for (const unit of this.animatingUnits) {
        if (unit) {
          unit.animState = null;
        }
      }
      this.animatingUnits = [];

      if (this.projectilePool) {
        for (const p of this.projectilePool) {
          if (!p.active) continue;
          p.active = false;
          if (p.outcome) {
            this.applyAttackOutcome(p.outcome);
            p.outcome = null;
          }
          if (p.onImpact) {
            p.onImpact();
            p.onImpact = null;
          }
        }
      }

      this.clearDustParticles();
      if (this.animRafId) {
        cancelAnimationFrame(this.animRafId);
        this.animRafId = null;
      }
      this.invalidateReachableCache();
      this.resolveAnimationWaiters();
      this.render();
    }

    createProjectilePool(size = 32) {
      return Array.from({ length: size }, () => ({
        active: false,
        weaponId: null,
        ammoId: null,
        profile: null,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        currentX: 0,
        currentY: 0,
        prevX: 0,
        prevY: 0,
        angle: 0,
        distance: 0,
        perpX: 0,
        perpY: 0,
        elapsed: 0,
        duration: 200,
        delay: 0,
        progress: 0,
        arcHeight: 0,
        wobbleFreq: 0,
        wobbleAmp: 0,
        smokeTimer: 0,
        isLastInBurst: true,
        outcome: null,
        onImpact: null,
        coreColor: '#fff',
        glowColor: '#60a5fa',
        width: 2.5,
        length: 40
      }));
    }

    createParticlePool(size = 96) {
      return Array.from({ length: size }, () => ({
        active: false,
        type: 'dust',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        alpha: 0,
        maxLife: 0,
        life: 0,
        color: null
      }));
    }

    spawnDust(x, y, facing) {
      if (!this.particlePool) return;
      const rearAngle = facing + Math.PI;
      for (let i = 0; i < 2; i++) {
        const p = this.particlePool.find(item => !item.active);
        if (!p) break;
        const angle = rearAngle + (Math.random() - 0.5) * 0.8;
        const speed = 0.3 + Math.random() * 0.5;
        p.active = true;
        p.type = 'dust';
        p.x = x + Math.cos(rearAngle) * 16 + (Math.random() - 0.5) * 8;
        p.y = y + Math.sin(rearAngle) * 8 + (Math.random() - 0.5) * 6;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.size = 5 + Math.random() * 5;
        p.alpha = 0.45;
        p.maxLife = 320;
        p.life = 0;
        p.color = null;
      }
    }

    spawnMuzzleFlash(x, y, facing, flashConfig) {
      if (!this.particlePool || !flashConfig) return;
      const p = this.particlePool.find(item => !item.active);
      if (p) {
        p.active = true;
        p.type = 'muzzle';
        p.x = x;
        p.y = y;
        p.vx = 0;
        p.vy = 0;
        p.size = flashConfig.size || 14;
        p.alpha = 1.0;
        p.maxLife = flashConfig.duration || 80;
        p.life = 0;
        p.color = flashConfig.color || '#fde047';
      }
      for (let i = 0; i < 3; i++) {
        const sp = this.particlePool.find(item => !item.active);
        if (!sp) break;
        const angle = facing + (Math.random() - 0.5) * 0.6;
        const speed = 0.8 + Math.random() * 0.9;
        sp.active = true;
        sp.type = 'spark';
        sp.x = x;
        sp.y = y;
        sp.vx = Math.cos(angle) * speed;
        sp.vy = Math.sin(angle) * speed;
        sp.size = 1.5;
        sp.alpha = 0.9;
        sp.maxLife = 120 + Math.random() * 80;
        sp.life = 0;
        sp.color = flashConfig.color || '#fef08a';
      }
    }

    spawnImpactSparks(x, y, impactConfig) {
      if (!this.particlePool || !impactConfig) return;
      const count = impactConfig.count || 8;
      const type = impactConfig.type || 'sparks';

      if (type === 'ring' || type === 'blast') {
        const rp = this.particlePool.find(item => !item.active);
        if (rp) {
          rp.active = true;
          rp.type = 'ring';
          rp.x = x;
          rp.y = y;
          rp.vx = 0;
          rp.vy = 0;
          rp.size = 8;
          rp.alpha = 1.0;
          rp.maxLife = impactConfig.life || 300;
          rp.life = 0;
          rp.color = impactConfig.color || '#f97316';
        }
      }

      for (let i = 0; i < count; i++) {
        const p = this.particlePool.find(item => !item.active);
        if (!p) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.4 + Math.random() * 1.2;
        p.active = true;
        p.type = type === 'blast' && i % 3 === 0 ? 'smoke' : 'spark';
        p.x = x + (Math.random() - 0.5) * 6;
        p.y = y + (Math.random() - 0.5) * 6;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 0.2;
        p.size = p.type === 'smoke' ? (4 + Math.random() * 4) : (impactConfig.size || 2.5);
        p.alpha = 0.95;
        p.maxLife = (impactConfig.life || 250) * (0.7 + Math.random() * 0.6);
        p.life = 0;
        p.color = p.type === 'smoke' ? 'rgba(140, 140, 140, 0.45)' : (impactConfig.color || '#fef08a');
      }
    }

    spawnTracerSmoke(x, y, smokeConfig) {
      if (!this.particlePool || !smokeConfig) return;
      const p = this.particlePool.find(item => !item.active);
      if (!p) return;
      p.active = true;
      p.type = 'smoke';
      p.x = x + (Math.random() - 0.5) * 4;
      p.y = y + (Math.random() - 0.5) * 4;
      p.vx = (Math.random() - 0.5) * 0.15;
      p.vy = -0.15 - Math.random() * 0.15;
      p.size = smokeConfig.size || 5;
      p.alpha = 0.5;
      p.maxLife = smokeConfig.maxLife || 400;
      p.life = 0;
      p.color = smokeConfig.color || 'rgba(180, 180, 180, 0.4)';
    }

    updateParticles(dt) {
      if (!this.particlePool) return false;
      let anyActive = false;
      for (const p of this.particlePool) {
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        anyActive = true;
        const progress = p.life / p.maxLife;
        if (p.type === 'dust') {
          p.x += p.vx * dt * 0.06;
          p.y += p.vy * dt * 0.06;
          p.size += dt * 0.015;
          p.alpha = Math.max(0, 0.45 * (1 - progress));
        } else if (p.type === 'spark') {
          p.x += p.vx * dt * 0.06;
          p.y += p.vy * dt * 0.06;
          p.vy += dt * 0.005;
          p.alpha = Math.max(0, 1 - progress);
        } else if (p.type === 'smoke') {
          p.x += p.vx * dt * 0.04;
          p.y += p.vy * dt * 0.04;
          p.size += dt * 0.02;
          p.alpha = Math.max(0, 0.5 * (1 - progress));
        } else if (p.type === 'muzzle') {
          p.alpha = Math.max(0, 1 - progress * progress);
        } else if (p.type === 'ring') {
          p.size += dt * 0.08;
          p.alpha = Math.max(0, 1 - progress);
        }
      }
      return anyActive;
    }

    stepProjectiles(dt, now) {
      if (!this.projectilePool) return;
      for (const p of this.projectilePool) {
        if (!p.active) continue;
        if (p.delay > 0) {
          p.delay -= dt;
          if (p.delay <= 0) {
            p.elapsed = -p.delay;
            if (this.tracerConfig.muzzleFlash && p.profile?.muzzleFlash) {
              this.spawnMuzzleFlash(p.startX, p.startY, p.angle, p.profile.muzzleFlash);
            }
          } else {
            continue;
          }
        } else {
          p.elapsed += dt;
        }

        const t = Math.min(1, p.elapsed / p.duration);
        p.progress = t;

        let curX = p.startX + (p.targetX - p.startX) * t;
        let curY = p.startY + (p.targetY - p.startY) * t;

        if (p.arcHeight) {
          curY -= Math.sin(t * Math.PI) * p.arcHeight;
        }
        if (p.wobbleAmp) {
          const wobble = Math.sin(t * Math.PI * p.wobbleFreq) * p.wobbleAmp * (1 - t * 0.2);
          curX += p.perpX * wobble;
          curY += p.perpY * wobble;
        }

        p.prevX = p.currentX;
        p.prevY = p.currentY;
        p.currentX = curX;
        p.currentY = curY;

        if (p.profile?.smoke && this.tracerConfig.smokeTrail) {
          p.smokeTimer += dt;
          if (p.smokeTimer >= p.profile.smoke.interval) {
            this.spawnTracerSmoke(curX, curY, p.profile.smoke);
            p.smokeTimer = 0;
          }
        }

        if (t >= 1) {
          p.active = false;
          if (this.tracerConfig.impactFlash && p.profile?.impact) {
            this.spawnImpactSparks(p.targetX, p.targetY, p.profile.impact);
          }
          if (p.outcome) {
            this.applyAttackOutcome(p.outcome);
            p.outcome = null;
          }
          if (p.onImpact) {
            p.onImpact();
            p.onImpact = null;
          }
        }
      }
    }

    hasActiveParticles() {
      return this.particlePool ? this.particlePool.some(p => p.active) : false;
    }

    clearDustParticles() {
      if (this.particlePool) {
        this.particlePool.forEach(p => { p.active = false; });
      }
    }

    startAnimationLoop() {
      if (isHeadless || this.animRafId) return;
      this.lastAnimTime = nowTime();
      const tick = (now) => {
        this.stepAnimation(now);
        if (this.isAnimating() || this.hasActiveParticles()) {
          this.animRafId = requestAnimationFrame(tick);
        } else {
          this.animRafId = null;
          this.render();
        }
      };
      this.animRafId = requestAnimationFrame(tick);
    }

    stepAnimation(now) {
      const rawDt = now - this.lastAnimTime;
      this.lastAnimTime = now;
      const dt = Math.max(0, Math.min(50, rawDt));

      for (let i = this.animatingUnits.length - 1; i >= 0; i--) {
        const unit = this.animatingUnits[i];
        if (!unit || unit.health <= 0 || !this.livingUnits.includes(unit)) {
          if (unit) unit.animState = null;
          this.animatingUnits.splice(i, 1);
          continue;
        }
        const done = this.stepUnitAnimation(unit, dt, now);
        if (done) {
          unit.animState = null;
          this.animatingUnits.splice(i, 1);
        }
      }

      this.stepProjectiles(dt, now);
      this.updateParticles(dt);

      if (!this.isAnimating()) {
        this.resolveAnimationWaiters();
      }

      this.render();
    }

    startUnitAnimation(unit, startCell, steps) {
      const startPixel = this.grid.toPixel(startCell);
      const waypoints = [startPixel, ...steps.map(step => this.grid.toPixel(step))];
      const segmentAngles = [];
      let prevCell = startCell;
      for (const step of steps) {
        segmentAngles.push(this.directionAngle(prevCell, step));
        prevCell = step;
      }

      const numSegments = steps.length;
      const durationPerHex = this.animConfig.durationPerHex;
      const totalDuration = numSegments * durationPerHex;
      const now = nowTime();

      unit.animState = {
        unit,
        startCell,
        steps,
        waypoints,
        segmentAngles,
        numSegments,
        durationPerHex,
        totalDuration,
        startTime: now,
        elapsed: 0,
        renderX: startPixel.x,
        renderY: startPixel.y,
        renderFacing: unit.facing,
        currentSegment: 0,
        bobY: 0,
        settleStartTime: 0,
        isSettling: false,
        finished: false
      };

      if (!this.animatingUnits.includes(unit)) {
        this.animatingUnits.push(unit);
      }
      this.startAnimationLoop();
      this.ui.update();
    }

    stepUnitAnimation(unit, dt, now) {
      const anim = unit.animState;
      if (!anim || anim.finished) return true;

      if (anim.isSettling) {
        const settleElapsed = now - anim.settleStartTime;
        const settleDur = this.animConfig.settleDuration;
        if (settleElapsed >= settleDur || !this.animConfig.settle) {
          anim.bobY = 0;
          anim.renderX = anim.waypoints[anim.numSegments].x;
          anim.renderY = anim.waypoints[anim.numSegments].y;
          anim.finished = true;
          this.invalidateReachableCache();
          return true;
        }
        const u = settleElapsed / settleDur;
        anim.bobY = Math.sin(u * Math.PI * 2) * (1 - u) * 3;
        return false;
      }

      anim.elapsed += dt;
      const N = anim.numSegments;
      const T1 = anim.durationPerHex;
      const T = anim.totalDuration;
      const t = Math.min(anim.elapsed, T);

      let s = 0;
      if (N === 1) {
        const tau = t / T;
        s = (1 - Math.cos(Math.PI * tau)) / 2;
      } else {
        const vMax = N / ((N - 1) * T1);
        const s1 = (vMax / 2) * T1;
        if (t <= T1) {
          s = (vMax / 2) * (t - (T1 / Math.PI) * Math.sin((Math.PI * t) / T1));
        } else if (t < T - T1) {
          s = s1 + vMax * (t - T1);
        } else {
          const tPrime = t - (T - T1);
          s = (N - s1) + (vMax / 2) * (tPrime + (T1 / Math.PI) * Math.sin((Math.PI * tPrime) / T1));
        }
      }
      s = Math.max(0, Math.min(N, s));

      const segIndex = Math.min(N - 1, Math.floor(s));
      const segU = s - segIndex;

      if (segIndex !== anim.currentSegment) {
        anim.currentSegment = segIndex;
        if (this.animConfig.dust) {
          this.spawnDust(anim.renderX, anim.renderY, anim.renderFacing);
        }
      }

      const p0 = anim.waypoints[segIndex];
      const p1 = anim.waypoints[segIndex + 1];
      anim.renderX = p0.x + (p1.x - p0.x) * segU;
      anim.renderY = p0.y + (p1.y - p0.y) * segU;

      if (this.animConfig.bob) {
        anim.bobY = -Math.sin(segU * Math.PI) * this.animConfig.bobHeight;
      } else {
        anim.bobY = 0;
      }

      const targetAngle = anim.segmentAngles[segIndex];
      let diff = targetAngle - anim.renderFacing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const turnSpeed = dt * 0.02;
      if (Math.abs(diff) <= turnSpeed) {
        anim.renderFacing = targetAngle;
      } else {
        anim.renderFacing += Math.sign(diff) * turnSpeed;
      }

      if (anim.elapsed >= T) {
        anim.renderFacing = unit.facing;
        if (this.animConfig.settle) {
          anim.isSettling = true;
          anim.settleStartTime = now;
        } else {
          anim.renderX = anim.waypoints[N].x;
          anim.renderY = anim.waypoints[N].y;
          anim.bobY = 0;
          anim.finished = true;
          this.invalidateReachableCache();
          return true;
        }
      }
      return false;
    }

    getUnitRenderPosition(unit) {
      if (!unit) return { x: 0, y: 0 };
      const anim = unit.animState;
      if (anim) {
        return { x: anim.renderX, y: anim.renderY + (anim.bobY || 0) };
      }
      return this.grid.toPixel(unit);
    }

    calculateAttackOutcome(attacker, target) {
      const distance = this.grid.distance(attacker, target);
      const distanceMeters = distance * this.scenario.map.metersPerHex;
      const accuracy = this.calculateAccuracy(attacker, target, distanceMeters);
      const hit = this.random() <= accuracy;

      // Calculate aspect angle (Front, Side, Rear)
      const fromPos = this.grid.toPixel(attacker);
      const toPos = this.grid.toPixel(target);
      const incomingAngle = Math.atan2(fromPos.y - toPos.y, fromPos.x - toPos.x);
      let angleDiff = incomingAngle - (target.facing !== undefined ? target.facing : 0);
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      const absAngleDeg = Math.abs(angleDiff) * (180 / Math.PI);

      let aspect = 'side';
      if (absAngleDeg <= 45) {
        aspect = 'front';
      } else if (absAngleDeg >= 135) {
        aspect = 'rear';
      } else {
        aspect = 'side';
      }

      const effectiveArmor = (target.armorAspect && target.armorAspect[aspect] !== undefined)
        ? target.armorAspect[aspect]
        : (target.armor !== undefined ? target.armor : 5);

      const penetrationMargin = attacker.weapon.penetration - effectiveArmor;
      const penetrated = hit && this.random() <= Math.max(0.2, Math.min(0.9, 0.55 + penetrationMargin * 0.12));
      const damage = penetrated ? Math.max(1, 3 + penetrationMargin + Math.floor(this.random() * 3)) : hit ? 1 : 0;

      let critical = null;
      if (penetrated && target.unitClass !== 'infantry' && target.subsystems) {
        const critRoll = this.random();
        if (critRoll < 0.22 && target.subsystems.tracks === 'operational') {
          critical = { system: 'tracks', label: 'Mobility Kill (Track Thrown)' };
        } else if (critRoll < 0.44 && target.subsystems.engine === 'operational') {
          critical = { system: 'engine', label: 'Engine Fire / Damaged' };
        } else if (critRoll < 0.64 && target.subsystems.optics === 'operational') {
          critical = { system: 'optics', label: 'Optics/FCS Blinded' };
        } else if (critRoll < 0.80 && target.subsystems.gun === 'operational') {
          critical = { system: 'gun', label: 'Main Gun Damaged' };
        }
      }

      const aspectLabel = aspect.toUpperCase();
      let result = !hit
        ? 'miss'
        : penetrated
          ? `PENETRATION (${aspectLabel} armor: ${effectiveArmor}) for ${damage}`
          : `hit (${aspectLabel} armor: ${effectiveArmor}), armor held`;
      if (critical) {
        result += ` [CRITICAL: ${critical.label}]`;
      }

      return { attacker, target, distanceMeters, accuracy, hit, penetrated, damage, result, aspect, critical };
    }

    applyAttackOutcome(outcome) {
      if (!outcome || !outcome.target) return;
      const { attacker, target, distanceMeters, accuracy, hit, penetrated, damage, result, critical } = outcome;
      if (attacker && target && distanceMeters !== undefined && accuracy !== undefined) {
        this.ui.log(`${attacker.id} fires at ${target.id} (${distanceMeters} m, ${Math.round(accuracy * 100)}% solution): ${result}.`);
      }
      if (hit) {
        target.health = Math.max(0, target.health - damage);
        if (critical && target.subsystems) {
          if (critical.system === 'tracks') {
            target.subsystems.tracks = 'mobility_kill';
            target.movementPoints = 0;
          } else if (critical.system === 'engine') {
            target.subsystems.engine = 'damaged';
            target.movementPoints = Math.floor(target.movementPoints / 2);
          } else if (critical.system === 'optics') {
            target.subsystems.optics = 'damaged';
          } else if (critical.system === 'gun') {
            target.subsystems.gun = 'damaged';
          }
        }
        if (target.unitClass === 'infantry') {
          target.suppression = Math.min(1.0, (target.suppression || 0) + (penetrated ? 0.40 : 0.25));
          if (target.soldiers) {
            const lost = Math.min(target.soldiers, Math.max(1, Math.round(damage * (target.soldiers / (target.maxHealth || 8)))));
            target.soldiers = Math.max(0, target.soldiers - lost);
          }
        }
        this.showImpact(target);
      } else {
        if (target.unitClass === 'infantry') {
          target.suppression = Math.min(1.0, (target.suppression || 0) + 0.15);
        }
      }
      if (!target.health) {
        this.stopUnitAnimation(target);
        this.invalidateReachableCache();
        this.ui.log(`${target.id} destroyed.`);
      }
      this.checkWinner();
      this.update();
    }

    attack(attacker, target) {
      if (attacker.hasFired || attacker.health <= 0 || target.health <= 0) return;
      if (attacker.weapon.stationaryOnly && attacker.hasMoved) return;
      attacker.hasFired = true;
      attacker.facing = this.directionAngle(attacker, target);
      const outcome = this.calculateAttackOutcome(attacker, target);

      if (isHeadless || !this.tracerConfig?.enabled) {
        this.applyAttackOutcome(outcome);
        return;
      }

      this.fireAttackTracer(attacker, target, outcome);
      this.update();
    }

    resolveAttack(attacker, target) {
      const outcome = this.calculateAttackOutcome(attacker, target);
      this.applyAttackOutcome(outcome);
    }

    fireAttackTracer(attacker, target, outcome) {
      if (!this.projectilePool) return;

      const attackerPos = this.getUnitRenderPosition(attacker);
      const targetPos = this.getUnitRenderPosition(target);
      const visual = (typeof HexWar !== 'undefined' && HexWar.getVisualWeaponAndAmmo)
        ? HexWar.getVisualWeaponAndAmmo(attacker, target)
        : null;

      const weapon = visual?.weapon || attacker.weapon;
      const ammo = visual?.ammo;
      const profileId = ammo?.tracerProfile || weapon?.tracerProfile || 'apfsds';
      const profile = (typeof HexWar !== 'undefined' && HexWar.getTracerProfile)
        ? HexWar.getTracerProfile(profileId)
        : null;

      const speedScale = this.tracerConfig.speedScale || 1.0;
      const baseDuration = (profile?.duration || 200) / speedScale;
      const facing = attacker.facing !== undefined ? attacker.facing : this.directionAngle(attacker, target);

      const startX = attackerPos.x + Math.cos(facing) * 24;
      const startY = attackerPos.y + Math.sin(facing) * 14;

      let targetX = targetPos.x;
      let targetY = targetPos.y;
      if (!outcome.hit) {
        const missAngle = facing + (Math.random() - 0.5) * 0.45;
        const missDist = 38 + Math.random() * 25;
        targetX += Math.cos(missAngle) * missDist;
        targetY += Math.sin(missAngle) * missDist;
      }

      const burstCount = profile?.burstCount || 1;
      const burstInterval = profile?.burstInterval || 45;

      for (let i = 0; i < burstCount; i++) {
        const slot = this.projectilePool.find(p => !p.active);
        if (!slot) break;

        const delay = i * burstInterval;
        const isLast = (i === burstCount - 1);

        slot.active = true;
        slot.weaponId = weapon?.id || null;
        slot.ammoId = visual?.ammoId || null;
        slot.profile = profile;
        slot.startX = startX;
        slot.startY = startY;
        slot.targetX = targetX + (burstCount > 1 ? (Math.random() - 0.5) * 12 : 0);
        slot.targetY = targetY + (burstCount > 1 ? (Math.random() - 0.5) * 12 : 0);
        slot.currentX = startX;
        slot.currentY = startY;
        slot.prevX = startX;
        slot.prevY = startY;

        const dx = slot.targetX - startX;
        const dy = slot.targetY - startY;
        slot.distance = Math.hypot(dx, dy);
        slot.angle = Math.atan2(dy, dx);
        slot.perpX = -Math.sin(slot.angle);
        slot.perpY = Math.cos(slot.angle);

        slot.elapsed = 0;
        slot.duration = baseDuration;
        slot.delay = delay;
        slot.progress = 0;

        slot.arcHeight = profile?.arcHeight || 0;
        slot.wobbleFreq = profile?.wobble?.freq || 0;
        slot.wobbleAmp = profile?.wobble?.amp || 0;
        slot.smokeTimer = 0;

        slot.coreColor = profile?.coreColor || '#ffffff';
        slot.glowColor = profile?.glowColor || '#60a5fa';
        slot.width = profile?.width || 2.5;
        slot.length = profile?.length || 40;

        slot.isLastInBurst = isLast;
        slot.outcome = isLast ? outcome : null;
        slot.onImpact = null;

        if (delay === 0 && this.tracerConfig.muzzleFlash && profile?.muzzleFlash) {
          this.spawnMuzzleFlash(startX, startY, facing, profile.muzzleFlash);
        }
      }

      this.startAnimationLoop();
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

      // Subsystem & C2 accuracy modifiers
      if (attacker.subsystems?.optics === 'damaged') {
        accuracy *= 0.75;
      }
      if (attacker.subsystems?.gun === 'damaged') {
        accuracy *= 0.65;
      }
      if (attacker.unitClass === 'infantry' && attacker.suppression > 0.3) {
        accuracy *= Math.max(0.3, 1.0 - (attacker.suppression * 0.45));
      }
      if (!this.isInCommand(attacker)) {
        accuracy *= 0.90;
      }

      return Math.max(0.05, Math.min(0.95, accuracy));
    }

    showImpact(unit) { this.showImpactAt(unit); }

    showImpactAt(position) {
      this.impacts.push({ q:position.q, r:position.r, startedAt:nowTime() });
      if (!isHeadless) requestAnimationFrame(time => this.animateImpacts(time));
    }

    animateImpacts(time) {
      this.impacts = this.impacts.filter(impact => time - impact.startedAt < this.impactDuration);
      this.render();
      if (this.impacts.length && !isHeadless) requestAnimationFrame(nextTime => this.animateImpacts(nextTime));
    }

    endTurn(fromAI = false) {
      if (this.isAnimating()) this.skipAnimations();
      if (this.gameOver || this.cinematicRunning || (this.aiRunning && !fromAI)) return;
      this.selected = null;
      this.invalidateReachableCache();
      const currentIndex = this.scenario.turnOrder.indexOf(this.activeFaction);
      const nextIndex = (currentIndex + 1) % this.scenario.turnOrder.length;
      if (nextIndex === 0) this.turn += 1;
      this.activeFaction = this.scenario.turnOrder[nextIndex];
      this.units.filter(unit => unit.faction === this.activeFaction).forEach(unit => {
        let baseMv = unit.movement;
        if (unit.subsystems?.tracks === 'mobility_kill') {
          baseMv = 0;
        } else if (unit.subsystems?.engine === 'damaged') {
          baseMv = Math.max(1, Math.floor(baseMv / 2));
        }
        unit.movementPoints = baseMv;
        unit.hasMoved = false;
        unit.hasFired = false;
        if (unit.unitClass === 'infantry') {
          const inCmd = this.isInCommand(unit);
          unit.suppression = Math.max(0, (unit.suppression || 0) - (inCmd ? 0.35 : 0.15));
        }
      });
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
        startedAt:nowTime(),
        duration:config.durationMs,
        y:Math.max(35, Math.min(this.canvas.height - 250, averageY - 107)),
        config,
        strikes:targets.map(target => ({ target, resolved:false, triggerX:this.grid.toPixel(target).x }))
      };
      this.cinematicRunning = true;
      this.airMissions.push(mission);
      this.ui.log(`Turn ${this.turn}: Apache formation enters from the west. Coalition air defenses are active.`);
      this.update();
      if (!isHeadless) requestAnimationFrame(time => this.animateAirSupport(mission, time));
      return true;
    }

    animateAirSupport(mission, now) {
      const progress = Math.max(0, Math.min(1, (now - mission.startedAt) / mission.duration));
      const formationCenterX = -135 + progress * (this.canvas.width + 540);
      const currentY = mission.y + Math.sin(progress * Math.PI * 2) * 16;
      mission.strikes.forEach(strike => {
        if (!strike.resolved && formationCenterX >= strike.triggerX) {
          this.resolveAirStrike(strike, mission.config, formationCenterX, currentY);
        }
      });
      this.render();
      if (progress < 1) {
        if (!isHeadless) requestAnimationFrame(time => this.animateAirSupport(mission, time));
        return;
      }
      mission.strikes.filter(strike => !strike.resolved).forEach(strike => {
        this.resolveAirStrike(strike, mission.config, formationCenterX, currentY);
      });
      this.airMissions = this.airMissions.filter(item => item !== mission);
      this.cinematicRunning = false;
      this.checkWinner();
      this.update();
      this.scheduleAITurn();
    }

    resolveAirStrike(strike, config, sourceX, sourceY) {
      strike.resolved = true;
      const target = strike.target;
      if (target.health <= 0) return;
      const hitChance = Math.max(0.05, Math.min(0.95, config.baseHitChance * config.airDefenseModifier));
      const hit = this.random() <= hitChance;
      let damage = 0;
      if (hit) {
        const damageRange = config.maximumDamage - config.minimumDamage + 1;
        damage = config.minimumDamage + Math.floor(this.random() * damageRange);
      }
      const nearby = this.grid.neighbors(target);
      const missTarget = nearby[Math.floor(this.random() * nearby.length)] || target;
      const impactCell = hit ? target : missTarget;
      const impactPos = this.grid.toPixel(impactCell);

      const applyStrike = () => {
        if (hit) {
          target.health = Math.max(0, target.health - damage);
          this.showImpact(target);
          this.ui.log(`CAS strike hits ${target.id} (${Math.round(hitChance * 100)}% adjusted chance) for ${damage} damage.`);
          if (!target.health) {
            this.stopUnitAnimation(target);
            this.invalidateReachableCache();
            this.ui.log(`${target.id} destroyed by precision air attack.`);
          }
        } else {
          this.showImpactAt(missTarget);
          this.ui.log(`CAS strike misses ${target.id}; air defenses disrupt the attack (${Math.round(hitChance * 100)}% adjusted chance).`);
        }
        this.checkWinner();
        this.update();
      };

      if (isHeadless || !this.tracerConfig?.enabled || sourceX === undefined) {
        applyStrike();
        return;
      }

      const slot = this.projectilePool ? this.projectilePool.find(p => !p.active) : null;
      if (!slot) {
        applyStrike();
        return;
      }

      const profile = (typeof HexWar !== 'undefined' && HexWar.getTracerProfile)
        ? HexWar.getTracerProfile('atgm')
        : null;

      const startX = sourceX;
      const startY = sourceY + 45;
      const dx = impactPos.x - startX;
      const dy = impactPos.y - startY;

      slot.active = true;
      slot.weaponId = 'hellfire_atgm';
      slot.ammoId = 'ATGM';
      slot.profile = profile;
      slot.startX = startX;
      slot.startY = startY;
      slot.targetX = impactPos.x;
      slot.targetY = impactPos.y;
      slot.currentX = startX;
      slot.currentY = startY;
      slot.prevX = startX;
      slot.prevY = startY;
      slot.distance = Math.hypot(dx, dy);
      slot.angle = Math.atan2(dy, dx);
      slot.perpX = -Math.sin(slot.angle);
      slot.perpY = Math.cos(slot.angle);
      slot.elapsed = 0;
      slot.duration = (profile?.duration || 650) * 0.9;
      slot.delay = 0;
      slot.progress = 0;
      slot.arcHeight = 0;
      slot.wobbleFreq = profile?.wobble?.freq || 10;
      slot.wobbleAmp = profile?.wobble?.amp || 3.5;
      slot.smokeTimer = 0;
      slot.coreColor = profile?.coreColor || '#fef3c7';
      slot.glowColor = profile?.glowColor || '#f97316';
      slot.width = profile?.width || 4.0;
      slot.length = profile?.length || 16;
      slot.isLastInBurst = true;
      slot.outcome = null;
      slot.onImpact = applyStrike;

      if (this.tracerConfig.muzzleFlash && profile?.muzzleFlash) {
        this.spawnMuzzleFlash(startX, startY, slot.angle, profile.muzzleFlash);
      }

      this.startAnimationLoop();
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

    showOrderOfBattleModal() {
      if (!this.dialog) return;

      const factions = this.scenario.turnOrder;
      let html = '<div class="oobTree" style="display:flex;flex-direction:column;gap:16px;max-height:60vh;overflow-y:auto;padding-right:8px">';

      for (const fId of factions) {
        const faction = this.factions[fId];
        const fUnits = this.units.filter(u => u.faction === fId);
        const livingCount = fUnits.filter(u => u.health > 0).length;

        html += `
          <div style="border-left:4px solid ${faction.color};padding-left:12px;background:rgba(255,255,255,0.02);padding:10px;border-radius:4px">
            <h3 style="margin:0 0 6px;color:${faction.color};font-size:15px">${faction.name} (Active: ${livingCount}/${fUnits.length})</h3>
        `;

        // Group by Platoon
        const platoons = {};
        for (const u of fUnits) {
          const pltKey = u.platoon || 'Independent Elements';
          if (!platoons[pltKey]) platoons[pltKey] = [];
          platoons[pltKey].push(u);
        }

        for (const [pltName, pUnits] of Object.entries(platoons)) {
          const leader = pUnits.find(u => u.isLeader);
          html += `
            <div style="margin:8px 0 4px;padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid #333">
              <div style="font-weight:bold;color:#f1f5f9;font-size:12px">▸ ${pltName} ${leader ? `(HQ: ${leader.id})` : ''}</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:6px;margin-top:6px">
          `;

          for (const u of pUnits) {
            const isAlive = u.health > 0;
            const inCmd = this.isInCommand(u);
            const statusColor = !isAlive ? '#64748b' : inCmd ? '#22c55e' : '#f97316';
            const statusText = !isAlive ? 'DESTROYED' : inCmd ? 'IN C2' : 'OUT OF C2';

            let extraInfo = '';
            if (isAlive) {
              if (u.subsystems) {
                const s = u.subsystems;
                const faults = [];
                if (s.tracks === 'mobility_kill') faults.push('TRK-KILL');
                if (s.engine === 'damaged') faults.push('ENG-DMG');
                if (s.gun === 'damaged') faults.push('GUN-DMG');
                if (s.optics === 'damaged') faults.push('OPT-DMG');
                extraInfo = faults.length ? `<span style="color:#ef4444">${faults.join(', ')}</span>` : `<span style="color:#22c55e">All Systems Nominal</span>`;
              } else if (u.unitClass === 'infantry') {
                extraInfo = `<span>${u.soldiers || u.health}/${u.maxSoldiers || u.maxHealth} Soldiers · ${Math.round((u.suppression || 0) * 100)}% Suppr</span>`;
              }
            }

            html += `
              <div style="padding:6px;border:1px solid #3c3828;background:${isAlive ? '#181913' : '#10100d'};font-size:11px">
                <div style="display:flex;justify-content:space-between">
                  <strong>${u.id}</strong>
                  <span style="color:${statusColor}">${statusText}</span>
                </div>
                <div style="color:var(--muted)">${u.name}</div>
                <div style="font-size:10px;margin-top:2px">${extraInfo}</div>
              </div>
            `;
          }

          html += `</div></div>`;
        }

        html += `</div>`;
      }

      html += '</div>';

      this.dialog.show({
        eyebrow: 'BATTLEFIELD MANAGEMENT SYSTEM',
        title: 'ORDER OF BATTLE & C2 NETWORK',
        bodyHtml: html,
        actions: [{ label: 'Dismiss', onClick: () => this.dialog.hide() }]
      });
    }

    showForceBuilderModal() {
      if (!this.dialog) return;

      const currentTurns = this.scenario.turnLimit || 14;
      const currentVis = this.scenario.environment.visibilityMeters || 3500;
      const currentWind = this.scenario.environment.crosswindMps || 5;

      const html = `
        <div style="line-height:1.6">
          <p>Customize battlefield environment, operational tempo, and forces for this engagement:</p>
          <div style="display:flex;flex-direction:column;gap:12px;margin:14px 0">
            <label style="display:flex;justify-content:space-between;align-items:center">
              <span><b>Turn Limit:</b></span>
              <select id="cfgTurns" style="padding:4px 8px;background:#202117;color:#fff;border:1px solid #666">
                <option value="10" ${currentTurns === 10 ? 'selected' : ''}>10 Turns (Rapid Assault)</option>
                <option value="14" ${currentTurns === 14 ? 'selected' : ''}>14 Turns (Standard Scenario)</option>
                <option value="20" ${currentTurns === 20 ? 'selected' : ''}>20 Turns (Extended Grinding Operation)</option>
              </select>
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center">
              <span><b>Weather & Visibility:</b></span>
              <select id="cfgWeather" style="padding:4px 8px;background:#202117;color:#fff;border:1px solid #666">
                <option value="clear" ${currentVis >= 3500 ? 'selected' : ''}>Clear Desert (3,500 m / Full Vision)</option>
                <option value="dust" ${currentVis === 2200 ? 'selected' : ''}>Dust Storm (2,200 m / Thermal Advantage)</option>
                <option value="night" ${currentVis <= 1500 ? 'selected' : ''}>Dusk / Night (1,500 m / Knife-Fight Range)</option>
              </select>
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center">
              <span><b>Crosswind Severity:</b></span>
              <select id="cfgWind" style="padding:4px 8px;background:#202117;color:#fff;border:1px solid #666">
                <option value="light" ${currentWind <= 5 ? 'selected' : ''}>Light Breeze (5 m/s - 95% at range)</option>
                <option value="gusting" ${currentWind > 5 ? 'selected' : ''}>High Gale (12 m/s - 85% at range)</option>
              </select>
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center">
              <span><b>Apache CAS Sorties (US Turn 3):</b></span>
              <select id="cfgCas" style="padding:4px 8px;background:#202117;color:#fff;border:1px solid #666">
                <option value="3" selected>3 Hellfire Missile Strikes</option>
                <option value="5">5 Hellfire Heavy Air Strike</option>
                <option value="0">0 Ground Only (No Air Support)</option>
              </select>
            </label>
          </div>
        </div>
      `;

      this.dialog.show({
        eyebrow: 'SANDBOX CONFIGURATION',
        title: 'FORCE & BATTLEFIELD BUILDER',
        bodyHtml: html,
        actions: [
          {
            label: 'Apply & Restart Battle',
            primary: true,
            onClick: () => {
              const turns = parseInt(document.getElementById('cfgTurns')?.value || '14', 10);
              const weather = document.getElementById('cfgWeather')?.value || 'clear';
              const wind = document.getElementById('cfgWind')?.value || 'light';
              const cas = parseInt(document.getElementById('cfgCas')?.value || '3', 10);

              this.scenario.turnLimit = turns;
              if (weather === 'dust') {
                this.scenario.environment.visibilityMeters = 2200;
              } else if (weather === 'night') {
                this.scenario.environment.visibilityMeters = 1500;
              } else {
                this.scenario.environment.visibilityMeters = 3500;
              }

              if (wind === 'gusting') {
                this.scenario.environment.crosswindMps = 12;
                this.scenario.environment.crosswindAccuracyModifier = 0.85;
              } else {
                this.scenario.environment.crosswindMps = 5;
                this.scenario.environment.crosswindAccuracyModifier = 0.95;
              }

              if (this.scenario.airSupport) {
                this.scenario.airSupport.strikes = cas;
              }

              this.dialog.hide();
              window.location.reload();
            }
          },
          { label: 'Cancel', onClick: () => this.dialog.hide() }
        ]
      });
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

  global.HexWar = Object.assign(global.HexWar || {}, { HexGrid, HexWarGame, TacticalAI, MapViewport, ModalDialog, StoryIntro, MOVE_ANIM, BattlefieldRenderer });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.HexWar;
  }
}(typeof window !== 'undefined' ? window : globalThis));
