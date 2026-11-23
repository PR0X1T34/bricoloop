// US-09 : parcours d'emprunt (profil → catalogue → fiche → demande)
import { formatError, statusLabel } from './ui.js';

const state = { userId: '', selectedToolId: null, category: '', myToolsKey: '', openHistory: new Set() };

// US-10 : catégories autorisées (énoncé, section 3)
const CATEGORIES = ['Perçage', 'Jardinage', 'Peinture', 'Nettoyage', 'Mesure', 'Autre'];

const els = {
  profile: document.getElementById('profile'),
  category: document.getElementById('category'),
  catalogue: document.getElementById('catalogue'),
  detail: document.getElementById('detail'),
  hint: document.getElementById('detail-hint'),
  mine: document.getElementById('mine'),
  bell: document.getElementById('bell'),
  unread: document.getElementById('unread'),
  notifList: document.getElementById('notif-list'),
  markRead: document.getElementById('mark-read'),
  myTools: document.getElementById('my-tools'),
  newTool: document.getElementById('new-tool'),
  message: document.getElementById('message'),
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.userId) {
    headers['X-User-Id'] = state.userId;
  }
  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(formatError(res.status, body));
  }
  return body;
}

function showMessage(text, type) {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  els.message.hidden = false;
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

async function loadProfiles() {
  const users = await api('/api/users');
  for (const u of users) {
    const option = el('option', `${u.firstName} (${u.district})`);
    option.value = u.id;
    els.profile.append(option);
  }
}

async function loadCatalogue() {
  const tools = state.category
    ? await api(`/api/tools?category=${encodeURIComponent(state.category)}`)
    : await api('/api/tools');
  els.catalogue.replaceChildren();
  if (tools.length === 0) {
    els.catalogue.append(el('li', state.category ? 'Aucun outil dans cette catégorie' : 'Aucun outil pour le moment', 'empty'));
    return;
  }
  for (const tool of tools) {
    const button = el('button', undefined, 'tool');
    button.type = 'button';
    button.append(el('span', tool.name, 'tool-name'));
    button.append(el('span', tool.category, 'tool-category'));
    button.append(el('span', statusLabel(tool.status), `badge ${tool.status}`));
    if (tool.id === state.selectedToolId) button.classList.add('selected');
    button.addEventListener('click', () => openTool(tool.id));
    const li = el('li');
    li.append(button);
    els.catalogue.append(li);
  }
}

// US-08 : mes demandes et mes emprunts, triés par date de début
async function loadMine() {
  els.mine.replaceChildren();
  if (!state.userId) {
    els.mine.append(el('li', 'Choisis ton profil pour voir tes demandes.', 'empty'));
    return;
  }
  const loans = await api('/api/loans/mine');
  if (loans.length === 0) {
    els.mine.append(el('li', "Tu n'as encore fait aucune demande.", 'empty'));
    return;
  }
  for (const loan of loans) {
    const li = el('li');
    li.append(el('span', loan.toolName ?? loan.toolId, 'tool-name'));
    li.append(el('span', `du ${loan.startDate} au ${loan.endDate}`, 'tool-category'));
    li.append(el('span', statusLabel(loan.status), `badge ${loan.status}`));
    els.mine.append(li);
  }
}

async function openTool(id) {
  state.selectedToolId = id;
  els.message.hidden = true;
  try {
    const tool = await api(`/api/tools/${encodeURIComponent(id)}`);
    renderDetail(tool);
    await loadCatalogue();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function renderDetail(tool) {
  els.detail.replaceChildren();
  els.detail.append(el('h2', tool.name));
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

  const form = el('form');
  form.innerHTML = `
    <h3>Demander l'emprunt</h3>
    <div class="dates">
      <label>Du <input type="date" name="startDate" required></label>
      <label>Au <input type="date" name="endDate" required></label>
    </div>
    <button type="submit">Envoyer la demande</button>`;
  form.startDate.value = isoDate(1);
  form.endDate.value = isoDate(3);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const loan = await api('/api/loans', {
        method: 'POST',
        body: JSON.stringify({
          toolId: tool.id,
          startDate: form.startDate.value,
          endDate: form.endDate.value,
        }),
      });
      showMessage(
        `Demande envoyée pour « ${tool.name} » du ${loan.startDate} au ${loan.endDate} : ${statusLabel(loan.status).toLowerCase()}.`,
        'success',
      );
      await loadMine();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });
  els.detail.append(form);
  els.detail.hidden = false;
  els.hint.hidden = true;
}

// US-10 : filtrer le catalogue par catégorie
for (const c of CATEGORIES) {
  const option = el('option', c);
  option.value = c;
  els.category.append(option);
}
els.category.addEventListener('change', () => {
  state.category = els.category.value;
  loadCatalogue().catch((err) => showMessage(err.message, 'error'));
});


// US-15 : notifications (demande reçue, demande acceptée ou refusée)
const NOTIF_REFRESH_MS = 5000;

async function respond(loanId, decision) {
  try {
    await api(`/api/loans/${encodeURIComponent(loanId)}/${decision}`, { method: 'POST' });
    showMessage(decision === 'accept' ? 'Demande acceptée.' : 'Demande refusée.', 'success');
    await refreshAfterAction();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function loadNotifications() {
  els.notifList.replaceChildren();
  if (!state.userId) {
    els.bell.hidden = true;
    els.markRead.hidden = true;
    els.notifList.append(el('li', 'Choisis ton profil pour voir tes notifications.', 'empty'));
    return;
  }
  const { unread, items } = await api('/api/notifications');
  els.bell.hidden = false;
  els.unread.textContent = String(unread);
  els.unread.className = unread > 0 ? 'count' : 'count zero';
  els.markRead.hidden = unread === 0;
  if (items.length === 0) {
    els.notifList.append(el('li', "Aucune notification pour l'instant.", 'empty'));
    return;
  }
  for (const n of items) {
    const li = el('li', undefined, n.read ? '' : 'unread');
    li.append(el('span', n.message));
    li.append(el('span', new Date(n.createdAt).toLocaleString('fr-FR'), 'notif-time'));
    if (n.type === 'loan_requested' && n.loanStatus === 'pending') {
      const actions = el('div', undefined, 'notif-actions');
      const accept = el('button', 'Accepter', 'accept');
      accept.type = 'button';
      accept.addEventListener('click', () => respond(n.loanId, 'accept'));
      const refuse = el('button', 'Refuser');
      refuse.type = 'button';
      refuse.addEventListener('click', () => respond(n.loanId, 'refuse'));
      actions.append(accept, refuse);
      li.append(actions);
    } else if (n.type === 'loan_requested' && n.loanStatus) {
      li.append(el('span', statusLabel(n.loanStatus), `badge ${n.loanStatus}`));
    }
    els.notifList.append(li);
  }
}

// Rafraîchit tout ce qui dépend d'une action du propriétaire
async function refreshAfterAction() {
  await Promise.all([loadNotifications(), loadMyTools()]);
  if (state.selectedToolId) await openTool(state.selectedToolId);
  else await loadCatalogue();
}

function ratingText(rating) {
  return rating ? `★ ${String(rating.average).replace('.', ',')} (${rating.count} note${rating.count > 1 ? 's' : ''})` : 'pas encore noté';
}

function button(text, onClick, className) {
  const b = el('button', text, className);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

async function act(path, okText, body) {
  try {
    await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    showMessage(okText, 'success');
    await refreshAfterAction();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// US-12 : mes outils et les demandes reçues
async function loadMyTools() {
  els.newTool.hidden = !state.userId;
  if (!state.userId) {
    state.myToolsKey = '';
    els.myTools.replaceChildren();
    els.myTools.append(el('li', 'Choisis ton profil pour voir tes outils.', 'empty'));
    return;
  }
  const tools = await api('/api/tools/mine');
  // Pas de nouveau rendu si rien n'a changé (le rafraîchissement auto ne ferme pas l'historique ouvert)
  const key = `${state.userId}:${JSON.stringify(tools)}`;
  if (key === state.myToolsKey && els.myTools.childElementCount) return;
  state.myToolsKey = key;
  els.myTools.replaceChildren();
  if (tools.length === 0) {
    els.myTools.append(el('li', "Tu ne prêtes encore aucun outil. Propose-en un ci-dessous.", 'empty'));
  }
  for (const tool of tools) {
    const li = el('li');
    const head = el('div', undefined, 'mt-head');
    head.append(el('span', tool.name, 'tool-name'), el('span', statusLabel(tool.status), `badge ${tool.status}`));
    const n = tool.pendingRequests;
    head.append(el('span', n === 0 ? 'Aucune demande en attente' : `${n} demande${n > 1 ? 's' : ''} en attente`, n ? 'mt-count hot' : 'mt-count'));
    li.append(head);

    const sub = el('ul', undefined, 'sub');
    for (const r of tool.requests) {
      const row = el('li');
      const who = el('span', `${r.borrower?.firstName ?? '?'} (${r.borrower?.district ?? ''}) · du ${r.startDate} au ${r.endDate} `);
      who.append(el('span', ratingText(r.borrower?.rating), 'stars'));
      const actions = el('div', undefined, 'row-actions');
      actions.append(
        button('Accepter', () => act(`/api/loans/${r.id}/accept`, 'Demande acceptée.'), 'accept'),
        button('Refuser', () => act(`/api/loans/${r.id}/refuse`, 'Demande refusée.')),
      );
      row.append(who, actions);
      sub.append(row);
    }
    if (tool.currentLoan) {
      const c = tool.currentLoan;
      const row = el('li');
      row.append(el('span', `Prêté à ${c.borrower?.firstName ?? '?'} du ${c.startDate} au ${c.endDate}`));
      row.append(button('Déclarer le retour', () => act(`/api/loans/${c.id}/return`, 'Retour enregistré : l\'outil est de nouveau disponible.'), 'accept'));
      sub.append(row);
    }
    if (sub.childElementCount) li.append(sub);

    const history = el('ul', undefined, 'sub');
    history.hidden = true;
    li.append(button('Voir l\'historique des prêts', () => toggleHistory(tool.id, history), 'link-btn'), history);
    els.myTools.append(li);
    if (state.openHistory.has(tool.id)) toggleHistory(tool.id, history, true);
  }
}

// US-14 : historique des prêts d'un outil, US-13 : noter l'emprunteur après le retour
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
    showMessage(err.message, 'error');
  }
}

// US-02 dans l'interface : proposer un outil au prêt
for (const c of CATEGORIES) {
  const option = el('option', c);
  option.value = c;
  els.newTool.category.append(option);
}
els.newTool.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const tool = await api('/api/tools', {
      method: 'POST',
      body: JSON.stringify({
        name: els.newTool.name.value,
        category: els.newTool.category.value,
        description: els.newTool.description.value,
      }),
    });
    showMessage(`« ${tool.name} » est maintenant proposé au prêt.`, 'success');
    els.newTool.reset();
    await Promise.all([loadMyTools(), loadCatalogue()]);
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

els.markRead.addEventListener('click', async () => {
  try {
    await api('/api/notifications/read', { method: 'POST' });
    await loadNotifications();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

setInterval(() => {
  if (state.userId) Promise.all([loadNotifications(), loadMyTools()]).catch(() => {});
}, NOTIF_REFRESH_MS);

els.profile.addEventListener('change', () => {
  state.userId = els.profile.value;
  els.message.hidden = true;
  Promise.all([loadMine(), loadNotifications(), loadMyTools()]).catch((err) => showMessage(err.message, 'error'));
});

Promise.all([loadProfiles(), loadCatalogue(), loadMine(), loadNotifications(), loadMyTools()]).catch((err) => showMessage(err.message, 'error'));
