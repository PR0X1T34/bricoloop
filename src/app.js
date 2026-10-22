import express from 'express';
import { CATEGORIES, seedData } from './seed.js';

const STATUS_ORDER = { available: 0, lent: 1, unavailable: 2 };

const NAME_MIN = 2;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 300;

// US-02 : renvoie { field, error } si invalide, sinon { value } (champs nettoyés)
function validateToolInput(body) {
  const { name, category, description } =
    body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
    return {
      field: 'name',
      error: `Le nom est obligatoire et doit contenir entre ${NAME_MIN} et ${NAME_MAX} caractères`,
    };
  }
  if (!CATEGORIES.includes(category)) {
    return {
      field: 'category',
      error: `La catégorie doit être l'une des suivantes : ${CATEGORIES.join(', ')}`,
    };
  }
  let cleanDescription = '';
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return { field: 'description', error: 'La description doit être un texte' };
    }
    cleanDescription = description.trim();
    if (cleanDescription.length > DESCRIPTION_MAX) {
      return {
        field: 'description',
        error: `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères`,
      };
    }
  }
  return { value: { name: cleanName, category, description: cleanDescription } };
}

function nextToolId(tools) {
  const max = tools.reduce((m, t) => Math.max(m, Number(String(t.id).slice(1)) || 0), 0);
  return `t${max + 1}`;
}

function isValidDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function createApp(data = seedData()) {
  const app = express();
  app.use(express.json());
  app.locals.data = data;

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // US-04 : demander l'emprunt d'un outil
  app.post('/api/loans', (req, res) => {
    const user = data.users.find((u) => u.id === req.get('X-User-Id'));
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const { toolId, startDate, endDate } = req.body ?? {};
    const tool = data.tools.find((t) => t.id === toolId);
    if (!tool) {
      return res.status(404).json({ error: 'Outil introuvable' });
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({ error: 'Dates invalides (format AAAA-MM-JJ)' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'La date de fin est antérieure à la date de début' });
    }
    if (tool.ownerId === user.id) {
      return res.status(400).json({ error: 'Impossible de demander son propre outil' });
    }
    if (tool.status !== 'available') {
      return res.status(400).json({ error: "L'outil n'est pas disponible" });
    }
    const loan = {
      id: `l${data.loans.length + 1}`,
      toolId: tool.id,
      borrowerId: user.id,
      startDate,
      endDate,
      status: 'pending',
    };
    data.loans.push(loan);
    res.status(201).json(loan);
  });

  // US-05 : accepter ou refuser une demande
  const DECISIONS = { accept: 'accepted', refuse: 'refused' };

  app.post('/api/loans/:id/:decision', (req, res, next) => {
    const newStatus = DECISIONS[req.params.decision];
    if (!newStatus) {
      return next();
    }
    const user = data.users.find((u) => u.id === req.get('X-User-Id'));
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loan = data.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }
    const tool = data.tools.find((t) => t.id === loan.toolId);
    if (!tool || tool.ownerId !== user.id) {
      return res.status(403).json({ error: "Seul le propriétaire de l'outil peut répondre" });
    }
    if (loan.status !== 'pending') {
      return res.status(409).json({ error: "Cette demande n'est plus en attente" });
    }
    loan.status = newStatus;
    if (newStatus === 'accepted') {
      tool.status = 'lent';
    }
    res.status(200).json({ ...loan, toolStatus: tool.status });
  });

  // US-01 : consulter le catalogue des outils
  app.get('/api/tools', (req, res) => {
    const tools = [...data.tools]
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      .map(({ id, name, category, status }) => ({ id, name, category, status }));
    res.status(200).json(tools);
  });

  // US-02 : proposer un outil au prêt
  app.post('/api/tools', (req, res) => {
    const user = data.users.find((u) => u.id === req.get('X-User-Id'));
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const result = validateToolInput(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error, field: result.field });
    }
    const tool = {
      id: nextToolId(data.tools),
      ownerId: user.id,
      ...result.value,
      status: 'available',
    };
    data.tools.push(tool);
    res.status(201).location(`/api/tools/${tool.id}`).json(tool);
  });

  // US-08 : voir mes demandes et mes emprunts
  app.get('/api/loans/mine', (req, res) => {
    const user = data.users.find((u) => u.id === req.get('X-User-Id'));
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loans = data.loans
      .filter((l) => l.borrowerId === user.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((l) => ({
        ...l,
        toolName: data.tools.find((t) => t.id === l.toolId)?.name ?? null,
      }));
    res.status(200).json(loans);
  });

  // US-03 : voir le détail d'un outil
  app.get('/api/tools/:id', (req, res) => {
    const tool = data.tools.find((t) => t.id === req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Outil introuvable' });
    }
    const owner = data.users.find((u) => u.id === tool.ownerId);
    res.status(200).json({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      description: tool.description ?? '',
      status: tool.status,
      owner: owner ? { firstName: owner.firstName, district: owner.district } : null,
    });
  });

  // US-07 : déclarer le retour d'un outil
  app.post('/api/loans/:id/return', (req, res) => {
    const user = data.users.find((u) => u.id === req.get('X-User-Id'));
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loan = data.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Prêt introuvable' });
    }
    const tool = data.tools.find((t) => t.id === loan.toolId);
    if (!tool || tool.ownerId !== user.id) {
      return res.status(403).json({ error: "Seul le propriétaire de l'outil peut déclarer le retour" });
    }
    if (loan.status !== 'accepted') {
      return res.status(409).json({ error: "Seul un prêt accepté peut être déclaré rendu" });
    }
    loan.status = 'returned';
    tool.status = 'available';
    res.status(200).json({ ...loan, toolStatus: tool.status });
  });

  return app;
}
