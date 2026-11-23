// BricoLoop : interface web (US-09 et suivantes)
import { formatError, statusLabel, plural, ratingText } from './ui.js';

// US-10 : catégories autorisées (énoncé, section 3)
const CATEGORIES = ['Perçage', 'Jardinage', 'Peinture', 'Nettoyage', 'Mesure', 'Autre'];
const TOKEN_KEY = 'bricoloop.token';
const REFRESH_MS = 5000;
const MAX_PHOTOS = 4;

const state = {
  token: readToken(),
  user: null,
  selectedToolId: null,
  category: '',
  search: '',
  editing: null,
  myToolsKey: '',
  openHistory: new Set(),
};

const $ = (id) => document.getElementById(id);
const els = {
  profile: $('profile'),
  navEspace: $('nav-espace'),
  bell: $('bell'),
  unread: $('unread'),
  message: $('message'),
  auth: $('auth'),
  loginForm: $('login-form'),
  registerForm: $('register-form'),
  tabLogin: $('tab-login'),
  tabRegister: $('tab-register'),
  search: $('search'),
  category: $('category'),
  catalogue: $('catalogue'),
  catalogueCount: $('catalogue-count'),
  detail: $('detail'),
  hint: $('detail-hint'),
  guestCta: $('guest-cta'),
  notifPanel: $('notifications'),
  notifList: $('notif-list'),
  markRead: $('mark-read'),
  myToolsPanel: $('my-tools-panel'),
  myTools: $('my-tools'),
  newTool: $('new-tool'),
  showNewTool: $('show-new-tool'),
  minePanel: $('mine-panel'),
  mine: $('mine'),
};

// ---------- Outils ----------

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
    if (res.status === 401 && state.user) await signedOut();
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

function placeholder(name) {
  const p = el('div', name.slice(0, 1).toUpperCase(), 'thumb placeholder');
  p.setAttribute('aria-hidden', 'true');
  return p;
}

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function fillCategories(select) {
  for (const c of CATEGORIES) {
    const option = el('option', c);
    option.value = c;
    select.append(option);
  }
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

async function uploadPhotos(toolId, files) {
  let sent = 0;
  for (const file of [...files].slice(0, MAX_PHOTOS)) {
    const dataUrl = await imageToDataUrl(file);
    await api(`/api/tools/${encodeURIComponent(toolId)}/photos`, { method: 'POST', body: JSON.stringify({ dataUrl }) });
    sent += 1;
  }
  return sent;
}

// ---------- US-18 : compte et connexion ----------

function renderAccount() {
  els.profile.replaceChildren();
  const logged = Boolean(state.user);
  els.navEspace.hidden = !logged;
  els.bell.hidden = !logged;
  els.guestCta.hidden = logged;
  els.notifPanel.hidden = !logged;
  els.myToolsPanel.hidden = !logged;
  els.minePanel.hidden = !logged;
  if (logged) {
    els.profile.append(el('span', `${state.user.firstName} (${state.user.district})`));
    els.profile.append(button('Se déconnecter', logout));
  } else {
    els.profile.append(button('Se connecter', () => openAuth('login'), 'primary'));
  }
}

function openAuth(mode) {
  const login = mode === 'login';
  els.tabLogin.setAttribute('aria-selected', String(login));
  els.tabRegister.setAttribute('aria-selected', String(!login));
  els.loginForm.hidden = !login;
  els.registerForm.hidden = login;
  els.auth.hidden = false;
  (login ? els.loginForm : els.registerForm).querySelector('input').focus();
}

function closeAuth() {
  els.auth.hidden = true;
}

async function signedIn({ token, user }) {
  saveToken(token);
  state.user = user;
  state.myToolsKey = '';
  closeAuth();
  renderAccount();
  await refreshAll();
}

async function signedOut() {
  saveToken('');
  state.user = null;
  state.editing = null;
  state.myToolsKey = '';
  renderAccount();
  if (state.selectedToolId) await openTool(state.selectedToolId).catch(() => {});
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // déjà déconnecté côté serveur
  }
  await signedOut();
  showMessage('Tu es déconnecté.');
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

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
$('auth-close').addEventListener('click', closeAuth);
$('cta-login').addEventListener('click', () => openAuth('login'));
els.auth.addEventListener('click', (event) => { if (event.target === els.auth) closeAuth(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !els.auth.hidden) closeAuth(); });

// ---------- US-01, US-10, US-11 : catalogue ----------

async function loadCatalogue() {
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.search) params.set('q', state.search);
  const tools = params.size
    ? await api(`/api/tools?${params}`)
    : await api('/api/tools');
  els.catalogue.replaceChildren();
  els.catalogueCount.textContent = plural(tools.length, 'outil');
  if (tools.length === 0) {
    const filtered = state.category || state.search;
    els.catalogue.append(el('li', filtered ? 'Aucun outil ne correspond à ta recherche' : 'Aucun outil pour le moment', 'empty'));
    return;
  }
  for (const tool of tools) {
    const card = el('button', undefined, 'card');
    card.type = 'button';
    card.append(tool.photo ? img(tool.photo, tool.name, 'thumb') : placeholder(tool.name));
    const body = el('span', undefined, 'card-body');
    body.append(el('span', tool.name, 'tool-name'), el('span', tool.category, 'tool-category'));
    body.append(el('span', statusLabel(tool.status), `badge ${tool.status}`));
    card.append(body);
    if (tool.id === state.selectedToolId) card.classList.add('selected');
    card.addEventListener('click', () => openTool(tool.id).catch(showError));
    const li = el('li');
    li.append(card);
    els.catalogue.append(li);
  }
}

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.search.value.trim();
    loadCatalogue().catch(showError);
  }, 250);
});
els.category.addEventListener('change', () => {
  state.category = els.category.value;
  loadCatalogue().catch(showError);
});

