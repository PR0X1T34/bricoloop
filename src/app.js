import express from 'express';
import { seedData } from './seed.js';

const STATUS_ORDER = { available: 0, lent: 1, unavailable: 2 };

export function createApp(data = seedData()) {
  const app = express();
  app.use(express.json());
  app.locals.data = data;

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // US-01 : consulter le catalogue des outils
  app.get('/api/tools', (req, res) => {
    const tools = [...data.tools]
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      .map(({ id, name, category, status }) => ({ id, name, category, status }));
    res.status(200).json(tools);
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

  return app;
}
