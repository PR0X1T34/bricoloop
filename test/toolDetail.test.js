import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/tools/:id (US-03)', () => {
  it('affiche nom, catégorie, description et statut de l\'outil', async () => {
    const res = await request(createApp()).get('/api/tools/t1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 't1',
      name: 'Perceuse à percussion',
      category: 'Perçage',
      description: 'Bosch 750 W, coffret de forets inclus',
      status: 'available',
    });
  });

  it('affiche le prénom et le quartier du propriétaire', async () => {
    const res = await request(createApp()).get('/api/tools/t3');
    expect(res.status).toBe(200);
    expect(res.body.owner).toEqual({ firstName: 'Bruno', district: 'Gare' });
  });

  it('renvoie 404 pour un identifiant inconnu', async () => {
    const res = await request(createApp()).get('/api/tools/t999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
