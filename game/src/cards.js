// Ember Pact — the card set. Every card is original: its own name, art glyph
// and effect. Four elements (suits) are told apart by colour AND shape, never
// by text alone: Flame is orange-red with a triangle, Frost is ice-blue with a
// snowflake, Stone is ochre with a diamond, Storm is violet with a bolt.
//
// A creature card has attack / health and fights on the table. A spell card
// resolves at once and is gone. `effect` names the on-play hook state.js runs.
export const ELEMENTS = {
  flame: { name: 'Flame', color: '#ff6b35', dark: '#c1440e', glyph: '▲', glow: 'rgba(255,107,53,.55)' },
  frost: { name: 'Frost', color: '#4cc9f0', dark: '#147a9e', glyph: '❄', glow: 'rgba(76,201,240,.55)' },
  stone: { name: 'Stone', color: '#e9c46a', dark: '#8a6d2b', glyph: '◆', glow: 'rgba(233,196,106,.55)' },
  storm: { name: 'Storm', color: '#c77dff', dark: '#7b2cbf', glyph: '⚡', glow: 'rgba(199,125,255,.55)' },
};

// id, name, element, kind, cost, attack, health, effect, text
export const CARD_DEFS = [
  { id: 'emberling', name: 'Emberling', element: 'flame', kind: 'creature', cost: 1, attack: 2, health: 1, effect: null, text: 'A spark with teeth.' },
  { id: 'cinder-imp', name: 'Cinder Imp', element: 'flame', kind: 'creature', cost: 1, attack: 1, health: 2, effect: 'draw1', text: 'Draw a card when played.' },
  { id: 'ash-wolf', name: 'Ash Wolf', element: 'flame', kind: 'creature', cost: 2, attack: 3, health: 2, effect: null, text: 'It hunts in the smoke.' },
  { id: 'flame-sprite', name: 'Flame Sprite', element: 'flame', kind: 'creature', cost: 2, attack: 2, health: 3, effect: 'aura1', text: 'Neighbours gain +1 attack.' },
  { id: 'frost-wisp', name: 'Frost Wisp', element: 'frost', kind: 'creature', cost: 2, attack: 1, health: 4, effect: 'freeze', text: 'Freezes the foe in its lane.' },
  { id: 'thorn-vine', name: 'Thorn Vine', element: 'stone', kind: 'creature', cost: 2, attack: 2, health: 2, effect: 'heal2', text: 'Heals you for 2 when played.' },
  { id: 'stone-golem', name: 'Stone Golem', element: 'stone', kind: 'creature', cost: 3, attack: 2, health: 5, effect: null, text: 'A wall that walks.' },
  { id: 'phoenix-chick', name: 'Phoenix Chick', element: 'flame', kind: 'creature', cost: 3, attack: 3, health: 3, effect: 'rebirth', text: 'Returns to your hand once when destroyed.' },
  { id: 'gale-falcon', name: 'Gale Falcon', element: 'storm', kind: 'creature', cost: 3, attack: 4, health: 2, effect: 'swift', text: 'Strikes the rival for 1 when played.' },
  { id: 'storm-drake', name: 'Storm Drake', element: 'storm', kind: 'creature', cost: 4, attack: 5, health: 4, effect: 'zap1', text: 'Deals 1 to all enemy creatures.' },
  { id: 'ember-titan', name: 'Ember Titan', element: 'flame', kind: 'creature', cost: 6, attack: 7, health: 6, effect: null, text: 'The pact, kept in fire.' },
  { id: 'fireball', name: 'Fireball', element: 'flame', kind: 'spell', cost: 2, attack: 0, health: 0, effect: 'damage3', text: 'Deal 3 damage to any target.' },
  { id: 'ember-surge', name: 'Ember Surge', element: 'flame', kind: 'spell', cost: 1, attack: 0, health: 0, effect: 'embers2', text: 'Gain +2 embers this turn.' },
  { id: 'kindling', name: 'Kindling', element: 'storm', kind: 'spell', cost: 1, attack: 0, health: 0, effect: 'draw2', text: 'Draw 2 cards.' },
  { id: 'wildfire', name: 'Wildfire', element: 'flame', kind: 'spell', cost: 4, attack: 0, health: 0, effect: 'damageAll2', text: 'Deal 2 damage to all enemy creatures.' },
  { id: 'pact-of-flames', name: 'Pact of Flames', element: 'flame', kind: 'spell', cost: 3, attack: 0, health: 0, effect: 'buff2', text: 'Your creatures gain +2 attack.' },
  { id: 'mend', name: 'Mend', element: 'frost', kind: 'spell', cost: 2, attack: 0, health: 0, effect: 'heal5', text: 'Restore 5 life.' },
];

export const CARD_BY_ID = Object.fromEntries(CARD_DEFS.map((c) => [c.id, c]));

/** A fresh card instance: its own uid and mutable health/attack for buffs. */
let nextUid = 1;
export function makeCard(defId) {
  const def = CARD_BY_ID[defId];
  return {
    uid: nextUid++,
    defId: def.id,
    name: def.name,
    element: def.element,
    kind: def.kind,
    cost: def.cost,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    effect: def.effect,
    text: def.text,
    frozen: false,
    reborn: false,
    buff: 0,
  };
}

/** The 30-card deck: two copies of most cards, one each of the two finishers. */
export function buildDeck() {
  const ids = [];
  for (const def of CARD_DEFS) {
    const copies = def.id === 'ember-titan' || def.id === 'wildfire' ? 1 : 2;
    for (let i = 0; i < copies; i += 1) ids.push(def.id);
  }
  return ids.map((id) => makeCard(id));
}
