// US-09 : parcours d'emprunt (profil → catalogue → fiche → demande)
import { formatError, statusLabel } from './ui.js';

const state = { userId: '', selectedToolId: null };

const els = {
  profile: document.getElementById('profile'),
  catalogue: document.getElementById('catalogue'),
  detail: document.getElementById('detail'),
  hint: document.getElementById('detail-hint'),
  mine: document.getElementById('mine'),
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
  const tools = await api('/api/tools');
  els.catalogue.replaceChildren();
  if (tools.length === 0) {
    els.catalogue.append(el('li', 'Aucun outil pour le moment', 'empty'));
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

els.profile.addEventListener('change', () => {
  state.userId = els.profile.value;
  els.message.hidden = true;
  loadMine().catch((err) => showMessage(err.message, 'error'));
});

Promise.all([loadProfiles(), loadCatalogue(), loadMine()]).catch((err) => showMessage(err.message, 'error'));
