import './social-skeleton.css';

export function fillSocialSkeleton(container: HTMLElement, count = 3) {
  const rows = Array.from({length: count}, (_, index) => {
    const row = document.createElement('li');
    row.className = 'social-skeleton-row';
    row.setAttribute('aria-hidden', 'true');
    row.style.setProperty('--skeleton-delay', `${index * 85}ms`);
    row.innerHTML = '<i class="social-skeleton-avatar"></i><span><i></i><i></i></span><i class="social-skeleton-action"></i>';
    return row;
  });
  container.replaceChildren(...rows);
}
