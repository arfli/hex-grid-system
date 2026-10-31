(function () {
  'use strict';

  const scenarios = window.SCENARIOS || {};
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('scenario') || 'bite-the-dust';
  const scenario = Object.values(scenarios).find(item => item.id === requestedId) || scenarios.biteTheDust;
  if (!scenario) throw new Error('No scenario was loaded.');

  const scenarioPicker = document.getElementById('scenarioPicker');
  const sidePicker = document.getElementById('sidePicker');
  const btnMapEditor = document.getElementById('btnMapEditor');
  const btnOob = document.getElementById('btnOob');
  const btnForceBuilder = document.getElementById('btnForceBuilder');
  const mainEl = document.querySelector('main');
  const gamePlayPanel = document.getElementById('gamePlayPanel');
  const mapEditorPanel = document.getElementById('mapEditorPanel');
  const canvas = document.getElementById('game');
  const dialog = new window.HexWar.ModalDialog(document.getElementById('dialog'));
  const storyIntro = new window.HexWar.StoryIntro(document.getElementById('storyIntro'));
  let game = null;
  let mapEditor = null;

  function setEditorMode(enabled) {
    if (!game) {
      storyIntro.stop();
      dialog.hide();
      const preferredSide = scenario.factions[params.get('side')] ? params.get('side') : scenario.turnOrder[0];
      startGame(preferredSide);
    }
    if (!mapEditor) return;
    if (enabled) {
      mapEditor.enable();
      if (gamePlayPanel) gamePlayPanel.hidden = true;
      if (mapEditorPanel) mapEditorPanel.hidden = false;
      if (mainEl) mainEl.classList.add('editor-open');
      if (btnMapEditor) {
        btnMapEditor.classList.add('is-active');
        btnMapEditor.textContent = '⚔ Exit Map Editor';
      }
    } else {
      mapEditor.disable();
      if (gamePlayPanel) gamePlayPanel.hidden = false;
      if (mapEditorPanel) mapEditorPanel.hidden = true;
      if (mainEl) mainEl.classList.remove('editor-open');
      if (btnMapEditor) {
        btnMapEditor.classList.remove('is-active');
        btnMapEditor.textContent = '🛠 Map Editor';
      }
    }
  }

  if (btnMapEditor) {
    btnMapEditor.addEventListener('click', () => {
      const nextState = !(mapEditor && mapEditor.active);
      setEditorMode(nextState);
    });
  }

  if (btnOob) {
    btnOob.addEventListener('click', () => {
      if (game) game.showOrderOfBattleModal();
    });
  }
  if (btnForceBuilder) {
    btnForceBuilder.addEventListener('click', () => {
      if (game) game.showForceBuilderModal();
    });
  }

  Object.values(scenarios).forEach(item => {
    scenarioPicker.add(new Option(item.title, item.id, false, item.id === scenario.id));
  });
  Object.entries(scenario.factions).forEach(([id, faction]) => {
    sidePicker.add(new Option(faction.name, id, false, id === params.get('side')));
  });

  scenarioPicker.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', scenarioPicker.value);
    url.searchParams.delete('side');
    window.location.href = url.toString();
  });

  sidePicker.addEventListener('change', () => {
    if (!game) return;
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', scenario.id);
    url.searchParams.set('side', sidePicker.value);
    window.location.href = url.toString();
  });

  function startGame(playerFaction) {
    if (game) return;
    dialog.hide();
    sidePicker.value = playerFaction;
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', scenario.id);
    url.searchParams.set('side', playerFaction);
    try { window.history.replaceState({}, '', url); } catch (_) { /* Local file URLs may reject history changes. */ }

    game = new window.HexWar.HexWarGame(canvas, scenario, { playerFaction, dialog });
    game.start();

    const viewport = new window.HexWar.MapViewport(document.getElementById('boardWrap'), canvas, {
      slider:document.getElementById('zoomSlider'),
      output:document.getElementById('zoomValue'),
      fitButton:document.getElementById('fitMap')
    });
    viewport.start();
    if (window.HexWar.HexMapEditor && mapEditorPanel) {
      mapEditor = new window.HexWar.HexMapEditor(game, viewport, mapEditorPanel);
      window.mapEditor = mapEditor;
    }
    window.game = game;
    window.mapViewport = viewport;
  }

  function showBriefing() {
    const briefing = scenario.briefing || {};
    const sideCards = scenario.turnOrder.map(id => {
      const faction = scenario.factions[id];
      return `<div class="sideChoice"><strong style="color:${faction.color}">${faction.name}</strong><span>${briefing.sides?.[id] || faction.turnMessage}</span></div>`;
    }).join('');
    const preferredSide = scenario.factions[params.get('side')] ? params.get('side') : scenario.turnOrder[0];
    const actions = scenario.turnOrder.map(id => ({
      label:`Command ${scenario.factions[id].name}`,
      primary:id === preferredSide,
      onClick:() => startGame(id)
    }));
    dialog.show({
      eyebrow:briefing.dateLine || 'Single-player briefing',
      title:scenario.title,
      bodyHtml:`<p>${briefing.situation || scenario.missionHtml}</p><h3>Choose your command</h3>${sideCards}<p><small>This is a fictional what-if scenario. Outcomes and international reactions are speculative.</small></p>`,
      actions
    });
  }

  async function boot() {
    if (params.get('editor') === '1' || window.FORCE_MAP_EDITOR) {
      const preferredSide = scenario.factions[params.get('side')] ? params.get('side') : scenario.turnOrder[0];
      startGame(preferredSide);
      setEditorMode(true);
      return;
    }
    if (scenario.intro) await storyIntro.play(scenario.intro);
    if (!game) showBriefing();
  }

  boot();
}());