// ---------- US-03, US-04 : fiche et demande d'emprunt ----------

async function openTool(id) {
  state.selectedToolId = id;
  try {
    const tool = await api(`/api/tools/${encodeURIComponent(id)}`);
    renderDetail(tool);
  } catch (err) {
    state.selectedToolId = null;
    els.detail.hidden = true;
    els.hint.hidden = false;
    throw err;
  }
  await loadCatalogue();
}

function gallery(tool) {
  const box = el('div', undefined, 'gallery');
  if (tool.photos.length === 0) {
    box.append(placeholder(tool.name));
    return box;
  }
  const main = img(tool.photos[0].url, tool.name, 'main');
  box.append(main);
  if (tool.photos.length > 1) {
    const strip = el('div', undefined, 'strip');
    tool.photos.forEach((photo, i) => {
      const b = button('', () => { main.src = photo.url; });
      b.setAttribute('aria-label', `Photo ${i + 1}`);
      b.append(img(photo.url, ''));
      strip.append(b);
    });
    box.append(strip);
  }
  return box;
}

function renderDetail(tool) {
  els.detail.replaceChildren();
  els.detail.append(el('h2', tool.name), gallery(tool));
  els.detail.append(el('span', statusLabel(tool.status), `badge ${tool.status}`));

  const info = el('dl');
  const owner = tool.owner ? `${tool.owner.firstName}, quartier ${tool.owner.district}` : 'Inconnu';
  for (const [label, value] of [
    ['Catégorie', tool.category],
    ['Description', tool.description || '—'],
    ['Propriétaire', owner],
  ]) {
    info.append(el('dt', label), el('dd', value));
  }
  els.detail.append(info);

  if (!state.user) {
    const notice = el('p', undefined, 'notice');
    notice.append('Pour emprunter cet outil, ', button('connecte-toi', () => openAuth('login'), 'link-btn'), '.');
    els.detail.append(notice);
  } else if (tool.ownerId === state.user.id) {
    const notice = el('p', undefined, 'notice');
    notice.append("C'est ton outil. ", button('Le modifier', () => startEdit(tool.id), 'link-btn'));
    els.detail.append(notice);
  } else {
    els.detail.append(loanForm(tool));
  }
  els.detail.hidden = false;
  els.hint.hidden = true;
}

