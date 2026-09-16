import './onboarding.css';

// A one-time "how to play" card. Most new players never find the mamak table games,
// because nothing on screen says: walk to a chair, sit, open the table, press READY.
const KEY = 'lepakmamak-onboarded';
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* Storage is optional. */ } };

export function createOnboarding(touch: boolean, releaseInput: () => void = () => {}) {
  const move = touch ? 'Drag the MOVE stick' : 'Use W A S D';
  const steps: [string, string, string][] = [
    ['🛵', 'Jalan ke meja mamak', `${move} to walk to any mamak table. The nearest one is just across the road.`],
    ['🪑', 'Tap SIT on a chair', 'Stand next to an empty chair until a SIT button appears, then tap it.'],
    ['🎮', 'Open the table games', 'Once seated, tap the table name above it, then choose Lukis Lah, Poker, UNO or Werewolf.'],
    ['✅', 'Press READY', 'Everyone at the table presses READY. The game starts by itself when enough players are ready.'],
    ['🐱', 'Bring a pet along', 'Tap the cat icon at the top right to buy a cat in the shop. Choose Equip to have them follow you, and change their ribbon anytime.'],
    ['👋', 'Ajak kawan', 'Table empty? Tap INVITE inside the game to call your geng or anyone in the city.'],
  ];
  const dialog = document.createElement('dialog');
  dialog.id = 'cara-main'; dialog.setAttribute('aria-labelledby', 'cara-main-title');
  dialog.innerHTML = `<header><small>CARA MAIN · HOW TO PLAY</small><h2 id="cara-main-title">Jom lepak & main</h2></header>
    <ol>${steps.map(([icon, title, body]) => `<li><span aria-hidden="true">${icon}</span><div><b>${title}</b><p>${body}</p></div></li>`).join('')}</ol>
    <label id="cara-main-skip"><input type="checkbox" id="cara-main-skip-check">Do not show again</label>
    <button type="button" id="cara-main-done" class="primary">Faham, jom!</button>`;
  document.body.append(dialog);
  const done = dialog.querySelector<HTMLButtonElement>('#cara-main-done')!;
  const skip = dialog.querySelector<HTMLInputElement>('#cara-main-skip-check')!;
  // The card used to remember itself the moment it closed, however that happened — Escape, a
  // backdrop tap, or the button — so a player who dismissed it without reading never saw it
  // again. It now only stays gone once they tick the box themselves.
  done.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (skip.checked) remember(); });

  const button = document.createElement('button');
  button.type = 'button'; button.id = 'open-cara-main'; button.className = 'secondary';
  button.textContent = 'Cara main · How to play';

  const open = () => { if (dialog.open) return; releaseInput(); dialog.showModal(); done.focus(); };
  button.onclick = open;
  return { dialog, button, open, showOnce() { if (seen()) return false; open(); return true; } };
}
