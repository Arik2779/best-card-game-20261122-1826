// Ember Pact — game state and the rules that move it. A state holds both
// sides, the round, whose turn it is, and the log; every rule (draw, play,
// combat, win/loss) is a function here, so the renderer only ever paints.
import { BOARD_LANES, DECK_SIZE, MAX_HAND, MAX_LIFE, START_HAND, START_LIFE, embersForRound } from './config.js';
import { buildDeck } from './cards.js';
import { shuffled } from './random.js';

export const PHASE_PLAYER = 'player';
export const PHASE_AI = 'ai';
export const PHASE_COMBAT = 'combat';
export const PHASE_OVER = 'over';

function makeSide(deck) {
  return {
    life: START_LIFE,
    embers: 0,
    maxEmbers: 0,
    deck,
    hand: [],
    board: Array.from({ length: BOARD_LANES }, () => null),
    discard: [],
  };
}

/** A fresh game: shuffled decks, opening hands, round 1, player's turn. */
export function createGame(rng) {
  const game = {
    rng,
    round: 1,
    phase: PHASE_PLAYER,
    player: makeSide(shuffled(rng, buildDeck())),
    ai: makeSide(shuffled(rng, buildDeck())),
    log: [],
    winner: null,
    // The AI's telegraphed plan for its next turn, shown to the player.
    aiIntent: null,
    // Transient combat highlights the renderer reads: { lane, attacker, target }.
    clash: null,
    // Cards played this turn, for the end-of-turn recap line.
    playedThisTurn: [],
  };
  for (let i = 0; i < START_HAND; i += 1) {
    drawCard(game, game.player);
    drawCard(game, game.ai);
  }
  startTurn(game, game.player);
  return game;
}

/** Draw one card; an empty deck costs 2 life (fatigue) instead. */
export function drawCard(game, side) {
  if (side.hand.length >= MAX_HAND) return null;
  const card = side.deck.pop();
  if (!card) {
    side.life = Math.max(0, side.life - 2);
    addLog(game, 'The deck is empty — fatigue burns 2 life.');
    return null;
  }
  side.hand.push(card);
  return card;
}

/** Open a side's turn: refill embers to the round's income and draw a card. */
export function startTurn(game, side) {
  side.maxEmbers = embersForRound(game.round);
  side.embers = side.maxEmbers;
  drawCard(game, side);
}

export function addLog(game, message) {
  game.log.unshift(message);
  if (game.log.length > 6) game.log.length = 6;
}

/** Attack of a creature, including its neighbours' auras and its own buff. */
export function creatureAttack(game, side, lane) {
  const card = side.board[lane];
  if (!card) return 0;
  let attack = card.attack + card.buff;
  for (const offset of [-1, 1]) {
    const neighbour = side.board[lane + offset];
    if (neighbour && neighbour.effect === 'aura1') attack += 1;
  }
  return Math.max(0, attack);
}

/** Remove dead creatures from a board, handling Phoenix Chick's rebirth. */
export function clearDead(game, side, ownerName) {
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    const card = side.board[lane];
    if (card && card.health <= 0) {
      side.board[lane] = null;
      side.discard.push(card);
      if (card.effect === 'rebirth' && !card.reborn) {
        card.reborn = true;
        card.health = card.maxHealth;
        side.hand.push(card);
        addLog(game, `${card.name} is reborn and returns to ${ownerName}'s hand.`);
      } else {
        addLog(game, `${card.name} is destroyed.`);
      }
    }
  }
}

/** Damage one creature on the board; returns true when it dies. */
export function damageCreature(game, side, lane, amount) {
  const card = side.board[lane];
  if (!card) return false;
  card.health -= amount;
  return card.health <= 0;
}

/** Deal damage straight to a side's life total; returns true when they fall. */
export function damageLife(game, side, amount) {
  side.life = Math.max(0, side.life - amount);
  return side.life <= 0;
}

/** Heal a side, never above the cap. */
export function healLife(side, amount) {
  side.life = Math.min(MAX_LIFE, side.life + amount);
}

export function isGameOver(game) {
  return game.player.life <= 0 || game.ai.life <= 0;
}

