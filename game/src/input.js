// Ember Pact — keyboard input. Mouse clicks are wired by the renderer;
// this file owns the keys: 1–8 select a hand card, Enter ends the turn,
// M mutes, R restarts, Esc cancels a selection or closes help.
export function createInput(callbacks) {
  function onKey(event) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key >= '1' && key <= '8') {
      callbacks.onSelectIndex(Number.parseInt(key, 10) - 1);
    } else if (key === 'enter') {
      callbacks.onEndTurn();
    } else if (key === 'm') {
      callbacks.onToggleMute();
    } else if (key === 'r') {
      callbacks.onRestart();
    } else if (key === 'escape') {
      callbacks.onEscape();
    } else if (key === ' ') {
      event.preventDefault();
      callbacks.onConfirm();
    }
  }
  window.addEventListener('keydown', onKey);
  return { destroy() { window.removeEventListener('keydown', onKey); } };
}
