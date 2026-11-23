import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/tools?category= (US-10)', () => {
  it('ne renvoie que les outils de la catégorie choisie', async () => {
    const res = await request(createApp()).get('/api/tools').query({ category: 'Perçage' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((t) => t.category === 'Perçage')).toBe(true);
  });

  it('renvoie tous les outils de la catégorie et seulement eux', async () => {
    const app = createApp();
    const all = await request(app).get('/api/tools');
    const res = await request(app).get('/api/tools').query({ category: 'Jardinage' });
    const expected = all.body.filter((t) => t.category === 'Jardinage').map((t) => t.id).sort();
    expect(res.body.map((t) => t.id).sort()).toEqual(expected);
  });

  it('renvoie une liste vide pour une catégorie autorisée sans outil', async () => {
    const app = createApp({ users: [], tools: [], loans: [] });
    const res = await request(app).get('/api/tools').query({ category: 'Mesure' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('renvoie 400 pour une catégorie inconnue', async () => {
    const res = await request(createApp()).get('/api/tools').query({ category: 'Plomberie' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('category');
    expect(res.body.error).toMatch(/Catégorie inconnue/);
  });

  it('garde les outils disponibles en premier dans la catégorie', async () => {
    const res = await request(createApp()).get('/api/tools').query({ category: 'Jardinage' });
    const statuses = res.body.map((t) => t.status);
    const firstOther = statuses.findIndex((s) => s !== 'available');
    expect(firstOther === -1 || !statuses.slice(firstOther).includes('available')).toBe(true);
  });

  it('se combine avec la recherche par mot-clé (US-11)', async () => {
    const res = await request(createApp()).get('/api/tools').query({ category: 'Perçage', q: 'visseuse' });
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.name)).toEqual(['Visseuse sans fil']);
  });

  it("propose le filtre par catégorie dans l'interface web", async () => {
    const app = createApp();
    const page = await request(app).get('/');
    expect(page.text).toContain('id="category"');
    const script = await request(app).get('/main.js');
    expect(script.text).toContain('/api/tools?category=');
  });
});
