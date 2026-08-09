(function () {
  'use strict';

  const scenarios = window.SCENARIOS || {};
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('scenario') || 'bite-the-dust';
  const scenario = Object.values(scenarios).find(item => item.id === requestedId) || scenarios.biteTheDust;
  if (!scenario) throw new Error('No scenario was loaded.');

  const scenarioPicker = document.getElementById('scenarioPicker');
  const sidePicker = document.getElementById('sidePicker');
  const canvas = document.getElementById('game');
  const dialog = new window.HexWar.ModalDialog(document.getElementById('dialog'));
  const storyIntro = new window.HexWar.StoryIntro(document.getElementById('storyIntro'));
  let game = null;

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
    if (scenario.intro) await storyIntro.play(scenario.intro);
    showBriefing();
  }

  boot();
}());
