const search = document.querySelector('#doc-search');
const sections = [...document.querySelectorAll('.doc-section')];
const noResults = document.querySelector('#no-results');
const nav = document.querySelector('#doc-nav');
const menuButton = document.querySelector('#menu-button');

function filterGuide() {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  for (const section of sections) {
    const match = !term || section.textContent.toLowerCase().includes(term) || section.dataset.title.toLowerCase().includes(term);
    section.classList.toggle('is-hidden', !match);
    document.querySelector(`[data-nav="${section.id}"]`)?.toggleAttribute('hidden', !match);
    if (match) visible += 1;
  }
  document.querySelector('.path-callout')?.classList.toggle('is-hidden', Boolean(term));
  noResults.hidden = visible !== 0;
}

search?.addEventListener('input', filterGuide);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    search?.focus();
  }
  if (event.key === 'Escape') {
    search.value = '';
    filterGuide();
    nav.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }
});

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const source = document.querySelector(`#${button.dataset.copy}`);
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source.textContent);
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 1400);
    } catch {
      button.textContent = 'Select text';
    }
  });
}

menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
});
nav?.addEventListener('click', event => {
  if (event.target.closest('a')) {
    nav.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }
});

const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  for (const link of document.querySelectorAll('[data-nav]')) {
    link.toggleAttribute('aria-current', link.dataset.nav === visible.target.id);
  }
}, { rootMargin: '-18% 0px -66% 0px', threshold: [0, .15, .4] });
sections.forEach(section => observer.observe(section));

const checklist = document.querySelector('#final-checklist');
function updateProgress() {
  const checked = checklist?.querySelectorAll('input:checked').length ?? 0;
  document.querySelector('#completed-count').textContent = String(checked);
  document.querySelector('#setup-progress').value = checked;
}
checklist?.addEventListener('change', updateProgress);
document.querySelector('#print-guide')?.addEventListener('click', () => window.print());
updateProgress();
