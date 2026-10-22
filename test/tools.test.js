import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/tools (US-01)', () => {
  it('affiche nom, catégorie et statut de chaque outil', async () => {
    const res = await request(createApp()).get('/api/tools');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
    for (const tool of res.body) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('category');
      expect(tool).toHaveProperty('status');
    }
  });

  it('place les outils disponibles en premier', async () => {
    const res = await request(createApp()).get('/api/tools');
    const statuses = res.body.map((t) => t.status);
    const firstNotAvailable = statuses.findIndex((s) => s !== 'available');
    expect(statuses.slice(firstNotAvailable).includes('available')).toBe(false);
  });

  it('renvoie une liste vide si aucun outil', async () => {
    const app = createApp({ users: [], tools: [], loans: [] });
    const res = await request(app).get('/api/tools');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
