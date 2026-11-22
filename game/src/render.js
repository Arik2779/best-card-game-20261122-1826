// Ember Pact — paints the whole game into DOM. The stage is a fixed
// 1280×800 table that scales to the window; cards are real DOM elements so
// their values, costs and suits stay legible even at thumbnail size.
import { BOARD_LANES, GAME_TITLE, PLAYER_NAME, RIVAL_NAME } from './config.js';
import { ELEMENTS } from './cards.js';
import { creatureAttack } from './state.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSS = 'loss';

/** One card element. `opts` tunes size, face-down backs, and affordances. */
export function cardElement(card, opts = {}) {
  const el = document.createElement('div');
  const element = ELEMENTS[card.element];
  el.className = `card el-${card.element}${opts.small ? ' card--small' : ''}${opts.faceDown ? ' card--back' : ''}${opts.playable ? ' card--playable' : ''}${opts.selected ? ' card--selected' : ''}${opts.targetable ? ' card--targetable' : ''}${opts.frozen ? ' card--frozen' : ''}${card.buff > 0 ? ' card--buffed' : ''}`;
  el.dataset.uid = String(card.uid);
  if (opts.faceDown) {
    el.innerHTML = `<div class="card-back-glyph">▲</div><div class="card-back-name">EMBER<br>PACT</div>`;
    return el;
  }
  const shownAttack = opts.lane !== undefined && opts.lane >= 0
    ? creatureAttack(opts.game, opts.side, opts.lane)
    : card.attack + card.buff;
  const stats = card.kind === 'creature'
    ? `<div class="card-stats"><span class="stat-atk" title="Attack">⚔ ${shownAttack}</span><span class="stat-hp" title="Health">♥ ${card.health}</span></div>`
    : `<div class="card-stats card-stats--spell"><span>SPELL</span></div>`;
  el.innerHTML = `
    <div class="card-cost" title="Ember cost">${card.cost}</div>
    <div class="card-suit" style="color:${element.color}" title="${element.name}">${element.glyph}</div>
    <div class="card-art" style="background:linear-gradient(160deg, ${element.color}33, transparent 70%), radial-gradient(circle at 50% 38%, ${element.glow}, transparent 68%)">
      <span class="card-glyph" style="color:${element.color}">${element.glyph}</span>
      <span class="card-art-name">${card.name}</span>
    </div>
    <div class="card-name">${card.name}</div>
    <div class="card-text">${card.text}</div>
    ${stats}`;
  return el;
}

/** A board slot: either an empty lane marker or the creature standing in it. */
function slotElement(game, side, lane, ui, handlers) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.dataset.lane = String(lane);
  const card = side.board[lane];
  if (card) {
    const isFoe = side === game.ai;
    const targetable = ui.targetMode === 'target' && isFoe;
    const el = cardElement(card, {
      game, side, lane,
      frozen: card.frozen,
      targetable,
    });
    if (targetable) el.addEventListener('click', () => handlers.onTargetCreature(lane));
    slot.appendChild(el);
    if (card.frozen) {
      const tag = document.createElement('div');
      tag.className = 'slot-tag';
      tag.textContent = 'FROZEN';
      slot.appendChild(tag);
    }
    if (game.clash && game.clash.lane === lane && game.clash.side === side) {
      slot.classList.add('slot--clash');
    }
  } else {
    slot.innerHTML = `<div class="slot-empty">LANE ${lane + 1}</div>`;
    if (ui.selectedCard && ui.selectedCard.kind === 'creature' && side === game.player) {
      slot.classList.add('slot--drop');
      slot.addEventListener('click', () => handlers.onPlayToLane(lane));
    }
  }
  return slot;
}

function lifeBar(side, name, isPlayer) {
  const wrap = document.createElement('div');
  wrap.className = `life ${isPlayer ? 'life--player' : 'life--rival'}`;
  const pct = Math.max(0, (side.life / 20) * 100);
  wrap.innerHTML = `
    <div class="life-name">${name}</div>
    <div class="life-bar"><div class="life-fill" style="width:${pct}%"></div></div>
    <div class="life-num">♥ ${side.life}<span class="life-max">/20</span></div>`;
  return wrap;
}

