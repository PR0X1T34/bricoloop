// BricoLoop : interface web, une page par onglet (US-09 et suivantes)
import { formatError, statusLabel, plural, ratingText } from './ui.js';

// US-10 : catégories autorisées (énoncé, section 3)
const CATEGORIES = ['Perçage', 'Jardinage', 'Peinture', 'Nettoyage', 'Mesure', 'Autre'];
const TOKEN_KEY = 'bricoloop.token';
const REFRESH_MS = 5000;
const MAX_PHOTOS = 4;
const PRIVATE_PAGES = ['demandes', 'mes-outils', 'notifications', 'compte', 'proposer', 'modifier'];

const state = { token: readToken(), user: null, route: { page: 'catalogue' }, tools: [], unread: 0 };

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'),
  profile: $('profile'),
  unread: $('unread'),
  message: $('message'),
  search: $('search'),
  category: $('category'),
  district: $('district'),
  sort: $('sort'),
  onlyAvailable: $('only-available'),
  catalogue: $('catalogue'),
  catalogueCount: $('catalogue-count'),
  detail: $('detail'),
  editTool: $('edit-tool'),
  newTool: $('new-tool'),
  newToolPreview: $('new-tool-preview'),
  myTools: $('my-tools'),
  mine: $('mine'),
  notifList: $('notif-list'),
  markRead: $('mark-read'),
  accountPage: $('account-page'),
  loginForm: $('login-form'),
  registerForm: $('register-form'),
  tabLogin: $('tab-login'),
  tabRegister: $('tab-register'),
};

// ---------- Outils communs ----------

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function saveToken(token) {
  state.token = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // stockage indisponible (navigation privée) : la session dure le temps de la page
  }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && state.user) signedOut();
    throw new Error(formatError(res.status, body));
  }
  return body;
}

function showMessage(text, type = 'success') {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  els.message.hidden = false;
  clearTimeout(showMessage.timer);
  if (type === 'success') showMessage.timer = setTimeout(() => { els.message.hidden = true; }, 6000);
}
const showError = (err) => showMessage(err.message, 'error');

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(text, href, className) {
  const a = el('a', text, className);
  a.href = href;
  return a;
}

function button(text, onClick, className) {
  const b = el('button', text, className);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function img(src, alt, className) {
  const i = el('img', undefined, className);
  i.src = src;
  i.alt = alt;
  i.loading = 'lazy';
  return i;
}

function placeholder(name, className = 'thumb placeholder') {
  const p = el('div', name.slice(0, 1).toUpperCase(), className);
  p.setAttribute('aria-hidden', 'true');
  return p;
}

const toolHref = (id) => `#/outil/${encodeURIComponent(id)}`;
const isoDate = (d) => d.toISOString().slice(0, 10);
function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
const frDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const period = (l) => `du ${frDate(l.startDate)} au ${frDate(l.endDate)}`;

function fillCategories(select) {
  for (const c of CATEGORIES) {
    const option = el('option', c);
    option.value = c;
    select.append(option);
  }
}

function stat(value, label) {
  const box = el('div', undefined, 'stat');
  box.append(el('b', String(value)), el('span', label));
  return box;
}

// US-17 : réduit la photo dans le navigateur avant l'envoi (1280 px, JPEG)
async function imageToDataUrl(file, max = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

async function uploadPhotos(toolId, files, already = 0) {
  const list = [...files].slice(0, Math.max(0, MAX_PHOTOS - already));
  for (const file of list) {
    const dataUrl = await imageToDataUrl(file);
    await api(`/api/tools/${encodeURIComponent(toolId)}/photos`, { method: 'POST', body: JSON.stringify({ dataUrl }) });
  }
  return list.length;
}

function previewFiles(input, box) {
  box.replaceChildren();
  for (const file of [...input.files].slice(0, MAX_PHOTOS)) {
    box.append(img(URL.createObjectURL(file), file.name));
  }
}

async function post(path, okText, body) {
  try {
    await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    showMessage(okText);
    await render();
  } catch (err) {
    showError(err);
  }
}

// ---------- Navigation : une page par onglet ----------

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: 'catalogue' };
  if (parts[0] === 'outil' && parts[1]) return { page: parts[2] === 'modifier' ? 'modifier' : 'outil', id: parts[1] };
  const known = ['demandes', 'mes-outils', 'notifications', 'compte', 'connexion', 'proposer', 'inscription'];
  if (parts[0] === 'inscription') return { page: 'connexion', mode: 'register' };
  return known.includes(parts[0]) ? { page: parts[0] } : { page: 'introuvable' };
}

