import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { CATEGORIES } from '../src/seed.js';

const outil = { name: 'Ponceuse orbitale', category: 'Peinture', description: 'Avec 20 disques' };

function proposer(app, body, userId = 'u1') {
  const req = request(app).post('/api/tools');
  if (userId) req.set('X-User-Id', userId);
  return req.send(body);
}

function expect400(res, field) {
  expect(res.status).toBe(400);
  expect(res.body.field).toBe(field);
  expect(res.body.error).toEqual(expect.any(String));
}

describe('POST /api/tools (US-02)', () => {
  describe('nom obligatoire (2 à 60), catégorie autorisée, description facultative (300 max)', () => {
    it.each(['ab', 'a'.repeat(60)])('accepte un nom aux bornes (%#)', async (name) => {
      const res = await proposer(createApp(), { ...outil, name });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(name);
    });

    it.each([
      ['absent', undefined],
      ['vide', ''],
      ["composé d'espaces", '   '],
      ['de 1 caractère', 'a'],
      ['de 61 caractères', 'a'.repeat(61)],
      ["qui n'est pas un texte", 42],
    ])('renvoie 400 (name) si le nom est %s', async (_label, name) => {
      expect400(await proposer(createApp(), { ...outil, name }), 'name');
    });

    it.each(CATEGORIES)('accepte la catégorie « %s »', async (category) => {
      const res = await proposer(createApp(), { ...outil, category });
      expect(res.status).toBe(201);
    });

    it.each([
      ['absente', undefined],
      ['hors liste', 'Cuisine'],
      ['avec une autre casse', 'peinture'],
    ])('renvoie 400 (category) si la catégorie est %s', async (_label, category) => {
      expect400(await proposer(createApp(), { ...outil, category }), 'category');
    });

    it('accepte un outil sans description', async () => {
      const res = await proposer(createApp(), { name: 'Scie', category: 'Autre' });
      expect(res.status).toBe(201);
      expect(res.body.description).toBe('');
    });

    it('accepte une description de 300 caractères', async () => {
      const res = await proposer(createApp(), { ...outil, description: 'd'.repeat(300) });
      expect(res.status).toBe(201);
    });

    it('renvoie 400 (description) au-delà de 300 caractères', async () => {
      expect400(await proposer(createApp(), { ...outil, description: 'd'.repeat(301) }), 'description');
    });
  });

  describe("l'outil appartient à l'utilisateur courant et est « disponible »", () => {
    it('crée l\'outil avec ownerId = X-User-Id et status = available', async () => {
      const app = createApp();
      const res = await proposer(app, outil, 'u3');
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ...outil, ownerId: 'u3', status: 'available' });
      expect(res.body.id).toBe('t9');
      expect(res.headers.location).toBe('/api/tools/t9');
      expect(app.locals.data.tools).toContainEqual(res.body);
    });

    it('apparaît ensuite dans le catalogue (US-01)', async () => {
      const app = createApp();
      await proposer(app, outil);
      const res = await request(app).get('/api/tools');
      expect(res.body.map((t) => t.name)).toContain(outil.name);
    });

    it('ignore id, ownerId et status envoyés par le client', async () => {
      const res = await proposer(createApp(), { ...outil, id: 't1', ownerId: 'u2', status: 'lent' });
      expect(res.body).toMatchObject({ id: 't9', ownerId: 'u1', status: 'available' });
    });

    it.each([
      ['absent', null],
      ['inconnu', 'u99'],
    ])('renvoie 401 et ne crée rien si X-User-Id est %s', async (_label, userId) => {
      const app = createApp();
      const res = await proposer(app, outil, userId);
      expect(res.status).toBe(401);
      expect(app.locals.data.tools).toHaveLength(8);
    });
  });

  describe('une donnée invalide renvoie 400 avec un message qui indique le champ en cause', () => {
    it('le message du nom parle du nom', async () => {
      const res = await proposer(createApp(), { ...outil, name: 'a' });
      expect400(res, 'name');
      expect(res.body.error).toMatch(/nom/i);
    });

    it('le message de catégorie liste les catégories autorisées', async () => {
      const res = await proposer(createApp(), { ...outil, category: 'Cuisine' });
      expect400(res, 'category');
      for (const c of CATEGORIES) expect(res.body.error).toContain(c);
    });

    it("n'enregistre rien si la donnée est invalide", async () => {
      const app = createApp();
      await proposer(app, { ...outil, name: '' });
      expect(app.locals.data.tools).toHaveLength(8);
    });
  });
});