function emberPips(side) {
  const wrap = document.createElement('div');
  wrap.className = 'embers';
  wrap.title = 'Embers — spend them to play cards';
  let pips = '';
  for (let i = 0; i < 10; i += 1) {
    pips += `<span class="ember-pip${i < side.embers ? ' ember-pip--lit' : ''}${i < side.maxEmbers ? '' : ' ember-pip--off'}">●</span>`;
  }
  wrap.innerHTML = `<span class="embers-label">EMBERS</span><span class="embers-count">${side.embers}</span>${pips}`;
  return wrap;
}

/** The whole table for one frame. `ui` carries selection/targeting state. */
export function renderGame(stage, game, screen, ui, handlers) {
  stage.innerHTML = '';
  stage.className = 'stage';

  // Rival header: portrait, life, face-down hand, deck.
  const rival = document.createElement('div');
  rival.className = 'rival-row';
  const portrait = document.createElement('div');
  portrait.className = 'portrait portrait--rival';
  portrait.innerHTML = `<span class="portrait-glyph">♜</span><span class="portrait-name">${RIVAL_NAME}</span>`;
  rival.appendChild(portrait);
  rival.appendChild(lifeBar(game.ai, RIVAL_NAME, false));
  const aiHand = document.createElement('div');
  aiHand.className = 'mini-hand';
  aiHand.title = "The rival's hand";
  for (let i = 0; i < game.ai.hand.length; i += 1) {
    const back = document.createElement('div');
    back.className = 'mini-card';
    aiHand.appendChild(back);
  }
  const aiHandLabel = document.createElement('div');
  aiHandLabel.className = 'mini-hand-label';
  aiHandLabel.textContent = `${game.ai.hand.length} cards · deck ${game.ai.deck.length}`;
  const aiHandWrap = document.createElement('div');
  aiHandWrap.className = 'mini-hand-wrap';
  aiHandWrap.appendChild(aiHand);
  aiHandWrap.appendChild(aiHandLabel);
  rival.appendChild(aiHandWrap);
  // Clicking the rival portrait targets it with Fireball.
  if (ui.targetMode === 'target') {
    portrait.classList.add('portrait--targetable');
    portrait.addEventListener('click', () => handlers.onTargetHero());
  }
  stage.appendChild(rival);

  // The telegraph: what Vex plans to do next — readable, counterable intent.
  const intent = document.createElement('div');
  intent.className = 'intent';
  if (game.aiIntent && game.aiIntent.cardName) {
    const laneText = game.aiIntent.lane !== null && game.aiIntent.lane !== undefined
      ? ` — striking lane ${game.aiIntent.lane + 1}`
      : '';
    intent.innerHTML = `<span class="intent-eye">👁</span> <b>${RIVAL_NAME} is raising:</b> ${game.aiIntent.cardName}${laneText}. Block the lane or break the creature.`;
  } else if (game.aiIntent) {
    intent.innerHTML = `<span class="intent-eye">👁</span> <b>${RIVAL_NAME}</b> holds its embers… no card is coming.`;
  } else {
    intent.innerHTML = `<span class="intent-eye">👁</span> ${RIVAL_NAME} is watching you.`;
  }
  stage.appendChild(intent);

  // Rival board.
  const aiBoard = document.createElement('div');
  aiBoard.className = 'board board--rival';
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    aiBoard.appendChild(slotElement(game, game.ai, lane, ui, handlers));
  }
  stage.appendChild(aiBoard);

  // Middle strip: round, clash banner, log.
  const mid = document.createElement('div');
  mid.className = 'mid';
  const round = document.createElement('div');
  round.className = 'round';
  round.innerHTML = `ROUND <b>${game.round}</b>`;
  mid.appendChild(round);
  const clash = document.createElement('div');
  clash.className = 'clash';
  clash.textContent = game.clash ? game.clash.text : '— the table waits —';
  mid.appendChild(clash);
  const log = document.createElement('div');
  log.className = 'log';
  log.innerHTML = game.log.slice(0, 3).map((m) => `<div>${m}</div>`).join('') || '<div>Your move, summoner.</div>';
  mid.appendChild(log);
  stage.appendChild(mid);

  // Player board.
  const myBoard = document.createElement('div');
  myBoard.className = 'board board--player';
  for (let lane = 0; lane < BOARD_LANES; lane += 1) {
    myBoard.appendChild(slotElement(game, game.player, lane, ui, handlers));
  }
  stage.appendChild(myBoard);

  // Player HUD: life, embers, deck, controls.
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.appendChild(lifeBar(game.player, PLAYER_NAME, true));
  hud.appendChild(emberPips(game.player));
  const deckInfo = document.createElement('div');
  deckInfo.className = 'deck-info';
  deckInfo.innerHTML = `DECK <b>${game.player.deck.length}</b> · DISCARD <b>${game.player.discard.length}</b>`;
  hud.appendChild(deckInfo);
  const endBtn = document.createElement('button');
  endBtn.className = 'btn btn--end';
  endBtn.textContent = game.phase === 'player' ? 'END TURN  ⏎' : '…';
  endBtn.disabled = game.phase !== 'player';
  endBtn.addEventListener('click', () => handlers.onEndTurn());
  hud.appendChild(endBtn);
  const muteBtn = document.createElement('button');
  muteBtn.className = 'btn btn--ghost';
  muteBtn.textContent = ui.muted ? 'SOUND OFF' : 'SOUND ON';
  muteBtn.addEventListener('click', () => handlers.onToggleMute());
  hud.appendChild(muteBtn);
  const helpBtn = document.createElement('button');
  helpBtn.className = 'btn btn--ghost';
  helpBtn.textContent = 'HOW TO PLAY';
  helpBtn.addEventListener('click', () => handlers.onShowHelp());
  hud.appendChild(helpBtn);
  stage.appendChild(hud);

  // Player hand.
  const hand = document.createElement('div');
  hand.className = 'hand';
  game.player.hand.forEach((card, index) => {
    const playable = game.phase === 'player' && card.cost <= game.player.embers;
    const el = cardElement(card, {
      game, side: game.player, lane: -1,
      playable,
      selected: ui.selectedCard === card,
    });
    el.style.setProperty('--deal-delay', `${index * 0.07}s`);
    el.classList.add('card--dealt');
    el.addEventListener('click', () => handlers.onSelectCard(card));
    hand.appendChild(el);
  });
  if (game.player.hand.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hand-empty';
    empty.textContent = 'Hand empty — draw next round.';
    hand.appendChild(empty);
  }
  stage.appendChild(hand);

  // Hint line: what the selection needs next.
  const hint = document.createElement('div');
  hint.className = 'hint';
  if (ui.selectedCard && ui.selectedCard.kind === 'creature') {
    hint.textContent = `${ui.selectedCard.name} — click an empty lane to summon it. Click the card again to cancel.`;
  } else if (ui.selectedCard && ui.selectedCard.effect === 'damage3') {
    hint.textContent = `${ui.selectedCard.name} — click an enemy creature, or ${RIVAL_NAME}'s portrait, to burn it.`;
  } else if (ui.selectedCard) {
    hint.textContent = `${ui.selectedCard.name} — click it again to cast.`;
  } else {
    hint.textContent = 'Click a card to play it · keys 1–8 select · Enter ends turn · R restarts';
  }
  stage.appendChild(hint);

  if (screen === SCREEN_TITLE) stage.appendChild(titleOverlay(handlers));
  if (screen === SCREEN_WIN) stage.appendChild(endOverlay(game, true, handlers));
  if (screen === SCREEN_LOSS) stage.appendChild(endOverlay(game, false, handlers));
  if (ui.showHelp) stage.appendChild(helpOverlay(handlers));
}