async function render() {
  const route = parseRoute();
  if (PRIVATE_PAGES.includes(route.page) && !state.user) {
    sessionStorageSet('after-login', location.hash);
    location.hash = '#/connexion';
    return;
  }
  if (route.page === 'connexion' && state.user) {
    location.hash = '#/';
    return;
  }
  const changed = route.page !== state.route.page || route.id !== state.route.id;
  state.route = route;
  for (const section of document.querySelectorAll('[data-page]')) section.hidden = section.dataset.page !== route.page;
  for (const a of document.querySelectorAll('[data-nav]')) a.classList.toggle('active', a.dataset.nav === route.page);
  for (const a of document.querySelectorAll('[data-auth]')) a.hidden = !state.user;
  renderAccount();
  if (changed) {
    els.message.hidden = true;
    window.scrollTo(0, 0);
  }
  try {
    const pages = {
      catalogue: loadCatalogue,
      outil: () => loadToolPage(route.id),
      modifier: () => loadEditPage(route.id),
      'mes-outils': loadMyTools,
      demandes: loadMine,
      notifications: loadNotifications,
      compte: loadAccountPage,
      connexion: () => openAuth(route.mode ?? 'login'),
      proposer: async () => {},
      introuvable: async () => {},
    };
    await pages[route.page]();
    if (state.user && route.page !== 'notifications') await refreshUnread();
  } catch (err) {
    showError(err);
  }
}

function sessionStorageSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // indisponible : on revient simplement au catalogue
  }
}

function sessionStorageTake(key) {
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

window.addEventListener('hashchange', render);

// ---------- US-18 : compte et connexion ----------

function renderAccount() {
  els.profile.replaceChildren();
  if (state.user) {
    els.profile.append(link(`${state.user.firstName} · ${state.user.district}`, '#/compte'));
  } else {
    els.profile.append(link('Se connecter', '#/connexion', 'cta'));
  }
}

function openAuth(mode) {
  const login = mode === 'login';
  els.tabLogin.setAttribute('aria-selected', String(login));
  els.tabRegister.setAttribute('aria-selected', String(!login));
  els.loginForm.hidden = !login;
  els.registerForm.hidden = login;
  (login ? els.loginForm : els.registerForm).querySelector('input').focus();
}

async function signedIn({ token, user }) {
  saveToken(token);
  state.user = user;
  location.hash = sessionStorageTake('after-login') || '#/';
  await render();
}

function signedOut() {
  saveToken('');
  state.user = null;
  state.unread = 0;
  document.title = 'BricoLoop';
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // déjà déconnecté côté serveur
  }
  signedOut();
  location.hash = '#/';
  await render();
  showMessage('Tu es déconnecté.');
}

const formValues = (form) => Object.fromEntries(new FormData(form).entries());

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(formValues(els.loginForm)) });
    els.loginForm.reset();
    await signedIn(result);
    showMessage(`Bienvenue ${result.user.firstName} !`);
  } catch (err) {
    showError(err);
  }
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(formValues(els.registerForm)) });
    els.registerForm.reset();
    await signedIn(result);
    showMessage(`Compte créé. Bienvenue ${result.user.firstName} !`);
  } catch (err) {
    showError(err);
  }
});

els.tabLogin.addEventListener('click', () => openAuth('login'));
els.tabRegister.addEventListener('click', () => openAuth('register'));

// ---------- US-01, US-10, US-11 : catalogue ----------

async function loadCatalogue() {
  const params = new URLSearchParams();
  if (els.category.value) params.set('category', els.category.value);
  if (els.search.value.trim()) params.set('q', els.search.value.trim());
  const tools = params.size
    ? await api(`/api/tools?${params}`)
    : await api('/api/tools');
  if (!params.size) state.tools = tools;
  fillDistricts(state.tools.length ? state.tools : tools);
  renderCatalogue(tools);
}

