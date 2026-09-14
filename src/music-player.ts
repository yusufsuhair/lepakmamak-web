import './music-player.css';

export function createMusicPlayer(audio: HTMLAudioElement, toggle: () => void, skip: () => void) {
  const player = document.createElement('section');
  player.id = 'music-player';
  player.setAttribute('aria-label', 'Background music player');
  player.innerHTML = `<div class="music-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="music-copy"><span class="music-status">LEPAK RADIO</span><strong class="music-title"></strong></div><div class="music-controls"><button type="button" class="music-play" aria-label="Play music"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg></button><button type="button" class="music-next" aria-label="Next song"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 10 7-10 7ZM17 5h3v14h-3Z"/></svg></button></div><div class="music-progress" aria-hidden="true"><span></span></div>`;
  document.getElementById('speedometer')!.prepend(player);
  const play = player.querySelector<HTMLButtonElement>('.music-play')!;
  const title = player.querySelector<HTMLElement>('.music-title')!;
  const status = player.querySelector<HTMLElement>('.music-status')!;
  const progress = player.querySelector<HTMLElement>('.music-progress span')!;
  play.onclick = toggle;
  player.querySelector<HTMLButtonElement>('.music-next')!.onclick = skip;
  player.addEventListener('keydown', event => event.stopPropagation());
  const sync = () => {
    const playing = !audio.paused && !audio.ended;
    player.classList.toggle('is-playing', playing);
    play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    play.querySelector('path')!.setAttribute('d', playing ? 'M7 5h4v14H7ZM14 5h4v14h-4Z' : 'm9 5 11 7-11 7Z');
    status.textContent = audio.error ? 'UNAVAILABLE' : playing ? 'NOW PLAYING' : 'PAUSED';
    progress.style.transform = `scaleX(${Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0})`;
  };
  for (const event of ['playing', 'pause', 'ended', 'emptied', 'timeupdate', 'error']) audio.addEventListener(event, sync);
  return (filename: string) => { title.textContent = filename; title.title = filename; sync(); };
}
