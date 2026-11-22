# Ember Pact

An original card duel for the make.fun bounty
[best-card-game-20261122-1826](https://make.fun/bounty/best-card-game-20261122-1826).
Repo: `Arik2779/best-card-game-20261122-1826`.

You and the rival summoner **Ashen Vex** bind creatures in fire. Spend embers,
fill the four lanes, and burn the rival's life from 20 to 0.

## How to play

- **Turn:** gain embers (equal to the round, max 10), draw a card, then play as
  many cards as your embers allow. Click **END TURN**: Vex plays, then the
  creatures clash — each strikes the creature opposite it in its lane, and an
  unopposed creature strikes the rival's life.
- **Cards:** the orange gem is the ember cost; the shape is the element —
  ▲ Flame, ❄ Frost, ◆ Stone, ⚡ Storm. Creatures show ⚔ attack and ♥ health.
  Spells resolve at once: Fireball burns a target, Wildfire scorches the whole
  enemy board, Pact of Flames buffs your creatures, Kindling draws, Mend heals.
- **Combos:** Ember Surge funds a big turn; Flame Sprite buffs its neighbours;
  Phoenix Chick returns to your hand when destroyed; Frost Wisp freezes the foe
  in its lane so it cannot strike.
- **Reading Vex:** the eye above the table shows the card Vex will raise and
  the lane it will strike. Put a blocker there — or burn the creature first.

## Controls

- Mouse: click cards, lanes and targets.
- Keys: `1–8` select a hand card, `Enter` ends the turn, `M` mutes sound,
  `R` restarts, `Esc` cancels a selection / closes help.

## Running it

Serve `game/` with any static server and open `index.html` in a desktop
browser. No network requests, no build step, all art and sound are generated
in the page (procedural gradients and WebAudio synth).

## Layout

- `game/src/config.js` — tuning constants
- `game/src/cards.js` — the card set and deck
- `game/src/state.js` — game state and the rules
- `game/src/ai.js` — Ashen Vex: planning and the telegraph
- `game/src/render.js` — paints the table, cards and screens
- `game/src/input.js` — keyboard input
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/shots.js` — the `?shot=` screenshot scenes
- `game/src/main.js` — boot and the turn/combat flow
- `main.ts` — the hand-in program (copies `game/` + `screenshots/`, writes the dossier)
