// Ember Pact — boot and the one game flow: title → play → (AI turn →
// combat) → next round → win or loss. The renderer paints; this file decides.
//
// ?seed=N fixes the shuffle. ?shot=start|play|end|loss (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { AI_STEP_MS, BOARD_LANES, COMBAT_STEP_MS, STAGE_H, STAGE_W } from './config.js';
import { createRandom } from './random.js';
import {
  PHASE_AI, PHASE_COMBAT, PHASE_PLAYER,
  addLog, checkWinner, clearDead, creatureAttack, damageCreature, damageLife,
  endRoundCleanup, isGameOver, playCard, startTurn, createGame,
} from './state.js';
import { aiTurnSteps, planAiTurn, threatenedLane } from './ai.js';
import { renderGame, SCREEN_LOSS, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createInput } from './input.js';
import { sfx, toggleMute, unlockAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const bgCanvas = document.getElementById('bg');

let game = createGame(createRandom(seed));
let screen = SCREEN_TITLE;
let busy = false;
const ui = { selectedCard: null, targetMode: null, muted: false, showHelp: false };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function announce(message) {
  status.textContent = message;
}

/** Fit the fixed 1280×800 stage into any desktop window. */
function fitStage() {
  const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  stage.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitStage);
fitStage();

/** Drifting ember motes behind the table — pure decoration, no game state. */
function startEmbers() {
  const ctx = bgCanvas.getContext('2d');
  const motes = Array.from({ length: 42 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 1 + Math.random() * 2.6,
    speed: 0.15 + Math.random() * 0.5,
    sway: Math.random() * Math.PI * 2,
    hue: 18 + Math.random() * 22,
  }));
  function resize() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  (function frame() {
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    for (const m of motes) {
      m.y -= m.speed;
      m.sway += 0.01;
      m.x += Math.sin(m.sway) * 0.3;
      if (m.y < -6) {
        m.y = bgCanvas.height + 6;
        m.x = Math.random() * bgCanvas.width;
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${m.hue}, 95%, 60%, ${0.25 + (m.r / 3.6) * 0.45})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
}

function render() {
  renderGame(stage, game, screen, ui, handlers);
}

/** After any play, check for a winner and switch to the end screen. */
function afterPlay() {
  const winner = checkWinner(game);
  if (winner === 'player') {
    screen = SCREEN_WIN;
    sfx.win();
    announce('Victory. The pact is yours.');
  } else if (winner === 'ai') {
    screen = SCREEN_LOSS;
    sfx.lose();
    announce('Defeat. The embers fade.');
  } else if (winner === 'draw') {
    screen = SCREEN_LOSS;
    announce('A draw — both summoners fall.');
  }
  render();
  return winner;
}

const handlers = {
  onStart() {
    unlockAudio();
    sfx.play();
    screen = SCREEN_PLAY;
    announce('Playing. End your turn when your cards are spent.');
    render();
  },
  onRestart() {
    unlockAudio();
    game = createGame(createRandom(Math.floor(Math.random() * 4294967296)));
    game.aiIntent = planAiTurn(game);
    screen = SCREEN_PLAY;
    ui.selectedCard = null;
    ui.targetMode = null;
    ui.showHelp = false;
    busy = false;
    announce('A new duel begins.');
    render();
  },
  onSelectCard(card) {
    if (busy || game.phase !== PHASE_PLAYER || screen !== SCREEN_PLAY) return;
    unlockAudio();
    if (ui.selectedCard === card) {
      // Second click casts a spell that needs no target; otherwise cancels.
      if (card.kind === 'spell' && card.effect !== 'damage3') {
        const line = playCard(game, game.player, game.ai, card, null);
        if (line) {
          addLog(game, line);
          sfx.spell();
          ui.selectedCard = null;
          ui.targetMode = null;
          afterPlay();
        } else sfx.error();
      } else {
        ui.selectedCard = null;
        ui.targetMode = null;
        render();
      }
      return;
    }
    if (card.cost > game.player.embers) {
      sfx.error();
      announce(`Not enough embers for ${card.name}.`);
      return;
    }
    ui.selectedCard = card;
    ui.targetMode = card.effect === 'damage3' ? 'target' : null;
    sfx.slide();
    render();
  },
  onSelectIndex(index) {
    const card = game.player.hand[index];
    if (card) handlers.onSelectCard(card);
  },
  onPlayToLane(lane) {
    if (busy || !ui.selectedCard || game.phase !== PHASE_PLAYER) return;
    const card = ui.selectedCard;
    const line = playCard(game, game.player, game.ai, card, { lane });
    if (!line) {
      sfx.error();
      return;
    }
    addLog(game, line);
    sfx.play();
    ui.selectedCard = null;
    ui.targetMode = null;
    afterPlay();
  },
  onTargetCreature(lane) {
    if (busy || !ui.selectedCard || game.phase !== PHASE_PLAYER) return;
    const card = ui.selectedCard;
    if (!game.ai.board[lane]) {
      sfx.error();
      return;
    }
    const line = playCard(game, game.player, game.ai, card, { lane });
    if (!line) {
      sfx.error();
      return;
    }
    addLog(game, line);
    sfx.spell();
    ui.selectedCard = null;
    ui.targetMode = null;
    afterPlay();
  },
  onTargetHero() {
    if (busy || !ui.selectedCard || game.phase !== PHASE_PLAYER) return;
    const card = ui.selectedCard;
    const line = playCard(game, game.player, game.ai, card, { hero: 'ai' });
    if (!line) {
      sfx.error();
      return;
    }
    addLog(game, line);
    sfx.spell();
    ui.selectedCard = null;
    ui.targetMode = null;
    afterPlay();
  },
  async onEndTurn() {
    if (busy || game.phase !== PHASE_PLAYER || screen !== SCREEN_PLAY) return;
    busy = true;
    ui.selectedCard = null;
    ui.targetMode = null;
    sfx.endTurn();
    game.phase = PHASE_AI;
    render();

    // The rival's turn: refill its embers, draw, then play its planned steps.
    startTurn(game, game.ai);
    render();
    await sleep(AI_STEP_MS);
    const steps = aiTurnSteps(game);
    for (const step of steps) {
      const target = step.hero ? { hero: step.hero } : step.lane !== null && step.lane !== undefined ? { lane: step.lane } : null;
      const line = playCard(game, game.ai, game.player, step.card, target);
      if (line) {
        addLog(game, `Vex: ${line}`);
        if (step.card.kind === 'spell') sfx.spell();
        else sfx.play();
      }
      render();
      if (checkWinner(game)) {
        busy = false;
        afterPlay();
        return;
      }
      await sleep(AI_STEP_MS);
    }
    game.aiIntent = null;
    await resolveCombat();
    if (isGameOver(game)) {
      busy = false;
      afterPlay();
      return;
    }

    // Next round: clean up, refill the player's embers, draw, telegraph Vex.
    game.round += 1;
    endRoundCleanup(game);
    startTurn(game, game.player);
    game.aiIntent = planAiTurn(game);
    game.phase = PHASE_PLAYER;
    busy = false;
    addLog(game, `Round ${game.round} — your embers refill to ${game.player.embers}.`);
    render();
  },
  onToggleMute() {
    ui.muted = toggleMute();
    render();
  },
  onShowHelp() {
    ui.showHelp = true;
    render();
  },
  onCloseHelp() {
    ui.showHelp = false;
    render();
  },
  onEscape() {
    if (ui.showHelp) {
      ui.showHelp = false;
      render();
    } else if (ui.selectedCard) {
      ui.selectedCard = null;
      ui.targetMode = null;
      render();
    }
  },
  onConfirm() {
    if (screen === SCREEN_TITLE) handlers.onStart();
    else if (screen === SCREEN_WIN || screen === SCREEN_LOSS) handlers.onRestart();
    else if (ui.selectedCard && ui.selectedCard.kind === 'spell' && ui.selectedCard.effect !== 'damage3') {
      handlers.onSelectCard(ui.selectedCard);
    }
  },
};

/** Combat: lane by lane, creatures strike across; unopposed ones hit life. */
async function resolveCombat() {
  game.phase = PHASE_COMBAT;
  const threat = threatenedLane(game);
  if (threat) {
    game.clash = { text: `Vex's creatures strike — lane ${threat.lane + 1} hits hardest (${threat.attack}).` };
  } else {
    game.clash = { text: 'The creatures clash!' };
  }
  render();
  await sleep(COMBAT_STEP_MS);

  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    const mine = game.player.board[lane];
    const foe = game.ai.board[lane];
    if (!mine && !foe) continue;
    const myAttack = mine && !mine.frozen ? creatureAttack(game, game.player, lane) : 0;
    const foeAttack = foe && !foe.frozen ? creatureAttack(game, game.ai, lane) : 0;
    game.clash = { lane, side: mine ? game.player : game.ai, text: `Lane ${lane + 1}: ${mine ? mine.name : '—'} clashes with ${foe ? foe.name : '—'}.` };
    render();
    sfx.hit();
    await sleep(COMBAT_STEP_MS * 0.6);
    if (mine && foe) {
      damageCreature(game, game.ai, lane, myAttack);
      damageCreature(game, game.player, lane, foeAttack);
      addLog(game, `Lane ${lane + 1}: ${myAttack} dealt, ${foeAttack} taken.`);
    } else if (mine) {
      damageLife(game, game.ai, myAttack);
      addLog(game, `${mine.name} strikes the rival for ${myAttack}.`);
      sfx.damage();
    } else if (foe) {
      damageLife(game, game.player, foeAttack);
      addLog(game, `${foe.name} strikes you for ${foeAttack}.`);
      sfx.damage();
    }
    clearDead(game, game.player, 'your');
    clearDead(game, game.ai, 'the rival');
    game.clash = null;
    render();
    if (isGameOver(game)) return;
    await sleep(COMBAT_STEP_MS * 0.5);
  }
}

createInput({
  onSelectIndex: (i) => handlers.onSelectIndex(i),
  onEndTurn: () => handlers.onEndTurn(),
  onToggleMute: () => handlers.onToggleMute(),
  onRestart: () => handlers.onRestart(),
  onEscape: () => handlers.onEscape(),
  onConfirm: () => handlers.onConfirm(),
});

if (shot) {
  const scene = stageShot(shot, game);
  screen = scene.screen;
  let painted = 0;
  (function paint() {
    render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  game.aiIntent = planAiTurn(game);
  startEmbers();
  announce('Ember Pact. Press Space or click Begin the Duel.');
  render();
}
