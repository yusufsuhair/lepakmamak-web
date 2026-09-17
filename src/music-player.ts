import './music-player.css';
import { RADIO_STATIONS, type RadioStatus } from './radio';

export type MusicSource = 'music' | 'radio';
type PlayerState = {source: MusicSource; title: string; playing: boolean; enabled: boolean; radioStatus: RadioStatus; station: string; volume: number; progress: number};

export function createMusicPlayer(actions: {
  toggle(): void; skip(): void; source(value: MusicSource): void;
  station(id: string): void; volume(value: number): void; retry(): void; open(): void;
}) {
  const player = document.createElement('section');
  player.id = 'music-player'; player.setAttribute('aria-label', 'Music and radio player');
  player.innerHTML = `<button type="button" class="music-copy" aria-label="Open music and radio" aria-haspopup="dialog"><span class="music-status">MUSIC</span><strong class="music-title">Lofi</strong></button><button type="button" class="music-play" aria-label="Play music"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg></button><button type="button" class="music-next" aria-label="Next song"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 10 7-10 7ZM17 5h3v14h-3Z"/></svg></button><div class="music-progress" aria-hidden="true"><span></span></div>`;
  document.getElementById('speedometer')!.append(player);
  const dialog = document.createElement('dialog'); dialog.id = 'music-dialog'; dialog.setAttribute('aria-labelledby', 'music-dialog-title');
  dialog.innerHTML = `<header><div><small>YOUR SOUNDTRACK</small><h2 id="music-dialog-title">Music & radio</h2></div><button type="button" class="music-close" aria-label="Close music and radio">×</button></header><div class="music-sources" role="group" aria-label="Audio source"><button type="button" data-source="music" aria-pressed="true">Music</button><button type="button" data-source="radio" aria-pressed="false">Radio</button></div><div class="music-now"><span class="music-detail-status" role="status"></span><strong class="music-detail-title"></strong></div><div class="radio-stations" role="group" aria-label="Radio stations" hidden></div><p class="music-error" role="status" hidden>Couldn't connect. Try again or switch to Music.</p><div class="music-dialog-controls"><button type="button" class="music-detail-play">Pause music</button><button type="button" class="music-detail-next">Next song</button><button type="button" class="music-retry" hidden>Retry radio</button></div><label class="music-volume">Volume <input type="range" min="0" max="1" step="0.05" aria-label="Player volume"><output></output></label><p class="radio-credit" hidden>Live streams use mobile data. <a target="_blank" rel="noopener noreferrer">Station website ↗</a></p>`;
  document.body.append(dialog);
  const select = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const stationList = select<HTMLDivElement>('.radio-stations');
  for (const station of RADIO_STATIONS) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.station = station.id;
    button.innerHTML = `<span>${station.name}</span><small>${station.language}</small>`;
    button.setAttribute('aria-pressed', 'false'); button.onclick = () => actions.station(station.id);
    stationList.append(button);
  }
  const open = player.querySelector<HTMLButtonElement>('.music-copy')!;
  const close = () => { dialog.close(); open.focus(); };
  open.onclick = () => { actions.open(); dialog.showModal(); };
  select<HTMLButtonElement>('.music-close').onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });
  for (const element of [player, dialog]) {
    element.addEventListener('keydown', event => event.stopPropagation());
    element.addEventListener('pointerdown', event => event.stopPropagation());
  }
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-source]')) button.onclick = () => actions.source(button.dataset.source as MusicSource);
  player.querySelector<HTMLButtonElement>('.music-play')!.onclick = actions.toggle;
  select<HTMLButtonElement>('.music-detail-play').onclick = actions.toggle;
  player.querySelector<HTMLButtonElement>('.music-next')!.onclick = actions.skip;
  select<HTMLButtonElement>('.music-detail-next').onclick = actions.skip;
  select<HTMLButtonElement>('.music-retry').onclick = actions.retry;
  select<HTMLInputElement>('input').oninput = event => actions.volume(Number((event.target as HTMLInputElement).value));

  return {
    close() { dialog.close(); },
    update(state: PlayerState) {
      const radio = state.source === 'radio';
      const status = radio ? ({paused:'PAUSED', connecting:'CONNECTING…', live:'LIVE RADIO', error:'UNAVAILABLE'})[state.radioStatus] : state.playing ? 'NOW PLAYING' : 'PAUSED';
      const pause = state.enabled && (state.playing || (radio && state.radioStatus === 'connecting'));
      const label = `${pause ? 'Pause' : 'Play'} ${state.source}`;
      player.classList.toggle('is-playing', state.playing); player.classList.toggle('is-radio', radio);
      player.querySelector('.music-status')!.textContent = radio ? status : `MUSIC · ${status}`;
      player.querySelector('.music-title')!.textContent = state.title;
      player.querySelector('.music-copy')!.setAttribute('title', `${state.title} · Choose music or radio`);
      const play = player.querySelector<HTMLButtonElement>('.music-play')!;
      play.setAttribute('aria-label', label);
      play.querySelector('path')!.setAttribute('d', pause ? 'M7 5h4v14H7ZM14 5h4v14h-4Z' : 'm9 5 11 7-11 7Z');
      (player.querySelector('.music-progress span') as HTMLElement).style.transform = `scaleX(${radio ? state.playing ? 1 : 0 : state.progress})`;
      const nextLabel = radio ? 'Next station' : 'Next song';
      player.querySelector('.music-next')!.setAttribute('aria-label', nextLabel);
      select('.music-detail-play').textContent = label; select('.music-detail-next').textContent = nextLabel;
      select('.music-detail-title').textContent = state.title; select('.music-detail-status').textContent = status;
      stationList.hidden = !radio;
      select('.radio-credit').hidden = !radio;
      select('.music-error').hidden = !(radio && state.radioStatus === 'error');
      select('.music-retry').hidden = !(radio && state.radioStatus === 'error');
      for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-source]')) button.setAttribute('aria-pressed', String(button.dataset.source === state.source));
      for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-station]')) button.setAttribute('aria-pressed', String(button.dataset.station === state.station));
      select<HTMLAnchorElement>('.radio-credit a').href = RADIO_STATIONS.find(s => s.id === state.station)!.website;
      select<HTMLInputElement>('input').value = String(state.volume); select<HTMLOutputElement>('output').value = `${Math.round(state.volume * 100)}%`;
    },
  };
}