function fillDistricts(tools) {
  const current = els.district.value;
  const districts = [...new Set(tools.map((t) => t.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  els.district.replaceChildren(new Option('Tous les quartiers', ''), ...districts.map((d) => new Option(d, d)));
  els.district.value = districts.includes(current) ? current : '';
}

function renderCatalogue(all) {
  let tools = all;
  if (els.district.value) tools = tools.filter((t) => t.district === els.district.value);
  if (els.onlyAvailable.checked) tools = tools.filter((t) => t.status === 'available');
  if (els.sort.value === 'name') tools = [...tools].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (els.sort.value === 'recent') tools = [...tools].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || b.id.localeCompare(a.id, 'fr', { numeric: true }));
  els.catalogueCount.textContent = `${plural(tools.length, 'outil')} · ${plural(tools.filter((t) => t.status === 'available').length, 'disponible')}`;
  els.catalogue.replaceChildren();
  if (tools.length === 0) {
    els.catalogue.append(el('li', 'Aucun outil ne correspond à ta recherche.', 'empty'));
    return;
  }
  for (const tool of tools) {
    const card = link('', toolHref(tool.id), 'card');
    card.append(tool.photo ? img(tool.photo, tool.name, 'thumb') : placeholder(tool.name));
    const body = el('span', undefined, 'card-body');
    body.append(el('span', tool.name, 'tool-name'), el('span', [tool.category, tool.district].filter(Boolean).join(' · '), 'meta'));
    body.append(el('span', statusLabel(tool.status), `badge ${tool.status}`));
    card.append(body);
    const li = el('li');
    li.append(card);
    els.catalogue.append(li);
  }
}

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadCatalogue().catch(showError), 250);
});
els.category.addEventListener('change', () => loadCatalogue().catch(showError));
for (const input of [els.district, els.sort, els.onlyAvailable]) input.addEventListener('change', () => loadCatalogue().catch(showError));

// ---------- Page d'un outil : état, réservations, historique (US-03, US-04, US-14, US-20) ----------

async function loadToolPage(id) {
  const tool = await api(`/api/tools/${encodeURIComponent(id)}`);
  document.title = `${tool.name} · BricoLoop`;
  els.detail.replaceChildren();
  const page = el('div', undefined, 'tool-page');
  page.append(gallery(tool));

  const side = el('div', undefined, 'side');
  const head = el('div', undefined, 'panel');
  const titleRow = el('div', undefined, 'title-row');
  titleRow.append(el('h1', tool.name), el('span', statusLabel(tool.status), `badge ${tool.status}`));
  head.append(titleRow);
  const info = el('dl');
  const owner = tool.owner ? `${tool.owner.firstName}, quartier ${tool.owner.district}` : 'Inconnu';
  for (const [label, value] of [
    ['Catégorie', tool.category],
    ['Description', tool.description || '—'],
    ['Propriétaire', owner],
    ['En ligne depuis', tool.createdAt ? frDate(tool.createdAt.slice(0, 10)) : 'le lancement de BricoLoop'],
  ]) {
    info.append(el('dt', label), el('dd', value));
  }
  head.append(info);
  side.append(head);

  const isOwner = state.user && tool.ownerId === state.user.id;
  side.append(isOwner ? ownerActions(tool) : borrowBox(tool));
  page.append(side);
  els.detail.append(page);

  // État d'usage et réservations
  const usage = el('section', undefined, 'panel');
  usage.append(el('h2', "État et utilisation"));
  const stats = el('div', undefined, 'stats');
  const a = tool.activity;
  stats.append(
    stat(a.timesLent, a.timesLent > 1 ? 'prêts au total' : 'prêt au total'),
    stat(a.timesReturned, a.timesReturned > 1 ? 'retours' : 'retour'),
    stat(a.pendingRequests, 'en attente'),
    stat(a.lastReturnedOn ? frDate(a.lastReturnedOn) : '—', 'dernier retour'),
  );
  usage.append(stats);
  usage.append(el('h3', 'Réservations à venir'));
  if (a.bookings.length === 0) usage.append(el('p', 'Aucune réservation : l\'outil est libre sur les deux prochains mois.', 'muted'));
  else {
    const ul = el('ul', undefined, 'sub');
    for (const b of a.bookings) ul.append(el('li', `Réservé ${period(b)}`));
    usage.append(ul);
  }
  usage.append(calendars(a.bookings));
  els.detail.append(usage);

  // US-14 : historique détaillé, visible par le propriétaire seulement
  if (isOwner) {
    const hist = el('section', undefined, 'panel');
    hist.append(el('h2', 'Historique des prêts'));
    const list = el('ul', undefined, 'sub');
    hist.append(list);
    els.detail.append(hist);
    await fillHistory(tool.id, list);
  }
}