function titleOverlay(handlers) {
  const ov = document.createElement('div');
  ov.className = 'overlay overlay--title';
  ov.innerHTML = `
    <div class="title-kicker">AN ORIGINAL CARD DUEL · NO NETWORK · NO ACCOUNT</div>
    <h1 class="title-name">EMBER<br>PACT</h1>
    <p class="title-tag">You and the rival summoner <b>Ashen Vex</b> bind creatures in fire.<br>
    Spend embers, fill the four lanes, and burn the rival's life from <b>20 to 0</b>.</p>
    <div class="title-rules">
      <div><b>1 · PLAY</b><span>Click a card, then a lane. Spells strike at once.</span></div>
      <div><b>2 · EMBERS</b><span>Income grows each round — save for the Titan, or swarm early.</span></div>
      <div><b>3 · CLASH</b><span>Creatures strike across their lane; unopposed ones hit life.</span></div>
      <div><b>4 · READ VEX</b><span>The eye above the table telegraphs Vex's next card. Counter it.</span></div>
    </div>
    <button class="btn btn--big" id="play-btn">BEGIN THE DUEL</button>
    <p class="title-foot">Keyboard: 1–8 select a card · Enter ends the turn · M mutes · R restarts</p>`;
  ov.querySelector('#play-btn').addEventListener('click', () => handlers.onStart());
  return ov;
}

