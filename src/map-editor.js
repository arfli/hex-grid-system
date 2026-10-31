(function (global) {
  'use strict';

  const STORAGE_PREFIX = 'HEXWAR_CUSTOM_MAP_';

  /**
   * Normalizes SVG text so SVGs exported with physical units (e.g. width="0.333333in" at 300 DPI)
   * rasterize at crisp pixel dimensions in browser Image elements while preserving viewBox.
   */
  function normalizeSvgToDataUrl(svgText) {
    let cleaned = svgText.trim();
    const vbMatch = cleaned.match(/viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    const targetW = vbMatch ? Math.max(200, Math.round(parseFloat(vbMatch[3]) * 2)) : 200;
    const targetH = vbMatch ? Math.max(200, Math.round(parseFloat(vbMatch[4]) * 2)) : 200;

    cleaned = cleaned.replace(/<svg([^>]*)>/i, (full, attrs) => {
      let updated = attrs;
      if (/\bwidth\s*=\s*["'][^"']*["']/i.test(updated)) {
        updated = updated.replace(/\bwidth\s*=\s*["'][^"']*["']/i, `width="${targetW}"`);
      } else {
        updated += ` width="${targetW}"`;
      }
      if (/\bheight\s*=\s*["'][^"']*["']/i.test(updated)) {
        updated = updated.replace(/\bheight\s*=\s*["'][^"']*["']/i, `height="${targetH}"`);
      } else {
        updated += ` height="${targetH}"`;
      }
      return `<svg${updated}>`;
    });

    const utf8Bytes = encodeURIComponent(cleaned).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    );
    return 'data:image/svg+xml;base64,' + btoa(utf8Bytes);
  }

  class HexMapEditor {
    constructor(game, viewport, containerEl) {
      this.game = game;
      this.viewport = viewport;
      this.container = containerEl;

      this.active = false;
      this.tool = 'paint'; // 'paint' | 'select' | 'pick' | 'erase'
      this.selectedTerrainId = Object.keys(this.game.scenario.assets.terrain || {})[0] || 'field';

      this.transform = {
        flipX: false,
        flipY: false,
        rotation: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        clip: true
      };

      this.addAsLayer = false;
      this.lockPanForPaint = false;
      this.isPaintingStroke = false;
      this.lastPaintedKey = null;

      this.selectedCell = null;
      this.hoveredCell = null;

      this.undoStack = [];
      this.redoStack = [];
      this.maxHistory = 60;

      this.customTextures = {}; // id -> { src, label, movementCost, defense }
      this.loadSavedStateFromStorage();
      this.buildUI();
      this.bindCanvasEvents();
    }

    get storageKey() {
      return STORAGE_PREFIX + (this.game.scenario.id || 'default');
    }

    snapshotState() {
      const terrainEntries = [];
      this.game.terrain.forEach((terrainId, key) => {
        terrainEntries.push([key, terrainId]);
      });
      const transformEntries = [];
      this.game.cellTransforms.forEach((t, key) => {
        transformEntries.push([key, { ...t }]);
      });
      const layerEntries = [];
      this.game.cellLayers.forEach((arr, key) => {
        layerEntries.push([key, arr.map(item => ({ ...item }))]);
      });
      return {
        terrain: terrainEntries,
        cellTransforms: transformEntries,
        cellLayers: layerEntries
      };
    }

    restoreSnapshot(snap) {
      if (!snap) return;
      this.game.terrain = new Map(snap.terrain.map(([k, v]) => [k, v]));
      this.game.cellTransforms = new Map(snap.cellTransforms.map(([k, v]) => [k, { ...v }]));
      this.game.cellLayers = new Map((snap.cellLayers || []).map(([k, arr]) => [k, arr.map(i => ({ ...i }))]));
      this.game.invalidateTerrainCache();
      this.game.invalidateReachableCache();
      this.game.render();
      this.updateSelectedCellInspector();
    }

    pushUndo() {
      this.undoStack.push(this.snapshotState());
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.updateHistoryButtons();
    }

    undo() {
      if (!this.undoStack.length) return;
      this.redoStack.push(this.snapshotState());
      const prev = this.undoStack.pop();
      this.restoreSnapshot(prev);
      this.updateHistoryButtons();
      this.setStatus('Undid last map action.');
    }

    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(this.snapshotState());
      const next = this.redoStack.pop();
      this.restoreSnapshot(next);
      this.updateHistoryButtons();
      this.setStatus('Redid map action.');
    }

    enable() {
      this.active = true;
      this.game.editorActive = true;
      if (this.container) this.container.hidden = false;
      if (this.viewport) {
        this.viewport.disableLeftPan = this.lockPanForPaint;
      }
      this.game.render();
      this.drawPreviewBox();
    }

    disable() {
      this.active = false;
      this.game.editorActive = false;
      this.game.renderer.editorGhost = null;
      this.game.renderer.editorSelectedCell = null;
      if (this.container) this.container.hidden = true;
      if (this.viewport) {
        this.viewport.disableLeftPan = false;
      }
      this.game.render();
    }

    toggle() {
      if (this.active) this.disable();
      else this.enable();
      return this.active;
    }

    buildUI() {
      if (!this.container) return;
      this.container.innerHTML = `
        <div class="meHeader">
          <div>
            <div class="kicker">TACTICAL CARTOGRAPHY</div>
            <h2>VISUAL MAP EDITOR</h2>
          </div>
          <div class="meHistoryBtns">
            <button type="button" id="meUndo" title="Undo (Ctrl+Z)" disabled>↩ Undo</button>
            <button type="button" id="meRedo" title="Redo (Ctrl+Y)" disabled>↪ Redo</button>
          </div>
        </div>

        <div id="meStatusBar" class="meStatusBar">Hover map to place or inspect hexes.</div>

        <!-- Tool Selector -->
        <section class="meSection">
          <h3>1. Editor Tool</h3>
          <div class="meToolGrid">
            <button type="button" class="meToolBtn active" data-tool="paint" title="Click or Shift+Drag to place texture (Shortcut: B)">🖌 Place (B)</button>
            <button type="button" class="meToolBtn" data-tool="select" title="Click a placed hex to flip/rotate/edit it live (Shortcut: S)">👆 Select (S)</button>
            <button type="button" class="meToolBtn" data-tool="pick" title="Pick texture & flip/rotation from map hex (Shortcut: I)">💧 Pick (I)</button>
            <button type="button" class="meToolBtn" data-tool="erase" title="Click or Shift+Drag to erase hex terrain (Shortcut: E)">🧹 Erase (E)</button>
          </div>
          <div class="meCheckRow" style="margin-top:8px;">
            <label title="Lock left-drag panning so left-dragging continuously paints across hexes (or hold Shift while dragging)">
              <input type="checkbox" id="meLockPan"> Continuous Drag Paint (Lock Pan)
            </label>
          </div>
        </section>

        <!-- Texture Library & SVG Importer -->
        <section class="meSection">
          <div class="meSectionHeader">
            <h3>2. SVG / Texture Palette</h3>
            <label class="meImportBtn" for="meFileInput" title="Import .svg, .png, .jpg, or .webp files">
              + Import SVG / Texture
            </label>
            <input type="file" id="meFileInput" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/*" multiple hidden>
          </div>
          <div id="meDropZone" class="meDropZone">
            <div id="mePaletteGrid" class="mePaletteGrid"></div>
            <div class="meDropHint">Drop .svg / .png files here to import</div>
          </div>

          <!-- Active Texture Metadata -->
          <div class="meMetaRow">
            <label>Move Cost
              <input type="number" id="meMetaMoveCost" step="0.1" min="0.1" max="99" value="1.2">
            </label>
            <label>Defense Bonus
              <input type="number" id="meMetaDefense" step="1" min="-2" max="10" value="0">
            </label>
          </div>
        </section>

        <!-- Flip, Rotate, Scale & Hex Alignment -->
        <section class="meSection">
          <div class="meSectionHeader">
            <h3>3. Flip, Rotate & Align</h3>
            <button type="button" id="meResetTransform" class="meSmallBtn" title="Reset Flip, Rotation, Scale & Offset">Reset</button>
          </div>

          <div class="meTransformTop">
            <div class="mePreviewWrap">
              <canvas id="mePreviewCanvas" width="108" height="108" title="Live Hex Preview"></canvas>
              <small id="mePreviewLabel">field</small>
            </div>

            <div class="meFlipRotateControls">
              <div class="meBtnPair">
                <button type="button" id="meFlipH" class="meActionBtn" title="Flip Texture Horizontally (Shortcut: X or H)">↔ Flip H (X)</button>
                <button type="button" id="meFlipV" class="meActionBtn" title="Flip Texture Vertically (Shortcut: Y or V)">↕ Flip V (V)</button>
              </div>
              <div class="meBtnQuad">
                <button type="button" id="meRotMinus60" class="meSmallBtn" title="Rotate -60° (Hex Edge)">↺ -60°</button>
                <button type="button" id="meRotPlus60" class="meSmallBtn" title="Rotate +60° (Shortcut: R)">↻ +60° (R)</button>
                <button type="button" id="meRotPlus90" class="meSmallBtn" title="Rotate +90° (Shortcut: Shift+R)">↻ +90°</button>
                <button type="button" id="meRot0" class="meSmallBtn" title="Reset Angle to 0°">0°</button>
              </div>
              <label class="meSliderLabel">
                <span>Angle: <b id="meRotVal">0°</b></span>
                <input type="range" id="meRotSlider" min="-180" max="180" step="5" value="0">
              </label>
            </div>
          </div>

          <div class="meSlidersGrid">
            <label class="meSliderLabel">
              <span>Scale: <b id="meScaleVal">1.00×</b></span>
              <input type="range" id="meScaleSlider" min="0.3" max="3.5" step="0.05" value="1">
            </label>
            <div class="meOffsetRow">
              <label class="meSliderLabel">
                <span>Offset X: <b id="meOffXVal">0px</b></span>
                <input type="range" id="meOffXSlider" min="-50" max="50" step="1" value="0">
              </label>
              <label class="meSliderLabel">
                <span>Offset Y: <b id="meOffYVal">0px</b></span>
                <input type="range" id="meOffYSlider" min="-50" max="50" step="1" value="0">
              </label>
            </div>
          </div>

          <div class="meCheckRow">
            <label title="Keep texture strictly inside the hexagon border. Uncheck to let large textures overlap adjacent hexes.">
              <input type="checkbox" id="meClipHex" checked> Clip Inside Hex Boundary
            </label>
            <label title="Stack this texture on top of the hex's existing terrain instead of replacing it (great for corners / multi-edge tiles).">
              <input type="checkbox" id="meStackLayer"> Stack as Overlay Layer on Hex
            </label>
          </div>
        </section>

        <!-- Selected Hex Inspector (Visible when inspecting a cell) -->
        <section id="meInspectorSection" class="meSection" hidden>
          <div class="meSectionHeader">
            <h3>Selected Hex: <span id="meInspectCoord">-</span></h3>
            <button type="button" id="meClearSelectedHex" class="meSmallBtn meDangerBtn">Clear Hex</button>
          </div>
          <div id="meInspectDetails" class="meInspectDetails"></div>
        </section>

        <!-- Map View Toggles -->
        <section class="meSection">
          <h3>4. View & Grid Overlays</h3>
          <div class="meViewGrid">
            <label><input type="checkbox" id="meShowGrid" checked> Hex Grid Lines</label>
            <label><input type="checkbox" id="meShowCoords"> Hex Coords (Col,Row)</label>
            <label><input type="checkbox" id="meHideUnits"> Hide Units</label>
            <label><input type="checkbox" id="meShowTopo" checked> Topo Contours</label>
          </div>
        </section>

        <!-- Save & Export -->
        <section class="meSection">
          <h3>5. Save & Export Map</h3>
          <div class="meExportGrid">
            <button type="button" id="meSaveBrowser" class="primary" title="Save map to browser storage so it loads automatically in game">💾 Save to Browser</button>
            <button type="button" id="meExportJs" title="Download ready-to-use scenarios/bite-the-dust.js file">📜 Export Scenario .js</button>
            <button type="button" id="meExportJson" title="Export map data & custom SVGs as JSON">📦 Export JSON</button>
            <label class="meBtnLabel" for="meImportJsonInput" title="Load a previously exported Map JSON file">📂 Import JSON</label>
            <input type="file" id="meImportJsonInput" accept=".json,application/json" hidden>
            <button type="button" id="meExportPng" title="Export full 3700x1850 map as PNG image">🖼 Export Map PNG</button>
            <button type="button" id="meClearAllMap" class="meDangerBtn" title="Clear all terrain tiles on the map to start from plain desert">🗑 Clear All Terrain</button>
            <button type="button" id="meResetDefault" title="Discard saved browser edits and restore default scenario">🔄 Restore Default</button>
          </div>
        </section>
      `;

      this.cacheElements();
      this.bindUIEvents();
      this.renderPalette();
      this.syncTransformUI();
      this.syncMetaUI();
    }

    cacheElements() {
      const c = this.container;
      this.els = {
        statusBar: c.querySelector('#meStatusBar'),
        undoBtn: c.querySelector('#meUndo'),
        redoBtn: c.querySelector('#meRedo'),
        toolBtns: [...c.querySelectorAll('.meToolBtn')],
        lockPan: c.querySelector('#meLockPan'),
        fileInput: c.querySelector('#meFileInput'),
        dropZone: c.querySelector('#meDropZone'),
        paletteGrid: c.querySelector('#mePaletteGrid'),
        metaMoveCost: c.querySelector('#meMetaMoveCost'),
        metaDefense: c.querySelector('#meMetaDefense'),
        resetTransform: c.querySelector('#meResetTransform'),
        previewCanvas: c.querySelector('#mePreviewCanvas'),
        previewLabel: c.querySelector('#mePreviewLabel'),
        flipH: c.querySelector('#meFlipH'),
        flipV: c.querySelector('#meFlipV'),
        rotMinus60: c.querySelector('#meRotMinus60'),
        rotPlus60: c.querySelector('#meRotPlus60'),
        rotPlus90: c.querySelector('#meRotPlus90'),
        rot0: c.querySelector('#meRot0'),
        rotVal: c.querySelector('#meRotVal'),
        rotSlider: c.querySelector('#meRotSlider'),
        scaleVal: c.querySelector('#meScaleVal'),
        scaleSlider: c.querySelector('#meScaleSlider'),
        offXVal: c.querySelector('#meOffXVal'),
        offXSlider: c.querySelector('#meOffXSlider'),
        offYVal: c.querySelector('#meOffYVal'),
        offYSlider: c.querySelector('#meOffYSlider'),
        clipHex: c.querySelector('#meClipHex'),
        stackLayer: c.querySelector('#meStackLayer'),
        inspectorSection: c.querySelector('#meInspectorSection'),
        inspectCoord: c.querySelector('#meInspectCoord'),
        inspectDetails: c.querySelector('#meInspectDetails'),
        clearSelectedHex: c.querySelector('#meClearSelectedHex'),
        showGrid: c.querySelector('#meShowGrid'),
        showCoords: c.querySelector('#meShowCoords'),
        hideUnits: c.querySelector('#meHideUnits'),
        showTopo: c.querySelector('#meShowTopo'),
        saveBrowser: c.querySelector('#meSaveBrowser'),
        exportJs: c.querySelector('#meExportJs'),
        exportJson: c.querySelector('#meExportJson'),
        importJsonInput: c.querySelector('#meImportJsonInput'),
        exportPng: c.querySelector('#meExportPng'),
        clearAllMap: c.querySelector('#meClearAllMap'),
        resetDefault: c.querySelector('#meResetDefault')
      };
    }

    bindUIEvents() {
      const { els } = this;

      els.undoBtn.addEventListener('click', () => this.undo());
      els.redoBtn.addEventListener('click', () => this.redo());

      els.toolBtns.forEach(btn => {
        btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
      });

      els.lockPan.addEventListener('change', () => {
        this.lockPanForPaint = els.lockPan.checked;
        if (this.viewport && this.active) {
          this.viewport.disableLeftPan = this.lockPanForPaint;
        }
      });

      // File import
      els.fileInput.addEventListener('change', event => {
        if (event.target.files?.length) {
          this.importFiles([...event.target.files]);
          event.target.value = '';
        }
      });

      // Drag and drop SVG / PNG onto palette or canvas
      const prevent = e => { e.preventDefault(); e.stopPropagation(); };
      [els.dropZone, this.game.canvas].forEach(target => {
        if (!target) return;
        target.addEventListener('dragenter', e => { prevent(e); els.dropZone.classList.add('drag-over'); });
        target.addEventListener('dragover', e => { prevent(e); els.dropZone.classList.add('drag-over'); });
        target.addEventListener('dragleave', e => { prevent(e); els.dropZone.classList.remove('drag-over'); });
        target.addEventListener('drop', e => {
          prevent(e);
          els.dropZone.classList.remove('drag-over');
          const files = [...(e.dataTransfer?.files || [])];
          if (files.length) this.importFiles(files);
        });
      });

      // Metadata inputs
      const updateMeta = () => {
        const id = this.selectedTerrainId;
        if (!id) return;
        const moveCost = parseFloat(els.metaMoveCost.value) || 1;
        const defense = parseInt(els.metaDefense.value, 10) || 0;
        const existing = this.game.scenario.terrainTypes[id] || { label: id };
        this.game.scenario.terrainTypes[id] = {
          ...existing,
          movementCost: moveCost,
          defense
        };
        if (this.customTextures[id]) {
          this.customTextures[id].movementCost = moveCost;
          this.customTextures[id].defense = defense;
        }
        this.game.invalidateReachableCache();
      };
      els.metaMoveCost.addEventListener('change', updateMeta);
      els.metaDefense.addEventListener('change', updateMeta);

      // Transform controls
      els.flipH.addEventListener('click', () => this.toggleFlipH());
      els.flipV.addEventListener('click', () => this.toggleFlipV());
      els.rotMinus60.addEventListener('click', () => this.rotateBy(-60));
      els.rotPlus60.addEventListener('click', () => this.rotateBy(60));
      els.rotPlus90.addEventListener('click', () => this.rotateBy(90));
      els.rot0.addEventListener('click', () => this.setRotation(0));

      els.rotSlider.addEventListener('input', () => {
        this.setRotation(Number(els.rotSlider.value));
      });
      els.scaleSlider.addEventListener('input', () => {
        this.transform.scale = Number(els.scaleSlider.value);
        this.onTransformChanged();
      });
      els.offXSlider.addEventListener('input', () => {
        this.transform.offsetX = Number(els.offXSlider.value);
        this.onTransformChanged();
      });
      els.offYSlider.addEventListener('input', () => {
        this.transform.offsetY = Number(els.offYSlider.value);
        this.onTransformChanged();
      });
      els.clipHex.addEventListener('change', () => {
        this.transform.clip = els.clipHex.checked;
        this.onTransformChanged();
      });
      els.stackLayer.addEventListener('change', () => {
        this.addAsLayer = els.stackLayer.checked;
      });
      els.resetTransform.addEventListener('click', () => {
        this.transform = { flipX: false, flipY: false, rotation: 0, scale: 1, offsetX: 0, offsetY: 0, clip: true };
        this.onTransformChanged();
      });

      els.clearSelectedHex.addEventListener('click', () => {
        if (!this.selectedCell) return;
        this.pushUndo();
        this.game.clearCellTerrain(this.selectedCell);
        this.updateSelectedCellInspector();
        this.setStatus('Cleared selected hex.');
      });

      // View toggles
      els.showGrid.addEventListener('change', () => {
        this.game.renderer.showGrid = els.showGrid.checked;
        this.game.invalidateTerrainCache();
        this.game.render();
      });
      els.showCoords.addEventListener('change', () => {
        this.game.renderer.showCoords = els.showCoords.checked;
        this.game.invalidateTerrainCache();
        this.game.render();
      });
      els.hideUnits.addEventListener('change', () => {
        this.game.renderer.hideUnits = els.hideUnits.checked;
        this.game.invalidateTerrainCache();
        this.game.render();
      });
      els.showTopo.addEventListener('change', () => {
        this.game.renderer.showTopo = els.showTopo.checked;
        this.game.invalidateTerrainCache();
        this.game.render();
      });

      // Save / Export buttons
      els.saveBrowser.addEventListener('click', () => this.saveToLocalStorage());
      els.exportJs.addEventListener('click', () => this.exportScenarioJs());
      els.exportJson.addEventListener('click', () => this.exportJson());
      els.importJsonInput.addEventListener('change', e => {
        if (e.target.files?.[0]) {
          this.importJsonFile(e.target.files[0]);
          e.target.value = '';
        }
      });
      els.exportPng.addEventListener('click', () => this.exportPng());
      els.clearAllMap.addEventListener('click', () => {
        if (!confirm('Clear all terrain tiles on the map to start from a plain desert canvas?')) return;
        this.pushUndo();
        this.game.terrain.clear();
        this.game.cellTransforms.clear();
        this.game.cellLayers.clear();
        this.game.structures = [];
        this.game.invalidateTerrainCache();
        this.game.invalidateReachableCache();
        this.game.render();
        this.updateSelectedCellInspector();
        this.setStatus('Cleared all terrain tiles.');
      });
      els.resetDefault.addEventListener('click', () => {
        if (!confirm('Restore original scenario map and clear saved browser overrides?')) return;
        localStorage.removeItem(this.storageKey);
        window.location.reload();
      });

      // Keyboard shortcuts when editor is active
      window.addEventListener('keydown', event => {
        if (!this.active) return;
        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) this.redo();
          else this.undo();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          this.redo();
          return;
        }

        const key = event.key.toLowerCase();
        if (key === 'x' || key === 'h') {
          event.preventDefault();
          this.toggleFlipH();
        } else if (key === 'v' || key === 'y') {
          event.preventDefault();
          this.toggleFlipV();
        } else if (key === 'r') {
          event.preventDefault();
          this.rotateBy(event.shiftKey ? 90 : 60);
        } else if (key === 'b') {
          event.preventDefault();
          this.setTool('paint');
        } else if (key === 's') {
          event.preventDefault();
          this.setTool('select');
        } else if (key === 'i') {
          event.preventDefault();
          this.setTool('pick');
        } else if (key === 'e') {
          event.preventDefault();
          this.setTool('erase');
        }
      });
    }

    bindCanvasEvents() {
      const canvas = this.game.canvas;
      if (!canvas) return;

      const getCellFromEvent = event => {
        const bounds = canvas.getBoundingClientRect();
        const logicalW = this.game.logicalWidth || this.game.scenario.map.width;
        const logicalH = this.game.logicalHeight || this.game.scenario.map.height;
        const x = (event.clientX - bounds.left) * logicalW / bounds.width;
        const y = (event.clientY - bounds.top) * logicalH / bounds.height;
        return this.game.grid.closestCell(x, y);
      };

      canvas.addEventListener('pointermove', event => {
        if (!this.active) return;
        const cell = getCellFromEvent(event);
        this.hoveredCell = cell;
        this.game.renderer.editorGhost = cell ? {
          cell,
          tool: this.tool,
          terrainId: this.selectedTerrainId,
          transform: { ...this.transform }
        } : null;

        if (cell) {
          const col = cell.q + Math.floor(cell.r / 2);
          const row = cell.r;
          const tId = this.game.terrainAt(cell) || 'plain desert';
          const tr = this.game.cellTransformAt(cell);
          const trText = tr
            ? ` [FlipH:${tr.flipX ? 'Y' : 'N'} FlipV:${tr.flipY ? 'Y' : 'N'} Rot:${tr.rotation || 0}°]`
            : '';
          this.setStatus(`Hex (${col}, ${row}) [q:${cell.q}, r:${cell.r}] · Terrain: ${tId}${trText}`);

          if (this.isPaintingStroke && (event.buttons & 1)) {
            const key = this.game.grid.key(cell);
            if (key !== this.lastPaintedKey) {
              this.applyToolAtCell(cell, false);
              this.lastPaintedKey = key;
            }
          }
        } else {
          this.setStatus('Hover map to place or inspect hexes.');
        }

        this.game.render();
      });

      canvas.addEventListener('pointerleave', () => {
        if (!this.active) return;
        this.hoveredCell = null;
        this.game.renderer.editorGhost = null;
        this.game.render();
      });

      canvas.addEventListener('pointerdown', event => {
        if (!this.active || event.button !== 0) return;
        if (event.shiftKey || this.lockPanForPaint) {
          const cell = getCellFromEvent(event);
          if (cell && (this.tool === 'paint' || this.tool === 'erase')) {
            this.pushUndo();
            this.isPaintingStroke = true;
            this.lastPaintedKey = this.game.grid.key(cell);
            this.applyToolAtCell(cell, false);
          }
        }
      });

      window.addEventListener('pointerup', () => {
        this.isPaintingStroke = false;
        this.lastPaintedKey = null;
      });

      canvas.addEventListener('click', event => {
        if (!this.active) return;
        if (this.isPaintingStroke) return;
        const cell = getCellFromEvent(event);
        if (!cell) return;
        this.applyToolAtCell(cell, true);
      });
    }

    applyToolAtCell(cell, recordUndo = true) {
      if (!cell) return;
      if (this.tool === 'paint') {
        if (!this.selectedTerrainId) return;
        if (recordUndo) this.pushUndo();
        this.game.setCellTerrain(cell, this.selectedTerrainId, { ...this.transform }, this.addAsLayer);
        this.selectedCell = cell;
        this.game.renderer.editorSelectedCell = cell;
        this.updateSelectedCellInspector();
      } else if (this.tool === 'erase') {
        if (recordUndo) this.pushUndo();
        this.game.clearCellTerrain(cell);
        if (this.selectedCell && this.game.grid.key(this.selectedCell) === this.game.grid.key(cell)) {
          this.updateSelectedCellInspector();
        }
      } else if (this.tool === 'pick') {
        const tId = this.game.terrainAt(cell);
        if (tId) {
          this.selectTerrain(tId);
          const tr = this.game.cellTransformAt(cell);
          if (tr) {
            this.transform = {
              flipX: !!tr.flipX,
              flipY: !!tr.flipY,
              rotation: Number(tr.rotation) || 0,
              scale: typeof tr.scale === 'number' ? tr.scale : 1,
              offsetX: Number(tr.offsetX) || 0,
              offsetY: Number(tr.offsetY) || 0,
              clip: tr.clip !== false
            };
          } else {
            this.transform = { flipX: false, flipY: false, rotation: 0, scale: 1, offsetX: 0, offsetY: 0, clip: true };
          }
          this.syncTransformUI();
          this.drawPreviewBox();
          this.setTool('paint');
          this.setStatus(`Picked "${tId}" with its flip/rotation settings.`);
        } else {
          this.setStatus('Clicked hex is plain desert (nothing to pick).');
        }
      } else if (this.tool === 'select') {
        this.selectedCell = cell;
        this.game.renderer.editorSelectedCell = cell;
        const tId = this.game.terrainAt(cell);
        if (tId) {
          this.selectedTerrainId = tId;
          this.highlightSelectedInPalette();
          this.syncMetaUI();
          const tr = this.game.cellTransformAt(cell);
          this.transform = tr ? {
            flipX: !!tr.flipX,
            flipY: !!tr.flipY,
            rotation: Number(tr.rotation) || 0,
            scale: typeof tr.scale === 'number' ? tr.scale : 1,
            offsetX: Number(tr.offsetX) || 0,
            offsetY: Number(tr.offsetY) || 0,
            clip: tr.clip !== false
          } : { flipX: false, flipY: false, rotation: 0, scale: 1, offsetX: 0, offsetY: 0, clip: true };
          this.syncTransformUI();
          this.drawPreviewBox();
        }
        this.updateSelectedCellInspector();
        this.game.render();
      }
    }

    setTool(toolName) {
      this.tool = toolName;
      this.els.toolBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === toolName);
      });
      if (toolName !== 'select') {
        this.els.inspectorSection.hidden = !this.selectedCell;
      }
      this.game.render();
    }

    selectTerrain(terrainId) {
      this.selectedTerrainId = terrainId;
      this.highlightSelectedInPalette();
      this.syncMetaUI();
      this.drawPreviewBox();
      if (this.els.previewLabel) {
        this.els.previewLabel.textContent = terrainId;
      }
    }

    highlightSelectedInPalette() {
      if (!this.els.paletteGrid) return;
      [...this.els.paletteGrid.querySelectorAll('.meTileItem')].forEach(el => {
        el.classList.toggle('active', el.dataset.id === this.selectedTerrainId);
      });
    }

    syncMetaUI() {
      const meta = this.game.scenario.terrainTypes[this.selectedTerrainId] || { movementCost: 1, defense: 0 };
      if (this.els.metaMoveCost) {
        this.els.metaMoveCost.value = Number.isFinite(meta.movementCost) ? meta.movementCost : 99;
      }
      if (this.els.metaDefense) {
        this.els.metaDefense.value = meta.defense || 0;
      }
    }

    toggleFlipH() {
      this.transform.flipX = !this.transform.flipX;
      this.onTransformChanged();
    }

    toggleFlipV() {
      this.transform.flipY = !this.transform.flipY;
      this.onTransformChanged();
    }

    rotateBy(deltaDeg) {
      let next = (this.transform.rotation || 0) + deltaDeg;
      while (next > 180) next -= 360;
      while (next <= -180) next += 360;
      this.setRotation(next);
    }

    setRotation(deg) {
      this.transform.rotation = Math.max(-180, Math.min(180, Math.round(deg)));
      this.onTransformChanged();
    }

    onTransformChanged() {
      this.syncTransformUI();
      this.drawPreviewBox();

      // If in Select mode and a cell with terrain is selected, live-update that cell on the map!
      if (this.tool === 'select' && this.selectedCell && this.game.terrainAt(this.selectedCell)) {
        const currentTerrain = this.game.terrainAt(this.selectedCell);
        this.game.setCellTerrain(this.selectedCell, currentTerrain, { ...this.transform }, false);
        this.updateSelectedCellInspector();
      } else {
        this.game.render();
      }
    }

    syncTransformUI() {
      const { els, transform } = this;
      if (!els) return;
      els.flipH.classList.toggle('active', !!transform.flipX);
      els.flipV.classList.toggle('active', !!transform.flipY);
      els.rotVal.textContent = `${transform.rotation}°`;
      els.rotSlider.value = String(transform.rotation);
      els.scaleVal.textContent = `${transform.scale.toFixed(2)}×`;
      els.scaleSlider.value = String(transform.scale);
      els.offXVal.textContent = `${transform.offsetX}px`;
      els.offXSlider.value = String(transform.offsetX);
      els.offYVal.textContent = `${transform.offsetY}px`;
      els.offYSlider.value = String(transform.offsetY);
      els.clipHex.checked = transform.clip !== false;
      if (els.previewLabel) {
        els.previewLabel.textContent = this.selectedTerrainId || '';
      }
    }

    drawPreviewBox() {
      const canvas = this.els?.previewCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const hexRadius = 42;

      ctx.clearRect(0, 0, w, h);

      // Draw hex background
      const hexPts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        return [cx + hexRadius * Math.cos(a), cy + hexRadius * Math.sin(a)];
      });

      ctx.save();
      ctx.beginPath();
      hexPts.forEach((pt, idx) => (idx ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
      ctx.closePath();
      ctx.fillStyle = '#9a8658';
      ctx.fill();

      const baseImg = this.game.assets.get('baseTerrain');
      if (baseImg?.complete && baseImg.naturalWidth) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(baseImg, cx - hexRadius, cy - hexRadius, hexRadius * 2, hexRadius * 2);
        ctx.restore();
      }

      if (this.transform.clip !== false) {
        ctx.beginPath();
        hexPts.forEach((pt, idx) => (idx ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
        ctx.closePath();
        ctx.clip();
      }

      const img = this.game.assets.get(`terrain:${this.selectedTerrainId}`);
      if (img?.complete && img.naturalWidth) {
        const drawSize = hexRadius * 2 * (this.transform.scale || 1);
        ctx.save();
        ctx.translate(cx + (this.transform.offsetX || 0), cy + (this.transform.offsetY || 0));
        if (this.transform.rotation) {
          ctx.rotate((this.transform.rotation * Math.PI) / 180);
        }
        if (this.transform.flipX || this.transform.flipY) {
          ctx.scale(this.transform.flipX ? -1 : 1, this.transform.flipY ? -1 : 1);
        }
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
      }
      ctx.restore();

      // Draw hex border
      ctx.save();
      ctx.beginPath();
      hexPts.forEach((pt, idx) => (idx ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
      ctx.closePath();
      ctx.strokeStyle = '#e9743f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    renderPalette() {
      const grid = this.els?.paletteGrid;
      if (!grid) return;
      grid.innerHTML = '';

      const terrainMap = this.game.scenario.assets.terrain || {};
      Object.entries(terrainMap).forEach(([id, src]) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'meTileItem' + (id === this.selectedTerrainId ? ' active' : '');
        item.dataset.id = id;
        const label = this.game.scenario.terrainTypes?.[id]?.label || id;
        item.title = `${label} (${id})`;

        const img = document.createElement('img');
        img.src = src;
        img.alt = id;
        img.onload = () => {
          if (id === this.selectedTerrainId) this.drawPreviewBox();
        };

        const span = document.createElement('span');
        span.textContent = id;

        item.appendChild(img);
        item.appendChild(span);
        item.addEventListener('click', () => {
          this.selectTerrain(id);
          if (this.tool === 'erase') this.setTool('paint');
        });
        grid.appendChild(item);
      });
    }

    importFiles(files) {
      files.forEach(file => {
        const rawName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        let id = rawName || 'custom_tile';
        let counter = 1;
        while (this.game.scenario.assets.terrain[id] && !confirm(`Overwrite existing texture "${id}"? Cancel to create a new slot.`)) {
          counter++;
          id = `${rawName}_${counter}`;
        }

        const isSvg = file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml';
        const reader = new FileReader();
        reader.onload = () => {
          let dataUrl = reader.result;
          if (isSvg && typeof dataUrl === 'string') {
            try {
              dataUrl = normalizeSvgToDataUrl(dataUrl);
            } catch (_) {
              // Fallback to raw data URL if normalization fails
            }
          }

          const meta = {
            label: rawName.replace(/_/g, ' '),
            movementCost: 1.2,
            defense: 0
          };
          this.customTextures[id] = { src: dataUrl, ...meta };
          this.game.registerCustomTerrain(id, dataUrl, meta);
          this.renderPalette();
          this.selectTerrain(id);
          this.setTool('paint');
          this.setStatus(`Imported texture "${id}". Use Flip H / Flip V / Rotate and click hexes to place!`);
        };

        if (isSvg) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
    }

    updateSelectedCellInspector() {
      const sec = this.els?.inspectorSection;
      if (!sec) return;
      if (!this.selectedCell) {
        sec.hidden = true;
        return;
      }
      sec.hidden = false;
      const cell = this.selectedCell;
      const col = cell.q + Math.floor(cell.r / 2);
      const row = cell.r;
      this.els.inspectCoord.textContent = `Col ${col}, Row ${row} (q:${cell.q}, r:${cell.r})`;

      const tId = this.game.terrainAt(cell);
      const tr = this.game.cellTransformAt(cell);
      const layers = this.game.cellLayersAt(cell);

      if (!tId && (!layers || !layers.length)) {
        this.els.inspectDetails.innerHTML = `<em>Plain desert hex (no terrain placed).</em>`;
        return;
      }

      let html = `<div><b>Base Tile:</b> <code>${tId || 'none'}</code>`;
      if (tr) {
        html += ` <small>[FlipH:${tr.flipX ? 'Yes' : 'No'}, FlipV:${tr.flipY ? 'Yes' : 'No'}, Rot:${tr.rotation || 0}°, Scale:${(tr.scale || 1).toFixed(2)}×]</small>`;
      }
      html += `</div>`;

      if (layers && layers.length) {
        html += `<div style="margin-top:6px;"><b>Stacked Overlay Layers (${layers.length}):</b></div><ul class="meLayerList">`;
        layers.forEach((layer, idx) => {
          html += `<li>
            <span>#${idx + 1}: <code>${layer.terrainId}</code> (${layer.flipX ? 'FlipH ' : ''}${layer.flipY ? 'FlipV ' : ''}${layer.rotation || 0}°)</span>
            <button type="button" class="meSmallBtn meDangerBtn" data-remove-layer="${idx}">×</button>
          </li>`;
        });
        html += `</ul>`;
      }

      this.els.inspectDetails.innerHTML = html;
      [...this.els.inspectDetails.querySelectorAll('[data-remove-layer]')].forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.removeLayer, 10);
          this.pushUndo();
          const key = this.game.grid.key(cell);
          const arr = [...(this.game.cellLayers.get(key) || [])];
          arr.splice(idx, 1);
          if (arr.length) this.game.cellLayers.set(key, arr);
          else this.game.cellLayers.delete(key);
          this.game.invalidateTerrainCache();
          this.game.render();
          this.updateSelectedCellInspector();
        });
      });
    }

    updateHistoryButtons() {
      if (!this.els) return;
      this.els.undoBtn.disabled = this.undoStack.length === 0;
      this.els.redoBtn.disabled = this.redoStack.length === 0;
    }

    setStatus(msg) {
      if (this.els?.statusBar) {
        this.els.statusBar.textContent = msg;
      }
    }

    buildSerializablePayload() {
      const groupedTerrain = {};
      this.game.terrain.forEach((terrainId, key) => {
        const [q, r] = key.split(',').map(Number);
        if (!groupedTerrain[terrainId]) groupedTerrain[terrainId] = [];
        groupedTerrain[terrainId].push([q, r]);
      });

      const cellTransforms = {};
      this.game.cellTransforms.forEach((t, key) => {
        cellTransforms[key] = { ...t };
      });

      const cellLayers = {};
      this.game.cellLayers.forEach((arr, key) => {
        if (arr && arr.length) cellLayers[key] = arr.map(i => ({ ...i }));
      });

      return {
        scenarioId: this.game.scenario.id,
        savedAt: new Date().toISOString(),
        customTextures: this.customTextures,
        terrainTypes: this.game.scenario.terrainTypes,
        terrain: groupedTerrain,
        cellTransforms,
        cellLayers
      };
    }

    saveToLocalStorage() {
      try {
        const payload = this.buildSerializablePayload();
        localStorage.setItem(this.storageKey, JSON.stringify(payload));
        this.setStatus('Saved map & custom textures to browser storage! Ready for play.');
      } catch (err) {
        this.setStatus('Storage quota exceeded; use Export Scenario .js or Export JSON.');
      }
    }

    loadSavedStateFromStorage() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return false;
        const data = JSON.parse(raw);
        this.applyImportedData(data, false);
        return true;
      } catch (_) {
        return false;
      }
    }

    applyImportedData(data, recordUndo = true) {
      if (!data) return;
      if (recordUndo) this.pushUndo();

      if (data.customTextures) {
        Object.entries(data.customTextures).forEach(([id, info]) => {
          this.customTextures[id] = info;
          this.game.registerCustomTerrain(id, info.src, info);
        });
      }
      if (data.terrainTypes) {
        Object.assign(this.game.scenario.terrainTypes, data.terrainTypes);
      }
      if (data.terrain) {
        this.game.terrain = this.game.createTerrainMap(data.terrain);
      }
      if (data.cellTransforms) {
        this.game.cellTransforms = this.game.createCellTransformsMap(data.cellTransforms);
      }
      if (data.cellLayers) {
        this.game.cellLayers = this.game.createCellLayersMap(data.cellLayers);
      }

      this.renderPalette();
      this.game.invalidateTerrainCache();
      this.game.invalidateReachableCache();
      this.game.render();
    }

    exportJson() {
      const payload = this.buildSerializablePayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.game.scenario.id || 'map'}-custom.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.setStatus('Exported map JSON file.');
    }

    importJsonFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.applyImportedData(data, true);
          this.setStatus(`Imported map JSON "${file.name}".`);
        } catch (err) {
          alert('Invalid Map JSON file.');
        }
      };
      reader.readAsText(file);
    }

    exportScenarioJs() {
      const payload = this.buildSerializablePayload();
      const s = {
        ...this.game.scenario,
        assets: {
          ...this.game.scenario.assets,
          terrain: { ...this.game.scenario.assets.terrain }
        },
        terrainTypes: { ...this.game.scenario.terrainTypes },
        terrain: payload.terrain,
        cellTransforms: payload.cellTransforms,
        cellLayers: payload.cellLayers
      };

      const jsContent = `(function () {
  'use strict';

  window.SCENARIOS = window.SCENARIOS || {};
  window.SCENARIOS.biteTheDust = ${JSON.stringify(s, null, 2)};
}());
`;
      const blob = new Blob([jsContent], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bite-the-dust.js';
      a.click();
      URL.revokeObjectURL(url);
      this.setStatus('Downloaded updated bite-the-dust.js scenario file!');
    }

    exportPng() {
      this.game.renderer.bakeTerrain();
      const srcCanvas = this.game.renderer.cachedTerrainCanvas || this.game.canvas;
      if (!srcCanvas || typeof srcCanvas.toDataURL !== 'function') {
        const dataUrl = this.game.canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${this.game.scenario.id || 'map'}-terrain.png`;
        a.click();
        return;
      }
      const dataUrl = srcCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${this.game.scenario.id || 'map'}-terrain.png`;
      a.click();
      this.setStatus('Exported map PNG image.');
    }
  }

  global.HexWar = Object.assign(global.HexWar || {}, { HexMapEditor, normalizeSvgToDataUrl });
}(typeof window !== 'undefined' ? window : globalThis));