function gallery(tool) {
  const box = el('div', undefined, 'gallery');
  if (tool.photos.length === 0) {
    box.append(placeholder(tool.name, 'thumb placeholder main'));
    return box;
  }
  const main = img(tool.photos[0].url, tool.name, 'main');
  box.append(main);
  if (tool.photos.length > 1) {
    const strip = el('div', undefined, 'strip');
    tool.photos.forEach((photo, i) => {
      const b = button('', () => {
        main.src = photo.url;
        strip.querySelectorAll('button').forEach((x) => x.removeAttribute('aria-current'));
        b.setAttribute('aria-current', 'true');
      });
      b.setAttribute('aria-label', `Photo ${i + 1}`);
      if (i === 0) b.setAttribute('aria-current', 'true');
      b.append(img(photo.url, ''));
      strip.append(b);
    });
    box.append(strip);
  }
  return box;
}

// Deux mois de calendrier, jours réservés surlignés
function calendars(bookings) {
  const wrap = el('div');
  const legend = el('p', undefined, 'legend');
  legend.innerHTML = '<span><i></i>Réservé</span>';
  const box = el('div', undefined, 'calendars');
  const today = isoDate(new Date());
  const booked = (iso) => bookings.some((b) => b.startDate <= iso && iso <= b.endDate);
  const first = new Date();
  first.setDate(1);
  for (let m = 0; m < 2; m += 1) {
    const month = new Date(first.getFullYear(), first.getMonth() + m, 1);
    const cal = el('div', undefined, 'cal');
    cal.append(el('h3', month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })));
    const grid = el('div', undefined, 'cal-grid');
    for (const d of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) grid.append(el('span', d, 'dow'));
    const offset = (month.getDay() + 6) % 7;
    for (let i = 0; i < offset; i += 1) grid.append(el('span'));
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day += 1) {
      const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const classes = ['day'];
      if (iso < today) classes.push('past');
      if (iso === today) classes.push('today');
      if (booked(iso)) classes.push('booked');
      const cell = el('span', String(day), classes.join(' '));
      if (booked(iso)) cell.title = 'Réservé';
      grid.append(cell);
    }
    cal.append(grid);
    box.append(cal);
  }
  wrap.append(legend, box);
  return wrap;
}

function borrowBox(tool) {
  const box = el('div', undefined, 'panel');
  if (!state.user) {
    box.append(el('h2', "Emprunter cet outil"));
    const p = el('p', undefined, 'notice');
    p.append('Pour envoyer une demande, ', link('connecte-toi', '#/connexion'), ' ou ', link('crée un compte', '#/inscription'), '.');
    sessionStorageSet('after-login', location.hash);
    box.append(p);
    return box;
  }
  if (tool.status === 'unavailable') {
    box.append(el('h2', 'Emprunter cet outil'), el('p', 'Le propriétaire a rendu cet outil indisponible pour le moment.', 'notice'));
    return box;
  }
  const form = el('form', undefined, 'stack');
  form.noValidate = true;
  form.innerHTML = `
    <h2>Demander l'emprunt</h2>
    <div class="dates">
      <label>Du <input type="date" name="startDate" required></label>
      <label>Au <input type="date" name="endDate" required></label>
    </div>
    <label>Un mot pour le propriétaire (facultatif)
      <textarea name="message" maxlength="300" rows="2" placeholder="Pour quoi faire, quand passer le chercher…"></textarea>
    </label>
    <p class="hint js-duration"></p>
    <button type="submit" class="primary">Envoyer la demande</button>`;
  form.startDate.value = dayOffset(1);
  form.endDate.value = dayOffset(3);
  form.startDate.min = dayOffset(0);
  form.endDate.min = dayOffset(0);
  const duration = form.querySelector('.js-duration');
  const updateDuration = () => {
    const days = Math.round((Date.parse(form.endDate.value) - Date.parse(form.startDate.value)) / 86400000) + 1;
    const clash = tool.activity.bookings.some((b) => form.startDate.value <= b.endDate && b.startDate <= form.endDate.value);
    duration.textContent = Number.isNaN(days) || days < 1 ? 'La date de fin doit suivre la date de début.' : `${plural(days, 'jour')}${clash ? ' · attention, ces dates chevauchent une réservation' : ''}`;
  };
  form.startDate.addEventListener('change', () => {
    if (form.endDate.value < form.startDate.value) form.endDate.value = form.startDate.value;
    form.endDate.min = form.startDate.value;
    updateDuration();
  });
  form.endDate.addEventListener('change', updateDuration);
  updateDuration();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const loan = await api('/api/loans', {
        method: 'POST',
        body: JSON.stringify({ toolId: tool.id, startDate: form.startDate.value, endDate: form.endDate.value, message: form.message.value }),
      });
      showMessage(`Demande envoyée pour « ${tool.name} » ${period(loan)}. ${tool.owner?.firstName ?? 'Le propriétaire'} a reçu ta demande.`);
      form.reset();
      await render();
    } catch (err) {
      showError(err);
    }
  });
  box.append(form);
  return box;
}