function loanForm(tool) {
  const form = el('form');
  form.innerHTML = `
    <h3>Demander l'emprunt</h3>
    <div class="dates">
      <label>Du <input type="date" name="startDate" required></label>
      <label>Au <input type="date" name="endDate" required></label>
    </div>
    <button type="submit" class="primary">Envoyer la demande</button>`;
  form.startDate.value = isoDate(1);
  form.endDate.value = isoDate(3);
  form.startDate.min = isoDate(0);
  form.endDate.min = isoDate(0);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const loan = await api('/api/loans', {
        method: 'POST',
        body: JSON.stringify({ toolId: tool.id, startDate: form.startDate.value, endDate: form.endDate.value }),
      });
      showMessage(`Demande envoyée pour « ${tool.name} » du ${loan.startDate} au ${loan.endDate}. Le propriétaire est prévenu.`);
      await loadMine();
    } catch (err) {
      showError(err);
    }
  });
  return form;
}

// ---------- US-08 : mes demandes ----------

async function loadMine() {
  els.mine.replaceChildren();
  if (!state.user) return;
  const loans = await api('/api/loans/mine');
  if (loans.length === 0) {
    els.mine.append(el('li', "Tu n'as encore fait aucune demande.", 'empty'));
    return;
  }
  for (const loan of loans) {
    const li = el('li');
    const line = el('div', undefined, 'line');
    line.append(el('span', loan.toolName ?? loan.toolId, 'tool-name'), el('span', statusLabel(loan.status), `badge ${loan.status}`));
    li.append(line, el('span', `du ${loan.startDate} au ${loan.endDate}`, 'time'));
    els.mine.append(li);
  }
}

// ---------- US-15 : notifications ----------

async function act(path, okText, body) {
  try {
    await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    showMessage(okText);
    await refreshAll();
  } catch (err) {
    showError(err);
  }
}

async function loadNotifications() {
  els.notifList.replaceChildren();
  if (!state.user) return;
  const { unread, items } = await api('/api/notifications');
  els.unread.textContent = String(unread);
  els.unread.className = unread > 0 ? 'count' : 'count zero';
  els.markRead.hidden = unread === 0;
  document.title = unread > 0 ? `(${unread}) BricoLoop` : 'BricoLoop';
  if (items.length === 0) {
    els.notifList.append(el('li', "Aucune notification pour l'instant.", 'empty'));
    return;
  }
  for (const n of items.slice(0, 20)) {
    const li = el('li', undefined, n.read ? '' : 'unread');
    li.append(el('span', n.message), el('span', new Date(n.createdAt).toLocaleString('fr-FR'), 'time'));
    if (n.type === 'loan_requested' && n.loanStatus === 'pending') {
      const actions = el('div', undefined, 'row-actions');
      actions.append(
        button('Accepter', () => act(`/api/loans/${n.loanId}/accept`, 'Demande acceptée.'), 'primary'),
        button('Refuser', () => act(`/api/loans/${n.loanId}/refuse`, 'Demande refusée.')),
      );
      li.append(actions);
    } else if (n.type === 'loan_requested' && n.loanStatus) {
      li.append(el('span', statusLabel(n.loanStatus), `badge ${n.loanStatus}`));
    }
    els.notifList.append(li);
  }
}

els.markRead.addEventListener('click', () => act('/api/notifications/read', 'Notifications marquées comme lues.'));

// ---------- US-12, US-13, US-14, US-16, US-17 : mes outils ----------

async function loadMyTools(force = false) {
  if (!state.user) {
    els.myTools.replaceChildren();
    return;
  }
  if (state.editing && !force) return; // ne pas effacer un formulaire en cours
  const tools = await api('/api/tools/mine');
  const key = JSON.stringify(tools);
  if (!force && key === state.myToolsKey) return;
  state.myToolsKey = key;
  els.myTools.replaceChildren();
  if (tools.length === 0) {
    els.myTools.append(el('li', 'Tu ne prêtes encore aucun outil. Clique sur « Proposer un outil ».', 'empty'));
  }
  for (const tool of tools) {
    els.myTools.append(state.editing === tool.id ? editItem(tool) : toolItem(tool));
  }
}

