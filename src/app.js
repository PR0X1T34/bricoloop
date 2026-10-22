import express from 'express';
import { seedData } from './seed.js';

const STATUS_ORDER = { available: 0, lent: 1, unavailable: 2 };

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

  // US-01 : consulter le catalogue des outils
  app.get('/api/tools', (req, res) => {
    const tools = [...data.tools]
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      .map(({ id, name, category, status }) => ({ id, name, category, status }));
    res.status(200).json(tools);
  });

  return app;
}
