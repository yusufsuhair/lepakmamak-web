import './changelog.css';
import releases from '../shared/changelog.json';

// What players get told about their own game. The notes are written for them, not copied
// from commit messages, and every past release stays on the list so progress is visible.
export function createWhatsNew(container: HTMLElement) {
  const latest = releases[0];
  const when = new Date(latest.date);
  const stamp = Number.isFinite(when.getTime())
    ? new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric'}).format(when)
    : latest.date;

  const root = document.createElement('section');
  root.id = 'whats-new';
  root.innerHTML = `<header><h3>Apa yang baharu</h3><p><b id="whats-new-version">v${latest.version}</b> · dikemas kini <time id="whats-new-date" datetime="${latest.date}">${stamp}</time></p></header>`;

  for (const [index, release] of releases.entries()) {
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
    root.append(item);
  }

  container.append(root);
  return {root, version: latest.version, updated: latest.date};
}
