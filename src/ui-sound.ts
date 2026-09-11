// Tiny interface sounds keep menus feeling like part of the game without adding a
// download or competing with the city, vehicle, or table-game audio.
type SoundKind = 'tap' | 'open' | 'close' | 'reset' | 'notify' | 'success';

export function setupUiSounds(soundToggle?: HTMLInputElement) {
  let context: AudioContext | undefined;
  let lastPlayed = 0;
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  function unlock() {
    if (!AudioContextCtor) return;
    try {
      context ??= new AudioContextCtor();
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch { /* Audio is optional; the controls remain usable without it. */ }
  }

  function tone(kind: SoundKind) {
    if (!soundToggle?.checked || !context || context.state !== 'running') return;
    const now = performance.now();
    if (now - lastPlayed < 55) return;
    lastPlayed = now;
    const at = context.currentTime;
    const notes = kind === 'close' ? [720, 470] : kind === 'reset' ? [520, 780, 1040] : kind === 'notify' ? [880, 1180] : kind === 'success' ? [660, 880, 1180] : kind === 'open' ? [520, 780] : [650];
    const spacing = kind === 'reset' ? .065 : kind === 'notify' ? .07 : kind === 'success' ? .08 : .045;
    const duration = kind === 'tap' ? .11 : kind === 'notify' ? .15 : kind === 'success' ? .18 : .17;
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const start = at + index * spacing;
      oscillator.type = kind === 'tap' || kind === 'notify' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === 'close' ? .94 : 1.05), start + .08);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(kind === 'tap' ? .024 : kind === 'notify' ? .028 : .032, start + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      oscillator.connect(gain); gain.connect(context!.destination);
      oscillator.start(start); oscillator.stop(start + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }

  function play(kind: SoundKind) {
    if (soundToggle && !soundToggle.checked) return;
    unlock();
    if (context?.state === 'running') tone(kind);
    else if (context) void context.resume().then(() => tone(kind)).catch(() => {});
  }

  function kindFor(button: HTMLButtonElement) : SoundKind {
    const id = button.id.toLowerCase();
    const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
    if (id === 'map-reset' || /reset map|reset view|centre camera|center camera/.test(label)) return 'reset';
    if (button.getAttribute('aria-expanded') === 'true' || /close|shrink|collapse|minimi[sz]e|hide|back/.test(`${id} ${label}`)) return 'close';
    if (button.getAttribute('aria-expanded') === 'false' || /open|expand|restore|menu|map|inventory|kedai|shop|wall|setting|chat/.test(`${id} ${label}`)) return 'open';
    return 'tap';
  }

  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', event => {
    unlock();
    if (event.key === 'Escape') play('close');
  }, { passive: true });
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('button,[role="button"]');
    if (button && !button.disabled && button.dataset.uiSound !== 'none') play(kindFor(button));
    if (target?.id === 'pause' || target?.id === 'city-map') play('close');
  }, true);

  return { play };
}
