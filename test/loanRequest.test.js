import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

const demande = { toolId: 't1', startDate: '2026-11-02', endDate: '2026-11-05' };

describe('POST /api/loans (US-04)', () => {
  it('crée une demande « en attente » pour un outil disponible', async () => {
    const app = createApp();
    const res = await request(app).post('/api/loans').set('X-User-Id', 'u2').send(demande);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      toolId: 't1',
      borrowerId: 'u2',
      startDate: '2026-11-02',
      endDate: '2026-11-05',
      status: 'pending',
    });
    expect(app.locals.data.loans).toHaveLength(1);
  });

  it('renvoie 400 si la date de fin est antérieure à la date de début', async () => {
    const res = await request(createApp())
      .post('/api/loans')
      .set('X-User-Id', 'u2')
      .send({ ...demande, startDate: '2026-11-05', endDate: '2026-11-02' });
    expect(res.status).toBe(400);
  });

  it('renvoie 400 si je demande mon propre outil', async () => {
    const res = await request(createApp()).post('/api/loans').set('X-User-Id', 'u1').send(demande);
    expect(res.status).toBe(400);
  });

  it('accepte plusieurs demandes en attente pour le même outil', async () => {
    const app = createApp();
    const r1 = await request(app).post('/api/loans').set('X-User-Id', 'u2').send(demande);
    const r2 = await request(app).post('/api/loans').set('X-User-Id', 'u3').send(demande);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).not.toBe(r2.body.id);
    expect(app.locals.data.loans.filter((l) => l.status === 'pending')).toHaveLength(2);
  });

  it('renvoie 404 pour un outil inconnu', async () => {
    const res = await request(createApp())
      .post('/api/loans')
      .set('X-User-Id', 'u2')
      .send({ ...demande, toolId: 't999' });
    expect(res.status).toBe(404);
  });

  it('renvoie 401 sans utilisateur identifié', async () => {
    const res = await request(createApp()).post('/api/loans').send(demande);
    expect(res.status).toBe(401);
  });
});
