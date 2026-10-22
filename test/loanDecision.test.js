import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

// u2 demande l'outil t1, qui appartient à u1
async function appAvecDemande() {
  const app = createApp();
  const res = await request(app)
    .post('/api/loans')
    .set('X-User-Id', 'u2')
    .send({ toolId: 't1', startDate: '2026-11-02', endDate: '2026-11-05' });
  return { app, loanId: res.body.id };
}

describe('POST /api/loans/:id/accept|refuse (US-05)', () => {
  it('renvoie 403 si ce n\'est pas le propriétaire de l\'outil qui répond', async () => {
    const { app, loanId } = await appAvecDemande();
    const res = await request(app).post(`/api/loans/${loanId}/accept`).set('X-User-Id', 'u3');
    expect(res.status).toBe(403);
    expect(app.locals.data.loans[0].status).toBe('pending');
  });

  it('une demande acceptée passe « acceptée » et l\'outil passe « prêté »', async () => {
    const { app, loanId } = await appAvecDemande();
    const res = await request(app).post(`/api/loans/${loanId}/accept`).set('X-User-Id', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
    const tool = await request(app).get('/api/tools/t1');
    expect(tool.body.status).toBe('lent');
  });

  it('une demande refusée passe « refusée » et l\'outil ne change pas', async () => {
    const { app, loanId } = await appAvecDemande();
    const res = await request(app).post(`/api/loans/${loanId}/refuse`).set('X-User-Id', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refused');
    const tool = await request(app).get('/api/tools/t1');
    expect(tool.body.status).toBe('available');
  });

  it('renvoie 409 si la demande n\'est plus en attente', async () => {
    const { app, loanId } = await appAvecDemande();
    await request(app).post(`/api/loans/${loanId}/refuse`).set('X-User-Id', 'u1');
    const res = await request(app).post(`/api/loans/${loanId}/accept`).set('X-User-Id', 'u1');
    expect(res.status).toBe(409);
  });

  it('renvoie 404 pour une demande inconnue', async () => {
    const res = await request(createApp()).post('/api/loans/l999/accept').set('X-User-Id', 'u1');
    expect(res.status).toBe(404);
  });

  it('renvoie 401 sans utilisateur identifié', async () => {
    const { app, loanId } = await appAvecDemande();
    const res = await request(app).post(`/api/loans/${loanId}/accept`);
    expect(res.status).toBe(401);
  });
});
