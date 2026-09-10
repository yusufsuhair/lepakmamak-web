import './skeleton.css';

// Placeholders for values the panel does not know yet. The rule both callers follow: keep
// whatever is already true on screen — a name, a slot title, a price from the bundled
// catalogue — and only stand in for what is still in flight. A zero balance or an "Empty"
// slot is a claim about the account, and neither panel has earned the right to make it yet.

/** Replace an element's content with a shimmer bar of the given size, named for screen readers. */
export function skeleton(element: HTMLElement, label: string, width: string, height = '13px') {
  element.replaceChildren(bar(width, height));
  element.setAttribute('aria-label', label);
}

/** The shimmer on its own, for callers that keep some real text beside it. */
export function bar(width: string, height = '13px') {
  const span = document.createElement('span');
  span.className = 'skel'; span.setAttribute('aria-hidden', 'true');
  span.style.setProperty('--skel-w', width); span.style.setProperty('--skel-h', height);
  return span;
}

/** Put a real value back, and drop the placeholder's stand-in name with it. */
export function settled(element: HTMLElement, text: string) {
  element.removeAttribute('aria-label');
  element.textContent = text;
}
