import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { seedData } from '../src/seed.js';

// t1 (propriétaire u1) est prêté à u3 du 10 au 15 novembre
function appAvecPretAccepte() {
  const data = seedData();
  data.tools.find((t) => t.id === 't1').status = 'lent';
  data.loans.push({
    id: 'l1',
    toolId: 't1',
    borrowerId: 'u3',
    startDate: '2026-11-10',
    endDate: '2026-11-15',
    status: 'accepted',
  });
  return createApp(data);
}

function demander(app, startDate, endDate) {
  return request(app)
    .post('/api/loans')
    .set('X-User-Id', 'u2')
    .send({ toolId: 't1', startDate, endDate });
}

describe('Chevauchement des prêts (US-06)', () => {
  it('refuse avec 409 une demande du 12 au 14 si un prêt du 10 au 15 est accepté', async () => {
    const res = await demander(appAvecPretAccepte(), '2026-11-12', '2026-11-14');
    expect(res.status).toBe(409);
  });

  it('accepte une demande qui commence le lendemain de la fin du prêt', async () => {
    const res = await demander(appAvecPretAccepte(), '2026-11-16', '2026-11-20');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('refuse une demande qui commence le jour de la fin du prêt (409)', async () => {
    const res = await demander(appAvecPretAccepte(), '2026-11-15', '2026-11-18');
    expect(res.status).toBe(409);
  });

  it('refuse une demande qui englobe le prêt accepté (409)', async () => {
    const res = await demander(appAvecPretAccepte(), '2026-11-01', '2026-11-30');
    expect(res.status).toBe(409);
  });

  it('accepte une demande qui se termine la veille du début du prêt', async () => {
    const res = await demander(appAvecPretAccepte(), '2026-11-05', '2026-11-09');
    expect(res.status).toBe(201);
  });

  it('ne bloque pas une demande qui chevauche une autre demande seulement en attente', async () => {
    const app = createApp();
    await demander(app, '2026-11-10', '2026-11-15');
    const res = await request(app)
      .post('/api/loans')
      .set('X-User-Id', 'u3')
      .send({ toolId: 't1', startDate: '2026-11-12', endDate: '2026-11-14' });
    expect(res.status).toBe(201);
  });

  it('refuse avec 409 d\'accepter une 2e demande qui chevauche un prêt accepté', async () => {
    const app = createApp();
    const r1 = await demander(app, '2026-11-10', '2026-11-15');
    const r2 = await request(app)
      .post('/api/loans')
      .set('X-User-Id', 'u3')
      .send({ toolId: 't1', startDate: '2026-11-12', endDate: '2026-11-14' });
    await request(app).post(`/api/loans/${r1.body.id}/accept`).set('X-User-Id', 'u1');
    const res = await request(app).post(`/api/loans/${r2.body.id}/accept`).set('X-User-Id', 'u1');
    expect(res.status).toBe(409);
    expect(app.locals.data.loans.find((l) => l.id === r2.body.id).status).toBe('pending');
  });
});