function toolItem(tool) {
  const li = el('li');
  li.dataset.toolId = tool.id;
  const head = el('div', undefined, 'mt-head');
  if (tool.photos[0]) head.append(img(tool.photos[0].url, '', 'mini'));
  head.append(el('span', tool.name, 'tool-name'), el('span', statusLabel(tool.status), `badge ${tool.status}`));
  const n = tool.pendingRequests;
  head.append(el('span', n === 0 ? 'Aucune demande en attente' : `${plural(n, 'demande')} en attente`, n ? 'mt-count hot' : 'mt-count'));
  li.append(head);

  const sub = el('ul', undefined, 'sub');
  for (const r of tool.requests) {
    const row = el('li');
    const who = el('span', `${r.borrower?.firstName ?? '?'} (${r.borrower?.district ?? ''}) · du ${r.startDate} au ${r.endDate} `);
    who.append(el('span', ratingText(r.borrower?.rating), 'stars'));
    const actions = el('div', undefined, 'row-actions');
    actions.append(
      button('Accepter', () => act(`/api/loans/${r.id}/accept`, 'Demande acceptée.'), 'primary'),
      button('Refuser', () => act(`/api/loans/${r.id}/refuse`, 'Demande refusée.')),
    );
    row.append(who, actions);
    sub.append(row);
  }
  if (tool.currentLoan) {
    const c = tool.currentLoan;
    const row = el('li');
    row.append(el('span', `Prêté à ${c.borrower?.firstName ?? '?'} du ${c.startDate} au ${c.endDate}`));
    row.append(button('Déclarer le retour', () => act(`/api/loans/${c.id}/return`, "Retour enregistré : l'outil est de nouveau disponible."), 'primary'));
    sub.append(row);
  }
  if (sub.childElementCount) li.append(sub);

  const actions = el('div', undefined, 'row-actions');
  const history = el('ul', undefined, 'sub');
  history.hidden = true;
  actions.append(
    button('Modifier', () => startEdit(tool.id)),
    button('Supprimer', () => removeTool(tool), 'danger'),
    button("Historique des prêts", () => toggleHistory(tool.id, history), 'link-btn'),
  );
  li.append(actions, history);
  if (state.openHistory.has(tool.id)) toggleHistory(tool.id, history, true);
  return li;
}

