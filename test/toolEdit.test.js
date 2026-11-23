import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

const patch = (app, id, body, user = 'u1') => request(app).patch(`/api/tools/${id}`).set('X-User-Id', user).send(body);
const del = (app, id, user = 'u1') => request(app).delete(`/api/tools/${id}`).set('X-User-Id', user);

describe('Modifier un outil (US-16)', () => {
  it('modifie le nom, la catégorie et la description', async () => {
    const app = createApp();
    const res = await patch(app, 't1', { name: 'Perceuse Bosch', category: 'Autre', description: 'Avec mallette' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Perceuse Bosch', category: 'Autre', description: 'Avec mallette' });
    const detail = await request(app).get('/api/tools/t1');
    expect(detail.body.name).toBe('Perceuse Bosch');
  });

  it('garde les champs non envoyés', async () => {
    const res = await patch(createApp(), 't1', { description: 'Nouvelle description' });
    expect(res.body).toMatchObject({ name: 'Perceuse à percussion', category: 'Perçage', description: 'Nouvelle description' });
  });

  it('applique les mêmes règles que la création (400 avec le champ en cause)', async () => {
    const app = createApp();
    expect((await patch(app, 't1', { name: 'X' })).body.field).toBe('name');
    expect((await patch(app, 't1', { category: 'Plomberie' })).body.field).toBe('category');
    expect((await patch(app, 't1', { description: 'a'.repeat(301) })).body.field).toBe('description');
  });

  it('met un outil indisponible puis de nouveau disponible', async () => {
    const app = createApp();
    expect((await patch(app, 't1', { status: 'unavailable' })).body.status).toBe('unavailable');
    expect((await patch(app, 't1', { status: 'available' })).body.status).toBe('available');
    expect((await patch(app, 't1', { status: 'lent' })).status).toBe(400);
  });

  it("refuse de changer le statut d'un outil prêté (409)", async () => {
    const app = createApp();
    const loan = await request(app).post('/api/loans').set('X-User-Id', 'u2').send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-02' });
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    expect((await patch(app, 't1', { status: 'unavailable' })).status).toBe(409);
  });

  it('seul le propriétaire peut modifier (403), 404 si inconnu, 401 sans compte', async () => {
    const app = createApp();
    expect((await patch(app, 't1', { name: 'Volée' }, 'u2')).status).toBe(403);
    expect((await patch(app, 't99', { name: 'Rien' })).status).toBe(404);
    expect((await request(app).patch('/api/tools/t1').send({ name: 'Anonyme' })).status).toBe(401);
  });
});

describe('Supprimer un outil (US-16)', () => {
  it("retire l'outil du catalogue", async () => {
    const app = createApp();
    expect((await del(app, 't2')).status).toBe(204);
    const catalogue = await request(app).get('/api/tools');
    expect(catalogue.body.map((t) => t.id)).not.toContain('t2');
    expect((await request(app).get('/api/tools/t2')).status).toBe(404);
  });

  it("annule les demandes en attente et prévient l'emprunteur", async () => {
    const app = createApp();
    const loan = await request(app).post('/api/loans').set('X-User-Id', 'u2').send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-02' });
    await del(app, 't1');
    const mine = await request(app).get('/api/loans/mine').set('X-User-Id', 'u2');
    expect(mine.body[0]).toMatchObject({ id: loan.body.id, status: 'refused', toolName: 'Perceuse à percussion' });
    const notifs = await request(app).get('/api/notifications').set('X-User-Id', 'u2');
    expect(notifs.body.items[0].message).toMatch(/retiré « Perceuse à percussion » du prêt/);
  });

  it("refuse de supprimer un outil prêté en ce moment (409)", async () => {
    const app = createApp();
    const loan = await request(app).post('/api/loans').set('X-User-Id', 'u2').send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-02' });
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    expect((await del(app, 't1')).status).toBe(409);
  });

  it('seul le propriétaire peut supprimer (403)', async () => {
    expect((await del(createApp(), 't1', 'u2')).status).toBe(403);
  });
});