function endOverlay(game, won, handlers) {
  const ov = document.createElement('div');
  ov.className = `overlay ${won ? 'overlay--win' : 'overlay--loss'}`;
  const stats = `Rounds: ${game.round} · Your life: ${game.player.life} · Rival life: ${game.ai.life}`;
  ov.innerHTML = `
    ${won ? '<div class="confetti"></div>' : ''}
    <h1 class="end-name">${won ? 'VICTORY' : 'DEFEAT'}</h1>
    <p class="end-tag">${won
      ? 'The pact is yours — Ashen Vex kneels in the ashes.'
      : 'The embers fade. Vex keeps the pact… this time.'}</p>
    <p class="end-stats">${stats}</p>
    <button class="btn btn--big" id="again-btn">${won ? 'PLAY AGAIN' : 'TRY AGAIN'}</button>`;
  ov.querySelector('#again-btn').addEventListener('click', () => handlers.onRestart());
  return ov;
}

function helpOverlay(handlers) {
  const ov = document.createElement('div');
  ov.className = 'overlay overlay--help';
  ov.innerHTML = `
    <h2 class="help-title">HOW TO PLAY — EMBER PACT</h2>
    <div class="help-body">
      <p><b>Goal:</b> reduce ${RIVAL_NAME}'s life from 20 to 0 before yours falls.</p>
      <p><b>Turn:</b> gain embers (equal to the round, max 10), draw a card, then play
      as many cards as your embers allow. Click <b>END TURN</b>: Vex plays, then the
      creatures clash — each strikes the creature opposite it in its lane, and an
      unopposed creature strikes the rival's life.</p>
      <p><b>Cards:</b> the orange gem is the ember cost; the shape is the element —
      ▲ Flame, ❄ Frost, ◆ Stone, ⚡ Storm. Creatures show ⚔ attack and ♥ health.
      Spells resolve at once: Fireball burns a target, Wildfire scorches the whole
      enemy board, Pact of Flames buffs your creatures, Kindling draws, Mend heals.</p>
      <p><b>Combos:</b> Ember Surge funds a big turn; Flame Sprite buffs its neighbours;
      Phoenix Chick returns to your hand when destroyed; Frost Wisp freezes the foe
      in its lane so it cannot strike.</p>
      <p><b>Reading Vex:</b> the eye above the table shows the card Vex will raise
      and the lane it will strike. Put a blocker there — or burn the creature first.</p>
      <p><b>Controls:</b> mouse to click cards, lanes and targets. Keys: 1–8 select a
      hand card, Enter ends the turn, M mutes sound, R restarts, Esc closes this panel.</p>
    </div>
    <button class="btn btn--big" id="close-help">CLOSE</button>`;
  ov.querySelector('#close-help').addEventListener('click', () => handlers.onCloseHelp());
  return ov;
}
