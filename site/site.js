const brandFace = document.querySelector('.brand-face');

if (brandFace) {
  const pupils = brandFace.querySelectorAll('.brand-eye > span');
  const canTrack = matchMedia('(any-pointer: fine) and (prefers-reduced-motion: no-preference)');
  let frame;
  let pointerX;
  let pointerY;

  function followPointer() {
    frame = undefined;
    const { left, top, width, height } = brandFace.getBoundingClientRect();
    const x = pointerX - (left + width / 2);
    const y = pointerY - (top + height / 2);
    const distance = Math.max(20, Math.hypot(x, y));
    const offset = `${x / distance * width * .095}px ${y / distance * height * .115}px`;

    pupils.forEach((pupil) => {
      pupil.style.translate = offset;
    });
  }

  function resetGaze() {
    cancelAnimationFrame(frame);
    frame = undefined;
    pupils.forEach((pupil) => {
      pupil.style.removeProperty('translate');
    });
  }

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !canTrack.matches) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    frame ??= requestAnimationFrame(followPointer);
  }, { passive: true });

  document.addEventListener('pointerleave', resetGaze);
  window.addEventListener('blur', resetGaze);
  canTrack.addEventListener('change', resetGaze);
}

const nav = document.querySelector('#navigation');
const menu = document.querySelector('.menu-toggle');

if (nav && menu) {
  const mobile = window.matchMedia('(max-width: 960px)');

  function closeMenu() {
    menu.setAttribute('aria-expanded', 'false');
  }

  function updateMenu() {
    menu.hidden = !mobile.matches;
    closeMenu();
  }

  updateMenu();
  mobile.addEventListener('change', updateMenu);
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
}

const filters = document.querySelector('.filters');
if (filters) {
  const buttons = Array.from(filters.querySelectorAll('button'));
  const reviews = Array.from(document.querySelectorAll('[data-review]'));

  function selectReviews(filter) {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button === filter)));
    reviews.forEach((review) => {
      review.hidden = filter.dataset.filter !== 'all' && review.dataset.review !== filter.dataset.filter;
    });
  }

  const branch = new URLSearchParams(location.search).get('branch');
  const initialFilter = buttons.find((button) => button.dataset.filter === branch);
  if (initialFilter) selectReviews(initialFilter);

  filters.hidden = false;
  filters.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-filter]');
    if (filter) selectReviews(filter);
  });
}

function connectDialog(dialog, triggers, prepare) {
  if (typeof dialog?.showModal !== 'function') return;

  document.querySelectorAll(triggers).forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      prepare(link);
      dialog.showModal();
    });
  });
}

const visitDialog = document.querySelector('#visit-dialog');
if (visitDialog) {
  const options = Array.from(visitDialog.querySelectorAll('input[name="branch"]'));
  const contacts = Array.from(visitDialog.querySelectorAll('[data-branch]'));

  function selectBranch(branch) {
    options.forEach((option) => { option.checked = option.value === branch; });
    contacts.forEach((contact) => { contact.hidden = contact.dataset.branch !== branch; });
  }

  visitDialog.addEventListener('change', (event) => {
    if (event.target.name === 'branch') selectBranch(event.target.value);
  });
  connectDialog(visitDialog, '[data-visit]', (link) => {
    if (link.dataset.visit) selectBranch(link.dataset.visit);
  });
}

const awardDialog = document.querySelector('#award-dialog');
connectDialog(awardDialog, '[data-award]', (link) => {
  const title = link.dataset.award || link.querySelector('strong').textContent;
  const image = awardDialog.querySelector('img');
  awardDialog.querySelector('h2').textContent = title;
  image.alt = title;
  image.src = link.href;
});

const videoDialog = document.querySelector('#video-dialog');
if (videoDialog) {
  const video = videoDialog.querySelector('video');
  const error = videoDialog.querySelector('.video-error');
  connectDialog(videoDialog, '[data-video]', (link) => {
    videoDialog.querySelector('h2').textContent = link.dataset.video;
    error.hidden = true;
    error.querySelector('a').href = link.href;
    video.poster = link.querySelector('img').src;
    video.src = link.href;
    video.play().catch(() => {});
  });
  video.addEventListener('error', () => { error.hidden = false; });
  videoDialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
  });
}

function showAnchor(hash) {
  if (!hash) return;
  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  let disclosure = target.closest('details');
  if (!disclosure) return;
  while (disclosure) {
    disclosure.open = true;
    disclosure = disclosure.parentElement.closest('details');
  }
  requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

if (document.querySelector('.disclosures')) {
  showAnchor(location.hash);
  window.addEventListener('hashchange', () => showAnchor(location.hash));
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link?.hash === location.hash) showAnchor(link.hash);
  });
}

const documentSearch = document.querySelector('[data-doc-search]');
if (documentSearch) {
  const input = documentSearch.querySelector('input');
  const count = documentSearch.querySelector('.search-count');
  const results = documentSearch.querySelector('ul');
  const normalize = (value) => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const documents = new Map();

  document.querySelectorAll('.disclosures a[data-document]').forEach((link) => {
    if (!documents.has(link.href) && link.textContent.trim()) {
      documents.set(link.href, link.textContent.trim());
    }
  });

  documentSearch.hidden = false;
  input.addEventListener('input', () => {
    const query = normalize(input.value);
    results.replaceChildren();
    count.textContent = '';
    if (query.length < 2) return;

    const words = query.split(/\s+/);
    const matches = [...documents].filter(([, name]) => words.every((word) => normalize(name).includes(word)));
    count.textContent = matches.length ? `Найдено документов — ${matches.length}` : 'Документы с таким названием не найдены.';

    matches.forEach(([href, name]) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener';
      link.dataset.document = '';
      link.textContent = name;
      item.append(link);
      results.append(item);
    });
  });
}