// US-16 : formulaire de modification (nom, catégorie, description, disponibilité, photos)
function editItem(tool) {
  const li = el('li');
  const form = el('form', undefined, 'stack');
  form.noValidate = true;
  form.innerHTML = `
    <h3>Modifier « <span class="js-name"></span> »</h3>
    <div class="row">
      <label>Nom <input name="name" required minlength="2" maxlength="60"></label>
      <label>Catégorie <select name="category"></select></label>
    </div>
    <label>Description <textarea name="description" maxlength="300" rows="2"></textarea></label>
    <label class="js-status">Disponibilité
      <select name="status">
        <option value="available">Disponible</option>
        <option value="unavailable">Indisponible (je le garde pour l'instant)</option>
      </select>
    </label>
    <div><strong>Photos</strong> <span class="muted">(${MAX_PHOTOS} maximum)</span></div>
    <div class="photo-edit"></div>
    <label>Ajouter des photos <input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label>
    <div class="row-actions">
      <button type="submit" class="primary">Enregistrer</button>
      <button type="button" class="js-cancel">Annuler</button>
    </div>`;
  form.querySelector('.js-name').textContent = tool.name;
  fillCategories(form.category);
  form.name.value = tool.name;
  form.category.value = tool.category;
  form.description.value = tool.description;
  if (tool.status === 'lent') form.querySelector('.js-status').hidden = true;
  else form.status.value = tool.status;

  const photos = form.querySelector('.photo-edit');
  if (tool.photos.length === 0) photos.append(el('span', 'Aucune photo pour le moment.', 'muted'));
  for (const photo of tool.photos) {
    const fig = el('figure');
    fig.append(img(photo.url, `Photo de ${tool.name}`));
    const del = button('×', async () => {
      try {
        await api(`/api/tools/${tool.id}/photos/${photo.id}`, { method: 'DELETE' });
        fig.remove();
        showMessage('Photo supprimée.');
      } catch (err) {
        showError(err);
      }
    });
    del.setAttribute('aria-label', 'Supprimer cette photo');
    fig.append(del);
    photos.append(fig);
  }

  form.querySelector('.js-cancel').addEventListener('click', () => stopEdit());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      const body = { name: form.name.value, category: form.category.value, description: form.description.value };
      if (tool.status !== 'lent') body.status = form.status.value;
      await api(`/api/tools/${tool.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      const added = form.photos.files.length ? await uploadPhotos(tool.id, form.photos.files) : 0;
      showMessage(added ? `Modifications enregistrées, ${plural(added, 'photo')} ajoutée${added > 1 ? 's' : ''}.` : 'Modifications enregistrées.');
      await stopEdit();
    } catch (err) {
      showError(err);
      submit.disabled = false;
    }
  });
  li.append(form);
  return li;
}

async function startEdit(toolId) {
  state.editing = toolId;
  await loadMyTools(true).catch(showError);
  els.myTools.querySelector('form')?.scrollIntoView({ block: 'center' });
}

async function stopEdit() {
  state.editing = null;
  await refreshAll();
}

// US-16 : supprimer un outil (confirmation)
async function removeTool(tool) {
  const ok = window.confirm(`Retirer « ${tool.name} » du prêt ? Les demandes en attente seront annulées.`);
  if (!ok) return;
  try {
    await api(`/api/tools/${encodeURIComponent(tool.id)}`, { method: 'DELETE' });
    if (state.selectedToolId === tool.id) {
      state.selectedToolId = null;
      els.detail.hidden = true;
      els.hint.hidden = false;
    }
    showMessage(`« ${tool.name} » a été retiré du prêt.`);
    await refreshAll();
  } catch (err) {
    showError(err);
  }
}

// US-14 : historique des prêts, US-13 : noter l'emprunteur après le retour
async function toggleHistory(toolId, list, reopen = false) {
  if (!list.hidden && !reopen) {
    list.hidden = true;
    state.openHistory.delete(toolId);
    return;
  }
  state.openHistory.add(toolId);
  try {
    const loans = await api(`/api/tools/${encodeURIComponent(toolId)}/history`);
    list.replaceChildren();
    if (loans.length === 0) list.append(el('li', 'Aucun prêt pour le moment.', 'empty'));
    for (const l of loans) {
      const row = el('li');
      row.append(el('span', `${l.borrower?.firstName ?? '?'} · du ${l.startDate} au ${l.endDate}`));
      const right = el('div', undefined, 'row-actions');
      right.append(el('span', statusLabel(l.status), `badge ${l.status}`));
      if (l.rating) {
        right.append(el('span', `Noté ${l.rating}/5`, 'stars'));
      } else if (l.status === 'returned') {
        const select = el('select');
        select.setAttribute('aria-label', 'Note de 1 à 5');
        for (const s of [5, 4, 3, 2, 1]) {
          const o = el('option', `${s}/5`);
          o.value = String(s);
          select.append(o);
        }
        right.append(select, button('Noter', () => act(`/api/loans/${l.id}/rating`, 'Merci, la note est enregistrée.', { score: Number(select.value) })));
      }
      row.append(right);
      list.append(row);
    }
    list.hidden = false;
  } catch (err) {
    showError(err);
  }
}

// US-02 + US-17 : proposer un outil, avec ses photos
fillCategories(els.category);
fillCategories(els.newTool.category);
els.showNewTool.addEventListener('click', () => {
  els.newTool.hidden = false;
  els.newTool.name.focus();
});
$('cancel-new-tool').addEventListener('click', () => {
  els.newTool.reset();
  els.newTool.hidden = true;
});
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
    const files = els.newTool.photos.files;
    if (files.length > MAX_PHOTOS) showMessage(`Seules les ${MAX_PHOTOS} premières photos sont ajoutées.`);
    if (files.length) await uploadPhotos(tool.id, files);
    els.newTool.reset();
    els.newTool.hidden = true;
    showMessage(`« ${tool.name} » est maintenant proposé au prêt.`);
    await refreshAll();
  } catch (err) {
    showError(err);
  } finally {
    submit.disabled = false;
  }
});

// ---------- Démarrage et rafraîchissement ----------

async function refreshAll() {
  await Promise.all([loadCatalogue(), loadMine(), loadNotifications(), loadMyTools(true)]);
  if (state.selectedToolId) await openTool(state.selectedToolId).catch(() => {});
}

setInterval(() => {
  if (state.user && !document.hidden) Promise.all([loadNotifications(), loadMyTools()]).catch(() => {});
}, REFRESH_MS);

async function start() {
  if (state.token) {
    try {
      state.user = await api('/api/auth/me');
    } catch {
      saveToken('');
    }
  }
  renderAccount();
  await refreshAll();
}

start().catch(showError);
