(function () {
  'use strict';

  const scenario = window.SCENARIOS?.dustLine;
  if (!scenario) throw new Error('Scenario "dust-line" was not loaded.');

  const canvas = document.getElementById('game');
  const game = new window.HexWar.HexWarGame(canvas, scenario);
  game.start();

  // Exposed for debugging and future editor/devtools integration.
  window.game = game;
}());
