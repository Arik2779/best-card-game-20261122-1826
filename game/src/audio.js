// Ember Pact — all sound is synthesized with WebAudio: no audio files, no
// network. Short oscillator blips with envelopes for each game moment.
let ctx = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensureCtx();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

/** One blip: a sine/triangle tone sliding from `from` Hz to `to` Hz. */
function blip(from, to, duration, type, gainValue, delay = 0) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sfx = {
  // A card sliding out of the hand.
  slide() { blip(520, 880, 0.12, 'sine', 0.08); },
  // A card snapping onto the table.
  play() { blip(180, 90, 0.14, 'triangle', 0.16); blip(660, 660, 0.08, 'sine', 0.06, 0.02); },
  // A creature striking.
  hit() { blip(220, 55, 0.18, 'sawtooth', 0.14); },
  // Damage landing on a life total.
  damage() { blip(320, 70, 0.28, 'sawtooth', 0.12); blip(160, 60, 0.2, 'square', 0.05, 0.05); },
  // A spell crackling.
  spell() { blip(900, 240, 0.25, 'sawtooth', 0.07); blip(1400, 500, 0.18, 'sine', 0.05, 0.04); },
  // A card drawn.
  draw() { blip(440, 660, 0.09, 'sine', 0.05); },
  // A turn ending.
  endTurn() { blip(330, 220, 0.16, 'triangle', 0.09); },
  // An illegal move.
  error() { blip(140, 110, 0.15, 'square', 0.06); },
  // The win fanfare: a rising arpeggio.
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, f, 0.35, 'triangle', 0.12, i * 0.11));
    blip(262, 262, 0.7, 'sine', 0.06, 0.1);
  },
  // The loss descent.
  lose() {
    [392, 330, 262, 196].forEach((f, i) => blip(f, f * 0.94, 0.4, 'triangle', 0.1, i * 0.14));
  },
};
