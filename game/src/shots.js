// Ember Pact — the ?shot= scenes. Each one stages a real game state (no
// mock DOM, no drawn-over screenshots): the same state the rules build, set
// to a fixed position, so every screenshot is a frame of the actual game.
import { makeCard } from './cards.js';
import { SCREEN_LOSS, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function place(game, side, lane, defId, health = null, attack = null) {
  const card = makeCard(defId);
  if (health !== null) card.health = health;
  if (attack !== null) card.attack = attack;
  side.board[lane] = card;
  return card;
}

function handOf(game, side, defIds) {
  side.hand = defIds.map((id) => makeCard(id));
}

/**
 * Stage the named scene and return the screen to paint over it.
 * start — the title screen over a fresh table.
 * play  — mid-game, round 4: both hands, creatures on both boards, life and
 *         embers visible, and Vex's telegraphed intent on show.
 * end   — the win screen: the rival's life has just hit 0.
 * loss  — the loss screen: the player's life has just hit 0.
 */
export function stageShot(name, game) {
  if (name === 'play') {
    game.round = 4;
    game.player.life = 14;
    game.ai.life = 9;
    game.player.maxEmbers = 5;
    game.player.embers = 5;
    game.ai.maxEmbers = 4;
    game.ai.embers = 2;
    place(game, game.player, 0, 'ash-wolf');
    place(game, game.player, 1, 'flame-sprite');
    place(game, game.player, 2, 'stone-golem');
    place(game, game.ai, 0, 'storm-drake');
    place(game, game.ai, 2, 'frost-wisp');
    handOf(game, game.player, ['ember-titan', 'fireball', 'pact-of-flames', 'kindling', 'cinder-imp']);
    handOf(game, game.ai, ['ash-wolf', 'emberling', 'fireball', 'mend', 'gale-falcon']);
    game.aiIntent = { cardName: 'Gale Falcon', lane: 3, kind: 'creature', card: null };
    game.log = [
      'Storm Drake calls lightning on every enemy.',
      'Flame Sprite kindles its neighbours +1.',
      'Vex played Ash Wolf in lane 1.',
      'You played Stone Golem in lane 3.',
    ];
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    game.round = 7;
    game.player.life = 8;
    game.ai.life = 0;
    game.player.maxEmbers = 7;
    game.player.embers = 3;
    place(game, game.player, 0, 'ember-titan');
    place(game, game.player, 1, 'phoenix-chick');
    place(game, game.player, 2, 'storm-drake');
    handOf(game, game.player, ['fireball', 'mend', 'kindling']);
    handOf(game, game.ai, ['emberling']);
    game.log = [
      'Ember Titan strikes the rival for 7 — the pact is yours!',
      'Fireball burns the last defender for 3.',
      'Vex played Emberling in lane 1.',
    ];
    game.winner = 'player';
    game.phase = 'over';
    return { screen: SCREEN_WIN };
  }
  if (name === 'loss') {
    game.round = 6;
    game.player.life = 0;
    game.ai.life = 11;
    game.player.maxEmbers = 6;
    game.player.embers = 1;
    place(game, game.ai, 0, 'ember-titan');
    place(game, game.ai, 1, 'ash-wolf');
    place(game, game.ai, 3, 'storm-drake');
    place(game, game.player, 1, 'stone-golem', 1);
    handOf(game, game.player, ['mend', 'emberling']);
    handOf(game, game.ai, ['fireball', 'ash-wolf']);
    game.log = [
      'Ember Titan strikes you for 7 — the embers fade.',
      'Storm Drake calls lightning on every enemy.',
      'You played Stone Golem in lane 2.',
    ];
    game.winner = 'ai';
    game.phase = 'over';
    return { screen: SCREEN_LOSS };
  }
  // start (and anything unknown): title over a fresh table.
  return { screen: SCREEN_TITLE };
}