export function checkWinner(game) {
  if (game.ai.life <= 0 && game.player.life <= 0) game.winner = 'draw';
  else if (game.ai.life <= 0) game.winner = 'player';
  else if (game.player.life <= 0) game.winner = 'ai';
  else game.winner = null;
  if (game.winner) game.phase = PHASE_OVER;
  return game.winner;
}

/**
 * Play a card from a side's hand. Creatures need a free lane; spells resolve
 * at once. `target` is { lane } for a board target or { hero: 'ai'|'player' }
 * for Fireball aimed at a life total. Returns a result line or null when the
 * play is illegal (not enough embers, no free lane, no target).
 */
export function playCard(game, side, foe, card, target) {
  if (side.embers < card.cost) return null;
  const handIndex = side.hand.indexOf(card);
  if (handIndex === -1) return null;

  if (card.kind === 'creature') {
    if (!target || target.lane === undefined) return null;
    if (side.board[target.lane]) return null;
    side.embers -= card.cost;
    side.hand.splice(handIndex, 1);
    side.board[target.lane] = card;
    game.playedThisTurn.push(card.name);
    runOnPlay(game, side, foe, card, target.lane);
    return `${card.name} takes lane ${target.lane + 1}.`;
  }

  // Spells.
  if (card.effect === 'damage3' && !target) return null;
  side.embers -= card.cost;
  side.hand.splice(handIndex, 1);
  side.discard.push(card);
  game.playedThisTurn.push(card.name);
  return resolveSpell(game, side, foe, card, target);
}

/** On-play hooks for creatures. */
export function runOnPlay(game, side, foe, card, lane) {
  if (card.effect === 'draw1') {
    drawCard(game, side);
    addLog(game, `${card.name} draws a card.`);
  } else if (card.effect === 'heal2') {
    healLife(side, 2);
    addLog(game, `${card.name} mends 2 life.`);
  } else if (card.effect === 'swift') {
    damageLife(game, foe, 1);
    addLog(game, `${card.name} dives at the rival for 1.`);
  } else if (card.effect === 'zap1') {
    for (let i = 0; i < BOARD_LANES; i += 1) {
      if (foe.board[i]) damageCreature(game, foe, i, 1);
    }
    clearDead(game, foe, 'the rival');
    addLog(game, `${card.name} calls lightning on every enemy.`);
  } else if (card.effect === 'freeze') {
    const foeCard = foe.board[lane];
    if (foeCard) {
      foeCard.frozen = true;
      addLog(game, `${card.name} freezes ${foeCard.name} in lane ${lane + 1}.`);
    }
  }
}

/** Spell effects. Returns the log line for the play. */
export function resolveSpell(game, side, foe, card, target) {
  switch (card.effect) {
    case 'damage3': {
      if (target.hero) {
        damageLife(game, foe, 3);
        return `${card.name} burns the rival for 3.`;
      }
      const hit = foe.board[target.lane];
      if (!hit) return null;
      damageCreature(game, foe, target.lane, 3);
      clearDead(game, foe, 'the rival');
      return `${card.name} hits ${hit.name} for 3.`;
    }
    case 'embers2':
      side.embers += 2;
      return `${card.name}: +2 embers this turn.`;
    case 'draw2':
      drawCard(game, side);
      drawCard(game, side);
      return `${card.name}: draw 2 cards.`;
    case 'damageAll2':
      for (let i = 0; i < BOARD_LANES; i += 1) {
        if (foe.board[i]) damageCreature(game, foe, i, 2);
      }
      clearDead(game, foe, 'the rival');
      return `${card.name} scorches every enemy creature for 2.`;
    case 'buff2':
      for (const c of side.board) if (c) c.buff += 2;
      return `${card.name}: your creatures gain +2 attack.`;
    case 'heal5':
      healLife(side, 5);
      return `${card.name} restores 5 life.`;
    default:
      return `${card.name} is played.`;
  }
}

/** End-of-round cleanup: buffs fade, frozen creatures thaw. */
export function endRoundCleanup(game) {
  for (const side of [game.player, game.ai]) {
    for (const card of side.board) {
      if (card) {
        card.buff = 0;
        card.frozen = false;
      }
    }
  }
  game.playedThisTurn = [];
}

export { DECK_SIZE };
