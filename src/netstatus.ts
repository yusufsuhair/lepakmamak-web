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
  root.innerHTML = '<span class="bars">' + [1, 2, 3, 4].map(n => `<i class="bar bar-${n}"></i>`).join('') + '</span><b id="net-ping">—</b>';
  root.setAttribute('role', 'status');
  hud.append(root);
  const ping = root.querySelector<HTMLElement>('#net-ping')!;
  const bars = [...root.querySelectorAll<HTMLElement>('.bar')];

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
    offline() { paint('none', 0, '—'); },
  };
}
