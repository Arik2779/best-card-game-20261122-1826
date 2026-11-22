// Ember Pact — tuning constants. One place for every number the rules use,
// so a balance change never means hunting through the game logic.
export const GAME_TITLE = 'Ember Pact';
export const RIVAL_NAME = 'Ashen Vex';
export const PLAYER_NAME = 'You';

export const START_LIFE = 20;
export const MAX_LIFE = 20;
export const START_HAND = 4;
export const MAX_HAND = 8;
export const BOARD_LANES = 4;
export const MAX_EMBERS = 10;
export const DECK_SIZE = 30;

// How many embers a side gains at the start of its turn: the round number,
// capped, so later rounds can field the big creatures.
export function embersForRound(round) {
  return Math.min(round, MAX_EMBERS);
}

// Combat pacing (milliseconds) so each clash reads on screen.
export const COMBAT_STEP_MS = 620;
export const AI_STEP_MS = 750;
export const DEAL_STAGGER_MS = 90;

// Screenshot stage size.
export const STAGE_W = 1280;
export const STAGE_H = 800;
