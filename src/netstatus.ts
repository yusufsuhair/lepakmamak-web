import './netstatus.css';

// Round trip to the room server, graded the way a phone grades signal. The thresholds are
// what a player on mobile data actually feels: under 80ms is local, and past 300ms the
// city starts to argue with you.
const GRADES: {grade: string; upTo: number; bars: number}[] = [
  {grade: 'good', upTo: 80, bars: 4},
  {grade: 'fair', upTo: 150, bars: 3},
  {grade: 'poor', upTo: 300, bars: 2},
  {grade: 'bad', upTo: Infinity, bars: 1},
];

export function createNetStatus(hud: HTMLElement) {
  const root = document.createElement('div');
  root.id = 'net-status'; root.dataset.grade = 'none';
  root.innerHTML = '<span class="bars">' + [1, 2, 3, 4].map(n => `<i class="bar bar-${n}"></i>`).join('') + '</span><span class="net-readings"><b id="net-ping">—</b><b id="net-fps" aria-hidden="true">— FPS</b><b id="net-graphics">GRAPHIC: —</b></span>';
  root.setAttribute('role', 'status');
  hud.append(root);
  const ping = root.querySelector<HTMLElement>('#net-ping')!;
  const fps = root.querySelector<HTMLElement>('#net-fps')!;
  const graphics = root.querySelector<HTMLElement>('#net-graphics')!;
  const bars = [...root.querySelectorAll<HTMLElement>('.bar')];
  let frameCount = 0, frameSeconds = 0;

  function paint(grade: string, lit: number, label: string) {
    root.dataset.grade = grade;
    ping.textContent = label;
    bars.forEach((bar, index) => bar.classList.toggle('on', index < lit));
    root.setAttribute('aria-label', grade === 'none' ? 'Not connected to the city' : `Connection ${grade}, ${label} round trip`);
  }

  return {
    root,
    sample(rtt: number) {
      const {grade, bars: lit} = GRADES.find(entry => rtt <= entry.upTo)!;
      paint(grade, lit, `${Math.round(rtt)} ms`);
    },
    frame(seconds: number) {
      // Ignore a background-tab jump, then average a short window so the readout is
      // responsive without changing the DOM on every animation frame.
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= .5) return;
      frameCount++; frameSeconds += seconds;
      if (frameSeconds < .5) return;
      fps.textContent = `${Math.round(frameCount / frameSeconds)} FPS`;
      frameCount = 0; frameSeconds = 0;
    },
    quality(value: string) { graphics.textContent = `GRAPHIC: ${value.toUpperCase()}`; },
    offline() { paint('none', 0, '—'); },
  };
}
