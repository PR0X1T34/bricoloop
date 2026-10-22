import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

// u2 emprunte l'outil t1 (propriétaire u1) et u1 accepte : le prêt l1 est en cours
async function appAvecPretEnCours() {
  const app = createApp();
  const demande = await request(app)
    .post('/api/loans')
    .set('X-User-Id', 'u2')
    .send({ toolId: 't1', startDate: '2026-11-02', endDate: '2026-11-05' });
  await request(app).post(`/api/loans/${demande.body.id}/accept`).set('X-User-Id', 'u1');
  return { app, loanId: demande.body.id };
}

describe('POST /api/loans/:id/return (US-07)', () => {
  it('renvoie 403 si ce n\'est pas le propriétaire qui déclare le retour', async () => {
    const { app, loanId } = await appAvecPretEnCours();
    const res = await request(app).post(`/api/loans/${loanId}/return`).set('X-User-Id', 'u2');
    expect(res.status).toBe(403);
    expect(app.locals.data.loans[0].status).toBe('accepted');
  });

  it('le prêt passe « rendu » et l\'outil redevient « disponible »', async () => {
    const { app, loanId } = await appAvecPretEnCours();
    const res = await request(app).post(`/api/loans/${loanId}/return`).set('X-User-Id', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('returned');
    const tool = await request(app).get('/api/tools/t1');
    expect(tool.body.status).toBe('available');
  });

  it('renvoie 409 si le prêt n\'est pas en cours (déjà rendu)', async () => {
    const { app, loanId } = await appAvecPretEnCours();
    await request(app).post(`/api/loans/${loanId}/return`).set('X-User-Id', 'u1');
    const res = await request(app).post(`/api/loans/${loanId}/return`).set('X-User-Id', 'u1');
    expect(res.status).toBe(409);
  });

  it('renvoie 409 pour une demande encore en attente', async () => {
    const app = createApp();
    const demande = await request(app)
      .post('/api/loans')
      .set('X-User-Id', 'u2')
      .send({ toolId: 't1', startDate: '2026-11-02', endDate: '2026-11-05' });
    const res = await request(app).post(`/api/loans/${demande.body.id}/return`).set('X-User-Id', 'u1');
    expect(res.status).toBe(409);
  });

  it('renvoie 404 pour un prêt inconnu', async () => {
    const res = await request(createApp()).post('/api/loans/l999/return').set('X-User-Id', 'u1');
    expect(res.status).toBe(404);
  });

  it('renvoie 401 sans utilisateur identifié', async () => {
    const { app, loanId } = await appAvecPretEnCours();
    const res = await request(app).post(`/api/loans/${loanId}/return`);
    expect(res.status).toBe(401);
  });
});
