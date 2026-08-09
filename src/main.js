(function () {
  'use strict';

  const scenarios = window.SCENARIOS || {};
  const requestedId = new URLSearchParams(window.location.search).get('scenario') || 'bite-the-dust';
  const scenario = Object.values(scenarios).find(item => item.id === requestedId) || scenarios.biteTheDust;
  if (!scenario) throw new Error('No scenario was loaded.');

  const picker = document.getElementById('scenarioPicker');
  Object.values(scenarios).forEach(item => picker.add(new Option(item.title, item.id, false, item.id === scenario.id)));
  picker.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', picker.value);
    window.location.href = url.toString();
  });

  const canvas = document.getElementById('game');
  const game = new window.HexWar.HexWarGame(canvas, scenario);
  game.start();

  const viewport = new window.HexWar.MapViewport(document.getElementById('boardWrap'), canvas, {
    slider:document.getElementById('zoomSlider'),
    output:document.getElementById('zoomValue'),
    fitButton:document.getElementById('fitMap')
  });
  viewport.start();

  // Exposed for debugging and future editor/devtools integration.
  window.game = game;
  window.mapViewport = viewport;
}());
