// A touch that lands on nothing should still feel like it landed. One ring per press,
// purely decorative, and never in the way of what was actually pressed.
const IGNORE = 'button, a, input, select, textarea, label, dialog, [role="button"], [role="option"], [role="tab"], [role="radio"], [contenteditable="true"]';
const LIMIT = 6;   // rapid tapping must not pile up rings faster than they fade

export function createRipples(host: HTMLElement, options: {reducedMotion?: boolean} = {}) {
  const layer = document.createElement('div');
  layer.id = 'tap-ripples'; layer.setAttribute('aria-hidden', 'true');
  host.append(layer);
  const reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tap(x: number, y: number) {
    if (reduced) return;
    while (layer.childElementCount >= LIMIT) layer.firstElementChild!.remove();
    const ring = document.createElement('span');
    ring.className = 'tap-ripple';
    ring.style.left = `${x}px`; ring.style.top = `${y}px`;
    layer.append(ring);
    // animationend is the normal exit; the timer covers a tab backgrounded mid-animation,
    // where the event never arrives and the ring would otherwise stay on screen for good.
    const done = () => ring.remove();
    ring.addEventListener('animationend', done, {once: true});
    setTimeout(done, 1200);
  }

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Element | null;
    // Anything you could have meant to press keeps its own feedback.
    if (target?.closest?.(IGNORE)) return;
    tap(event.clientX, event.clientY);
  };
  // Capture and passive: it must never delay or swallow the press it is decorating.
  addEventListener('pointerdown', onPointerDown, {capture: true, passive: true});

  return {layer, tap, stop: () => removeEventListener('pointerdown', onPointerDown, {capture: true})};
}
