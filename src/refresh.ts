// The server states its own version on welcome, so a page left open across a deploy finds
// out without polling anything. Only a server that is genuinely newer triggers a refresh:
// the two halves deploy separately, so a client briefly ahead of the server must sit still
// rather than reload itself in a circle.
export function isStale(client: string, server: string): boolean {
  const parse = (value: string) => String(value || '').split('.').map(part => Number.parseInt(part, 10));
  const mine = parse(client), theirs = parse(server);
  if (mine.some(Number.isNaN) || theirs.some(Number.isNaN) || !theirs.length) return false;
  for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
    const a = mine[i] || 0, b = theirs[i] || 0;
    if (a !== b) return b > a;
  }
  return false;
}

// Remembered across the reload: if we come back still behind the version we reloaded for,
// the new build did not arrive and reloading again would just loop. Ask instead.
const ATTEMPTED = 'lepak-refreshed-for';
const readAttempt = () => { try { return sessionStorage.getItem(ATTEMPTED) || ''; } catch { return ''; } };
const writeAttempt = (version: string) => { try { sessionStorage.setItem(ATTEMPTED, version); } catch { /* private window */ } };

export function createRefresher(
  host: HTMLElement,
  options: {seconds?: number; reload?: () => void; now?: () => number} = {},
) {
  const seconds = options.seconds ?? 3;
  const reload = options.reload ?? (() => {
    // A cache-busted URL rather than reload(): the entry document is must-revalidate, but a
    // stale intermediary or a back-forward cache can still hand back the old one.
    const url = new URL(location.href);
    url.searchParams.set('v', String(Date.now()));
    location.replace(url.toString());
  });
  const now = options.now ?? (() => Date.now());

  const root = document.createElement('div');
  root.id = 'force-refresh'; root.hidden = true;
  root.setAttribute('role', 'alertdialog'); root.setAttribute('aria-live', 'assertive');
  root.innerHTML = '<div class="refresh-card"><small>LEPAKMAMAK</small><strong id="refresh-line"></strong><p id="refresh-note"></p><button type="button" id="refresh-now" hidden>Refresh now</button></div>';
  host.append(root);
  const line = root.querySelector<HTMLElement>('#refresh-line')!;
  const note = root.querySelector<HTMLElement>('#refresh-note')!;
  const button = root.querySelector<HTMLButtonElement>('#refresh-now')!;
  button.onclick = () => reload();

  let timer: number | null = null, target = '';

  return {
    root,
    get pending() { return target; },
    // Returns what it decided, so a caller (and a test) can see why nothing happened.
    check(clientVersion: string, serverVersion: string): 'current' | 'counting' | 'asking' {
      if (timer !== null || !isStale(clientVersion, serverVersion)) return timer !== null ? 'counting' : 'current';
      target = serverVersion;
      root.hidden = false;
      // Already tried to reach this version and came back short: the build is not there yet.
      if (!isStale(readAttempt() || '0.0.0', serverVersion)) {
        line.textContent = 'A NEWER VERSION IS OUT';
        note.textContent = `You are on v${clientVersion}, the city is on v${serverVersion}. Automatic refresh did not pick it up — try once by hand.`;
        button.hidden = false;
        return 'asking';
      }
      let left = seconds;
      const paint = () => { line.textContent = `FULL REFRESH BY SYSTEM IN ${left}`; note.textContent = `v${clientVersion} → v${serverVersion}`; };
      paint();
      const started = now();
      timer = window.setInterval(() => {
        // Driven by the clock, not by tick count: a backgrounded tab throttles timers and
        // would otherwise sit on "3" for a minute before reloading.
        left = Math.max(0, seconds - Math.floor((now() - started) / 1000));
        paint();
        if (left > 0) return;
        window.clearInterval(timer!); timer = null;
        writeAttempt(serverVersion);
        reload();
      }, 250);
      return 'counting';
    },
  };
}
