import './onboarding.css';

// The "how to play" write-up, opened from Settings. It used to be shown over the city on every
// first visit, and most new players still never found the table games it described: six
// paragraphs before you have moved are not read. first-steps.ts now leads a new player
// through the same steps one at a time, and this stays as the reference for whoever wants it.

export function createOnboarding(touch: boolean, releaseInput: () => void = () => {}, openPets?: () => void) {
  const move = touch ? 'Drag the MOVE stick' : 'Use W A S D';
  const steps: [string, string, string][] = [
    ['🛵', 'Jalan ke meja mamak', `${move} to walk to any mamak table. The nearest one is just across the road.`],
    ['🪑', 'Tap SIT on a chair', 'Stand next to an empty chair until a SIT button appears, then tap it.'],
    ['🎮', 'Open the table games', 'Once seated, tap the table name above it, then choose Lukis Lah, Poker, UNO or Werewolf.'],
    ['✅', 'Press READY', 'Everyone at the table presses READY. The game starts by itself when enough players are ready.'],
    ['🐱', 'Bring a pet along', 'Adopt one companion for 250 Lepak Coin, then give it a name and change its breed, style or coat colour anytime in Pet Studio.'],
    ['👋', 'Ajak kawan', 'Table empty? Tap INVITE inside the game to call your geng or anyone in the city.'],
  ];
  const dialog = document.createElement('dialog');
  dialog.id = 'cara-main'; dialog.setAttribute('aria-labelledby', 'cara-main-title');
  dialog.innerHTML = `<header><small>CARA MAIN · HOW TO PLAY</small><h2 id="cara-main-title">Jom lepak & main</h2></header>
    <ol>${steps.map(([icon, title, body]) => `<li><span aria-hidden="true">${icon}</span><div><b>${title}</b><p>${body}</p></div></li>`).join('')}</ol>
    <button type="button" id="cara-main-done" class="primary">Faham, jom!</button>`;
  document.body.append(dialog);
  if (openPets) {
    const action = document.createElement('button'); action.type = 'button'; action.className = 'cara-main-action'; action.textContent = 'Buy or customise pet';
    action.onclick = () => { dialog.close(); openPets(); };
    dialog.querySelectorAll('li')[4].querySelector('div')!.append(action);
  }
  const done = dialog.querySelector<HTMLButtonElement>('#cara-main-done')!;
  done.onclick = () => dialog.close();

  const button = document.createElement('button');
  button.type = 'button'; button.id = 'open-cara-main'; button.className = 'secondary';
  button.textContent = 'Cara main · How to play';

  const open = () => { if (dialog.open) return; releaseInput(); dialog.showModal(); done.focus(); };
  button.onclick = open;
  return { dialog, button, open };
}
