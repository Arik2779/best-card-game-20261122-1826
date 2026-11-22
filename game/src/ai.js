// Ember Pact — the rival summoner, Ashen Vex. The AI is deliberately readable:
// it plans its turn at the start of the player's turn and telegraphs it (the
// card it will raise and the lane it will strike), so the player can counter
// by blocking that lane or removing the threat before combat.
import { BOARD_LANES, embersForRound } from './config.js';
import { creatureAttack } from './state.js';

/** The lane the AI's creatures will hit hardest this combat, if any. */
export function threatenedLane(game) {
  let bestLane = -1;
  let bestAttack = 0;
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    const card = game.ai.board[lane];
    if (!card || card.frozen) continue;
    const attack = creatureAttack(game, game.ai, lane);
    if (attack > bestAttack) {
      bestAttack = attack;
      bestLane = lane;
    }
  }
  return bestLane === -1 ? null : { lane: bestLane, attack: bestAttack };
}

/**
 * Plan the AI's next turn from its hand and embers, before the player acts.
 * The plan is shown as the telegraph: { cardName, lane, kind }.
 */
export function planAiTurn(game) {
  const ai = game.ai;
  // The plan is made during the player's turn, before the AI's embers refill,
  // so it plans against the embers its turn will open with.
  const projectedEmbers = embersForRound(game.round);
  const affordable = ai.hand.filter((c) => c.cost <= projectedEmbers);
  if (affordable.length === 0) return { cardName: null, lane: null, kind: 'pass' };

  // Prefer removal when the player fields something dangerous.
  const playerThreat = strongestLane(game, game.player);
  const fireball = affordable.find((c) => c.effect === 'damage3');
  if (fireball && playerThreat !== null && game.player.board[playerThreat]) {
    return { cardName: fireball.name, lane: playerThreat, kind: 'spell', card: fireball };
  }
  const wildfire = affordable.find((c) => c.effect === 'damageAll2');
  if (wildfire && countBoard(game.player) >= 2) {
    return { cardName: wildfire.name, lane: null, kind: 'spell', card: wildfire };
  }
  // Otherwise raise the strongest affordable creature into the emptiest lane
  // facing the player's weakest creature — or straight at the rival's life.
  const creatures = affordable.filter((c) => c.kind === 'creature');
  if (creatures.length > 0) {
    creatures.sort((a, b) => b.attack - a.attack || a.cost - b.cost);
    const card = creatures[0];
    const lane = chooseLane(game);
    return { cardName: card.name, lane, kind: 'creature', card };
  }
  // Only spells left: draw first, then heal when hurt, then surge.
  const draw = affordable.find((c) => c.effect === 'draw2' || c.effect === 'draw1');
  if (draw) return { cardName: draw.name, lane: null, kind: 'spell', card: draw };
  const mend = affordable.find((c) => c.effect === 'heal5');
  if (mend && ai.life <= 12) return { cardName: mend.name, lane: null, kind: 'spell', card: mend };
  const surge = affordable.find((c) => c.effect === 'embers2');
  if (surge) return { cardName: surge.name, lane: null, kind: 'spell', card: surge };
  return { cardName: affordable[0].name, lane: null, kind: 'spell', card: affordable[0] };
}

/** The AI's lane with the strongest creature on the board. */
function strongestLane(game, side) {
  let best = null;
  let bestAttack = 0;
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    const card = side.board[lane];
    if (!card) continue;
    const attack = creatureAttack(game, side, lane);
    if (attack > bestAttack) {
      bestAttack = attack;
      best = lane;
    }
  }
  return best;
}

function countBoard(side) {
  return side.board.filter(Boolean).length;
}

/**
 * Pick a lane for a new creature: the empty lane opposite the player's
 * weakest creature, so its attack lands on life; else the first free lane.
 */
function chooseLane(game) {
  let bestLane = -1;
  let weakest = Infinity;
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    if (game.ai.board[lane]) continue;
    const foe = game.player.board[lane];
    const foeHealth = foe ? foe.health : 0;
    if (foeHealth < weakest) {
      weakest = foeHealth;
      bestLane = lane;
    }
  }
  if (bestLane !== -1) return bestLane;
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    if (!game.ai.board[lane]) return lane;
  }
  return 0;
}

/**
 * Execute the AI's turn: follow its telegraphed plan, then keep playing
 * affordable cards while it can (creatures first, then spells), one step at
 * a time so the renderer can animate each play. Returns the list of steps.
 */
export function aiTurnSteps(game) {
  const steps = [];
  const ai = game.ai;
  const plan = game.aiIntent && game.aiIntent.card ? game.aiIntent : planAiTurn(game);
  if (plan.card) {
    let step = { card: plan.card, lane: plan.lane, hero: null };
    if (plan.kind === 'spell' && plan.card.effect === 'damage3') {
      const target = pickFireballTarget(game);
      step = { card: plan.card, lane: target.lane ?? null, hero: target.hero ?? null };
    }
    steps.push(step);
  }
  // Second wave: any other affordable creature that fits, then a spell.
  for (const card of ai.hand.slice()) {
    if (steps.length >= 3) break;
    if (card === plan.card) continue;
    if (card.kind === 'creature' && card.cost <= ai.embers - (plan.card ? plan.card.cost : 0)) {
      const lane = chooseLaneAfter(game, steps);
      if (lane !== null) steps.push({ card, lane, hero: null });
    }
  }
  for (const card of ai.hand.slice()) {
    if (steps.length >= 3) break;
    if (card === plan.card || card.kind !== 'spell') continue;
    if (card.cost > ai.embers - steps.reduce((s, st) => s + st.card.cost, 0)) continue;
    if (card.effect === 'damage3') {
      const target = pickFireballTarget(game);
      if (target) steps.push({ card, lane: target.lane ?? null, hero: target.hero ?? null });
    } else if (card.effect === 'heal5' && ai.life > 14) {
      continue;
    } else {
      steps.push({ card, lane: null, hero: null });
    }
  }
  return steps;
}

function chooseLaneAfter(game, steps) {
  const taken = new Set(steps.map((s) => s.lane));
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    if (!game.ai.board[lane] && !taken.has(lane)) return lane;
  }
  return null;
}

function pickFireballTarget(game) {
  const threat = strongestLane(game, game.player);
  if (threat !== null && game.player.board[threat] && game.player.board[threat].health <= 3) {
    return { lane: threat };
  }
  if (game.player.life <= 3) return { hero: 'player' };
  if (threat !== null) return { lane: threat };
  return { hero: 'player' };
}
