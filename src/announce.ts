import './announce.css';

export const CRAWL_MS = 13000;

// A crawl across the top edge, where players expect server announcements. It is
// deliberately temporary: the same line is also written into city chat, so anyone who
// looked away can scroll back to it rather than having missed it forever.
export function createAnnouncer(hud: HTMLElement, crawlMs = CRAWL_MS) {
  const strip = document.createElement('aside');
  strip.id = 'gm-announce'; strip.hidden = true;
  strip.setAttribute('role', 'status'); strip.setAttribute('aria-live', 'polite');
  strip.innerHTML = '<div class="gm-crawl"><span></span></div>';
  hud.append(strip);
  const line = strip.querySelector('span')!;
  const crawl = strip.querySelector<HTMLElement>('.gm-crawl')!;
  let timer = 0;

  function clear() {
    window.clearTimeout(timer);
    strip.hidden = true;
    document.body.classList.remove('gm-announcing');
  }

  return {
    root: strip,
    clear,
    show(text: string, name = 'GM') {
      line.textContent = `✦ GM · ${name} · ${text}`;
      strip.hidden = false;
      document.body.classList.add('gm-announcing');
      // Restart the crawl from the right edge, so a second message does not inherit the
      // tail of the one it replaced.
      crawl.style.animation = 'none';
      void crawl.offsetWidth;
      crawl.style.animation = '';
      crawl.style.animationDuration = `${crawlMs}ms`;
      window.clearTimeout(timer);
      timer = window.setTimeout(clear, crawlMs * 2);
    },
  };
}