function ownerActions(tool) {
  const box = el('div', undefined, 'panel stack');
  box.append(el('h2', "C'est ton outil"));
  const actions = el('div', undefined, 'row-actions');
  actions.append(link('Modifier', `${toolHref(tool.id)}/modifier`, 'button primary'), button('Supprimer', () => removeTool(tool), 'danger'));
  if (tool.status !== 'lent') {
    const next = tool.status === 'available' ? 'unavailable' : 'available';
    actions.append(button(next === 'unavailable' ? 'Rendre indisponible' : 'Rendre disponible', async () => {
      try {
        await api(`/api/tools/${encodeURIComponent(tool.id)}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
        showMessage(next === 'available' ? 'Ton outil est de nouveau disponible.' : 'Ton outil est indisponible : personne ne peut le demander.');
        await render();
      } catch (err) {
        showError(err);
      }
    }));
  }
  box.append(actions, shareButton());
  return box;
}

function shareButton() {
  return button('Copier le lien de cette page', async (event) => {
    try {
      await navigator.clipboard.writeText(location.href);
      event.target.textContent = 'Lien copié';
    } catch {
      showMessage(`Lien de la page : ${location.href}`);
    }
  }, 'link-btn');
}

// US-14 : historique des prêts, US-13 : noter l'emprunteur après le retour
async function fillHistory(toolId, list) {
  const loans = await api(`/api/tools/${encodeURIComponent(toolId)}/history`);
  list.replaceChildren();
  if (loans.length === 0) list.append(el('li', 'Aucun prêt pour le moment.', 'muted'));
  for (const l of loans) {
    const row = el('li');
    row.append(el('span', `${l.borrower?.firstName ?? '?'} · ${period(l)}`));
    const right = el('div', undefined, 'row-actions');
    right.append(el('span', statusLabel(l.status), `badge ${l.status}`));
    if (l.rating) {
      right.append(el('span', `Noté ${l.rating}/5`, 'stars'));
    } else if (l.status === 'returned') {
      const select = el('select');
      select.setAttribute('aria-label', 'Note de 1 à 5');
      for (const s of [5, 4, 3, 2, 1]) select.append(new Option(`${s}/5`, String(s)));
      right.append(select, button('Noter', () => post(`/api/loans/${l.id}/rating`, 'Merci, la note est enregistrée.', { score: Number(select.value) })));
    }
    row.append(right);
    list.append(row);
  }
}

// ---------- Modifier un outil (US-16, US-17) ----------

async function loadEditPage(id) {
  const tool = await api(`/api/tools/${encodeURIComponent(id)}`);
  if (tool.ownerId !== state.user.id) {
    els.editTool.replaceChildren(el('p', 'Seul le propriétaire peut modifier cet outil.', 'notice'));
    return;
  }
  document.title = `Modifier ${tool.name} · BricoLoop`;
  const form = el('form', undefined, 'stack panel');
  form.noValidate = true;
  form.innerHTML = `
    <h1>Modifier « <span class="js-name"></span> »</h1>
    <div class="row">
      <label>Nom <input name="name" required minlength="2" maxlength="60"></label>
      <label>Catégorie <select name="category"></select></label>
    </div>
    <label>Description <textarea name="description" maxlength="300" rows="3"></textarea></label>
    <label class="js-status">Disponibilité
      <select name="status">
        <option value="available">Disponible</option>
        <option value="unavailable">Indisponible (je le garde pour l'instant)</option>
      </select>
    </label>
    <div><strong>Photos</strong> <span class="muted">(${MAX_PHOTOS} maximum, la première sert de vignette)</span></div>
    <div class="photo-edit"></div>
    <label>Ajouter des photos <input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label>
    <div class="preview"></div>
    <div class="row-actions">
      <button type="submit" class="primary">Enregistrer</button>
      <a class="button" href="${toolHref(tool.id)}">Annuler</a>
      <button type="button" class="danger js-delete">Supprimer l'outil</button>
    </div>`;
  form.querySelector('.js-name').textContent = tool.name;
  fillCategories(form.category);
  form.name.value = tool.name;
  form.category.value = tool.category;
  form.description.value = tool.description;
  if (tool.status === 'lent') form.querySelector('.js-status').hidden = true;
  else form.status.value = tool.status;
  form.photos.addEventListener('change', () => previewFiles(form.photos, form.querySelector('.preview')));
  form.querySelector('.js-delete').addEventListener('click', () => removeTool(tool));

  const photos = form.querySelector('.photo-edit');
  let photoCount = tool.photos.length;
  if (photoCount === 0) photos.append(el('span', 'Aucune photo pour le moment.', 'muted'));
  for (const photo of tool.photos) {
    const fig = el('figure');
    fig.append(img(photo.url, `Photo de ${tool.name}`));
    const del = button('×', async () => {
      try {
        await api(`/api/tools/${tool.id}/photos/${photo.id}`, { method: 'DELETE' });
        fig.remove();
        photoCount -= 1;
        showMessage('Photo supprimée.');
      } catch (err) {
        showError(err);
      }
    });
    del.setAttribute('aria-label', 'Supprimer cette photo');
    fig.append(del);
    photos.append(fig);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      const body = { name: form.name.value, category: form.category.value, description: form.description.value };
      if (tool.status !== 'lent') body.status = form.status.value;
      await api(`/api/tools/${tool.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      const added = form.photos.files.length ? await uploadPhotos(tool.id, form.photos.files, photoCount) : 0;
      location.hash = toolHref(tool.id);
      showMessage(added ? `Modifications enregistrées, ${plural(added, 'photo')} ajoutée${added > 1 ? 's' : ''}.` : 'Modifications enregistrées.');
    } catch (err) {
      showError(err);
      submit.disabled = false;
    }
  });
  els.editTool.replaceChildren(form);
}

// US-16 : supprimer un outil (confirmation)
async function removeTool(tool) {
  if (!window.confirm(`Retirer « ${tool.name} » du prêt ? Les demandes en attente seront annulées.`)) return;
  try {
    await api(`/api/tools/${encodeURIComponent(tool.id)}`, { method: 'DELETE' });
    location.hash = '#/mes-outils';
    showMessage(`« ${tool.name} » a été retiré du prêt.`);
    await render();
  } catch (err) {
    showError(err);
  }
}

// ---------- Proposer un outil (US-02, US-17) ----------

fillCategories(els.category);
fillCategories(els.newTool.category);
els.newTool.photos.addEventListener('change', () => previewFiles(els.newTool.photos, els.newToolPreview));
els.newTool.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = els.newTool.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const tool = await api('/api/tools', {
      method: 'POST',
      body: JSON.stringify({
        name: els.newTool.name.value,
        category: els.newTool.category.value,
        description: els.newTool.description.value,
      }),
    });
    if (els.newTool.photos.files.length) await uploadPhotos(tool.id, els.newTool.photos.files);
    els.newTool.reset();
    els.newToolPreview.replaceChildren();
    location.hash = toolHref(tool.id);
    showMessage(`« ${tool.name} » est maintenant proposé au prêt.`);
  } catch (err) {
    showError(err);
  } finally {
    submit.disabled = false;
  }
});

// ---------- Mes outils (US-12, US-13) ----------

async function loadMyTools() {
  const tools = await api('/api/tools/mine');
  els.myTools.replaceChildren();
  if (tools.length === 0) {
    const li = el('li', undefined, 'empty');
    li.append('Tu ne prêtes encore aucun outil. ', link('Proposer mon premier outil', '#/proposer'));
    els.myTools.append(li);
  }
  for (const tool of tools) {
    const li = el('li');
    const head = el('div', undefined, 'mt-head');
    head.append(tool.photos[0] ? img(tool.photos[0].url, '', 'mini') : placeholder(tool.name, 'mini placeholder'));
    head.append(link(tool.name, toolHref(tool.id), 'tool-name'), el('span', statusLabel(tool.status), `badge ${tool.status}`));
    const n = tool.pendingRequests;
    head.append(el('span', n === 0 ? 'Aucune demande en attente' : `${plural(n, 'demande')} en attente`, n ? 'mt-count hot' : 'mt-count'));
    li.append(head);

    const sub = el('ul', undefined, 'sub');
    for (const r of tool.requests) {
      const row = el('li');
      const who = el('div');
      who.append(el('strong', `${r.borrower?.firstName ?? '?'} (${r.borrower?.district ?? ''})`), ` ${period(r)} `, el('span', ratingText(r.borrower?.rating), 'stars'));
      if (r.message) who.append(el('p', `« ${r.message} »`, 'quote'));
      const actions = el('div', undefined, 'row-actions');
      actions.append(
        button('Accepter', () => post(`/api/loans/${r.id}/accept`, 'Demande acceptée.'), 'primary'),
        button('Refuser', () => post(`/api/loans/${r.id}/refuse`, 'Demande refusée.')),
      );
      row.append(who, actions);
      sub.append(row);
    }
    if (tool.currentLoan) {
      const c = tool.currentLoan;
      const row = el('li');
      row.append(el('span', `Prêté à ${c.borrower?.firstName ?? '?'} ${period(c)}`));
      row.append(button('Déclarer le retour', () => post(`/api/loans/${c.id}/return`, "Retour enregistré : l'outil est de nouveau disponible."), 'primary'));
      sub.append(row);
    }
    if (sub.childElementCount) li.append(sub);
    const actions = el('div', undefined, 'row-actions');
    actions.append(link('Voir la page', toolHref(tool.id), 'button'), link('Modifier', `${toolHref(tool.id)}/modifier`, 'button'), button('Supprimer', () => removeTool(tool), 'danger'));
    li.append(actions);
    els.myTools.append(li);
  }
}

// ---------- Mes demandes (US-08, US-20) ----------

async function loadMine() {
  const loans = await api('/api/loans/mine');
  els.mine.replaceChildren();
  if (loans.length === 0) {
    const p = el('p', undefined, 'empty');
    p.append("Tu n'as encore fait aucune demande. ", link('Parcourir le catalogue', '#/'));
    els.mine.append(p);
    return;
  }
  const today = isoDate(new Date());
  const groups = [
    ['En attente de réponse', loans.filter((l) => l.status === 'pending')],
    ['Acceptées et en cours', loans.filter((l) => l.status === 'accepted')],
    ['Terminées', loans.filter((l) => ['returned', 'refused', 'cancelled'].includes(l.status)).reverse()],
  ];
  for (const [title, items] of groups) {
    if (items.length === 0) continue;
    const group = el('section', undefined, 'group');
    group.append(el('h2', `${title} (${items.length})`));
    const ul = el('ul', undefined, 'list');
    for (const loan of items) {
      const li = el('li');
      const line = el('div', undefined, 'line');
      const name = loan.toolExists ? link(loan.toolName ?? loan.toolId, toolHref(loan.toolId), 'tool-name') : el('span', `${loan.toolName ?? loan.toolId} (retiré)`, 'tool-name');
      line.append(name, el('span', statusLabel(loan.status), `badge ${loan.status}`));
      li.append(line);
      const late = loan.status === 'accepted' && loan.endDate < today ? ' · retour prévu dépassé' : '';
      li.append(el('span', `${period(loan)}${loan.owner ? ` · chez ${loan.owner.firstName} (${loan.owner.district})` : ''}${late}`, 'time'));
      if (loan.message) li.append(el('p', `« ${loan.message} »`, 'quote'));
      if (loan.rating) li.append(el('span', `${loan.owner?.firstName ?? 'Le propriétaire'} t'a noté ${loan.rating}/5`, 'stars'));
      if (loan.status === 'pending') {
        li.append(button('Annuler ma demande', () => post(`/api/loans/${loan.id}/cancel`, 'Demande annulée.'), 'danger'));
      }
      ul.append(li);
    }
    group.append(ul);
    els.mine.append(group);
  }
}

// ---------- Notifications (US-15) ----------

async function refreshUnread() {
  const { unread } = await api('/api/notifications');
  setUnread(unread);
}

function setUnread(unread) {
  state.unread = unread;
  els.unread.textContent = String(unread);
  els.unread.className = unread > 0 ? 'count' : 'count zero';
  const base = state.route.page === 'outil' ? document.title.replace(/^\(\d+\) /, '') : 'BricoLoop';
  document.title = unread > 0 ? `(${unread}) ${base}` : base;
}

async function loadNotifications() {
  const { unread, items } = await api('/api/notifications');
  setUnread(unread);
  els.markRead.hidden = unread === 0;
  els.notifList.replaceChildren();
  if (items.length === 0) {
    els.notifList.append(el('li', "Aucune notification pour l'instant.", 'empty'));
    return;
  }
  for (const n of items.slice(0, 50)) {
    const li = el('li', undefined, n.read ? '' : 'unread');
    li.append(el('span', n.message));
    if (n.loanMessage && n.type === 'loan_requested') li.append(el('p', `« ${n.loanMessage} »`, 'quote'));
    const foot = el('div', undefined, 'line');
    foot.append(el('span', new Date(n.createdAt).toLocaleString('fr-FR'), 'time'));
    const actions = el('div', undefined, 'row-actions');
    if (n.type === 'loan_requested' && n.loanStatus === 'pending') {
      actions.append(
        button('Accepter', () => post(`/api/loans/${n.loanId}/accept`, 'Demande acceptée.'), 'primary'),
        button('Refuser', () => post(`/api/loans/${n.loanId}/refuse`, 'Demande refusée.')),
      );
    } else if (n.type === 'loan_requested' && n.loanStatus) {
      actions.append(el('span', statusLabel(n.loanStatus), `badge ${n.loanStatus}`));
    }
    actions.append(link("Voir l'outil", toolHref(n.toolId), 'button'));
    foot.append(actions);
    li.append(foot);
    els.notifList.append(li);
  }
}

els.markRead.addEventListener('click', () => post('/api/notifications/read', 'Notifications marquées comme lues.'));

// ---------- Mon compte (US-18, US-20) ----------

async function loadAccountPage() {
  const stats = await api('/api/auth/me/stats');
  const page = els.accountPage;
  page.replaceChildren();

  const summary = el('section', undefined, 'panel');
  summary.append(el('h2', `${state.user.firstName}, quartier ${state.user.district}`), el('p', state.user.email, 'muted'));
  const grid = el('div', undefined, 'stats');
  grid.append(
    stat(stats.tools, stats.tools > 1 ? 'outils prêtés' : 'outil prêté'),
    stat(stats.loansGiven, 'prêts accordés'),
    stat(stats.loansReceived, 'emprunts'),
    stat(stats.rating ? `${String(stats.rating.average).replace('.', ',')}/5` : '—', stats.rating ? `note moyenne (${plural(stats.rating.count, 'avis')})` : 'pas encore noté'),
  );
  summary.append(grid);
  if (stats.pendingReceived) summary.append(link(`${plural(stats.pendingReceived, 'demande')} à traiter`, '#/mes-outils'));
  page.append(summary);

  const profile = el('form', undefined, 'panel stack');
  profile.noValidate = true;
  profile.innerHTML = `
    <h2>Mon profil</h2>
    <div class="row">
      <label>Prénom <input name="firstName" required minlength="2" maxlength="40"></label>
      <label>Quartier <input name="district" required minlength="2" maxlength="40"></label>
    </div>
    <button type="submit" class="primary">Enregistrer</button>`;
  profile.firstName.value = state.user.firstName;
  profile.district.value = state.user.district;
  profile.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      state.user = await api('/api/auth/me', { method: 'PATCH', body: JSON.stringify(formValues(profile)) });
      showMessage('Profil mis à jour.');
      await render();
    } catch (err) {
      showError(err);
    }
  });
  page.append(profile);

  const password = el('form', undefined, 'panel stack');
  password.noValidate = true;
  password.innerHTML = `
    <h2>Changer de mot de passe</h2>
    <label>Mot de passe actuel <input type="password" name="currentPassword" autocomplete="current-password" required></label>
    <label>Nouveau mot de passe (8 caractères minimum) <input type="password" name="newPassword" autocomplete="new-password" required minlength="8"></label>
    <button type="submit" class="primary">Changer le mot de passe</button>
    <p class="hint">Tes autres appareils seront déconnectés.</p>`;
  password.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify(formValues(password)) });
      password.reset();
      showMessage('Mot de passe changé.');
    } catch (err) {
      showError(err);
    }
  });
  page.append(password);
  page.append(button('Se déconnecter', logout, 'danger'));
}

// ---------- Démarrage et rafraîchissement ----------

setInterval(() => {
  if (!state.user || document.hidden) return;
  const page = state.route.page;
  const refresh = page === 'notifications' ? loadNotifications : page === 'mes-outils' ? loadMyTools : refreshUnread;
  refresh().catch(() => {});
}, REFRESH_MS);

async function start() {
  if (state.token) {
    try {
      state.user = await api('/api/auth/me');
    } catch {
      saveToken('');
    }
  }
  await render();
}

start().catch(showError);
