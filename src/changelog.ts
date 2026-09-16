import './changelog.css';
import releases from '../shared/changelog.json';

// What players get told about their own game. The notes are written for them, not copied
// from commit messages. Every past release is kept, but only the newest few are on screen:
// the settings panel is a phone-height column, and a list that grows with every release
// pushes the buttons underneath it out of reach.
const VISIBLE = 3;
export function createWhatsNew(container: HTMLElement) {
  const latest = releases[0];
  const when = new Date(latest.date);
  const stamp = Number.isFinite(when.getTime())
    ? new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric'}).format(when)
    : latest.date;

  const root = document.createElement('section');
  root.id = 'whats-new';
  root.innerHTML = `<header><h3>What's new</h3><p><b id="whats-new-version">v${latest.version}</b> · updated <time id="whats-new-date" datetime="${latest.date}">${stamp}</time></p></header>`;

  const build = (release: typeof releases[number], index: number) => {
    const item = document.createElement('details');
    item.className = 'release';
    // The newest one is open, so you see the latest without hunting for it.
    item.open = index === 0;
    const summary = document.createElement('summary');
    const title = document.createElement('b'); title.textContent = release.title;
    const meta = document.createElement('small'); meta.textContent = `v${release.version} · ${release.date}`;
    summary.append(title, meta);
    const list = document.createElement('ul');
    for (const note of release.notes) {
      const line = document.createElement('li');
      line.textContent = note;
      list.append(line);
    }
    item.append(summary, list);
    return item;
  };

  for (const [index, release] of releases.slice(0, VISIBLE).entries()) root.append(build(release, index));
  if (releases.length > VISIBLE) {
    const more = document.createElement('button');
    more.type = 'button'; more.id = 'whats-new-more';
    more.textContent = `View ${releases.length - VISIBLE} older updates`;
    more.onclick = () => {
      for (const [index, release] of releases.slice(VISIBLE).entries()) root.append(build(release, index + VISIBLE));
      more.remove();
    };
    root.append(more);
  }

  // Below the buttons, so a growing list never pushes Resume or Return out of reach.
  const controls = container.querySelector('.pause-controls');
  if (controls) container.insertBefore(root, controls); else container.append(root);
  return {root, version: latest.version, updated: latest.date};
}
