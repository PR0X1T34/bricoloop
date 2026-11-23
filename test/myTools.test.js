import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

const demande = (app, user, toolId, startDate = '2026-12-01', endDate = '2026-12-03') =>
  request(app).post('/api/loans').set('X-User-Id', user).send({ toolId, startDate, endDate });

describe('GET /api/tools/mine (US-12)', () => {
  it("affiche mes outils et, pour chacun, le nombre de demandes en attente", async () => {
    const app = createApp();
    await demande(app, 'u2', 't1');
    await demande(app, 'u3', 't1', '2026-12-05', '2026-12-06');
    const res = await request(app).get('/api/tools/mine').set('X-User-Id', 'u1');
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.map((t) => [t.id, t]));
    expect(byId.t1.pendingRequests).toBe(2);
    expect(byId.t2.pendingRequests).toBe(0);
  });

  it("ne liste que mes outils", async () => {
    const res = await request(createApp()).get('/api/tools/mine').set('X-User-Id', 'u1');
    expect(res.body.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('détaille les demandes en attente avec le prénom de l\'emprunteur', async () => {
    const app = createApp();
    await demande(app, 'u2', 't1');
    const res = await request(app).get('/api/tools/mine').set('X-User-Id', 'u1');
    const t1 = res.body.find((t) => t.id === 't1');
    expect(t1.requests[0]).toMatchObject({ status: 'pending', borrower: { firstName: 'Bruno' } });
  });

  it("ne compte plus une demande à laquelle j'ai répondu et montre le prêt en cours", async () => {
    const app = createApp();
    const loan = await demande(app, 'u2', 't1');
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    const res = await request(app).get('/api/tools/mine').set('X-User-Id', 'u1');
    const t1 = res.body.find((t) => t.id === 't1');
    expect(t1.pendingRequests).toBe(0);
    expect(t1.currentLoan).toMatchObject({ id: loan.body.id, status: 'accepted' });
  });

  it('renvoie 401 sans utilisateur identifié', async () => {
    expect((await request(createApp()).get('/api/tools/mine')).status).toBe(401);
  });
});

// Prêt de t1 (Alice) à Bruno, accepté puis rendu
async function pretRendu(app, startDate = '2026-12-01', endDate = '2026-12-03', borrower = 'u2') {
  const loan = await demande(app, borrower, 't1', startDate, endDate);
  await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
  await request(app).post(`/api/loans/${loan.body.id}/return`).set('X-User-Id', 'u1');
  return loan.body.id;
}
const noter = (app, loanId, score, user = 'u1') =>
  request(app).post(`/api/loans/${loanId}/rating`).set('X-User-Id', user).send({ score });

describe('POST /api/loans/:id/rating (US-13)', () => {
  it("note l'emprunteur de 1 à 5 sur un prêt rendu", async () => {
    const app = createApp();
    const id = await pretRendu(app);
    const res = await noter(app, id, 4);
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(4);
    expect(res.body.borrower.rating).toEqual({ average: 4, count: 1 });
  });

  it('refuse une note hors de 1 à 5 (400)', async () => {
    const app = createApp();
    const id = await pretRendu(app);
    for (const score of [0, 6, 3.5, '5']) {
      const res = await noter(app, id, score);
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('score');
    }
  });

  it('une seule note par prêt (409)', async () => {
    const app = createApp();
    const id = await pretRendu(app);
    await noter(app, id, 5);
    const res = await noter(app, id, 2);
    expect(res.status).toBe(409);
  });

  it("uniquement sur un prêt « rendu » (409)", async () => {
    const app = createApp();
    const loan = await demande(app, 'u2', 't1');
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    const res = await noter(app, loan.body.id, 5);
    expect(res.status).toBe(409);
  });

  it('seul le propriétaire peut noter (403)', async () => {
    const app = createApp();
    const id = await pretRendu(app);
    expect((await noter(app, id, 5, 'u3')).status).toBe(403);
  });

  it("fait la moyenne des notes de l'emprunteur", async () => {
    const app = createApp();
    await noter(app, await pretRendu(app, '2026-12-01', '2026-12-02'), 5);
    await noter(app, await pretRendu(app, '2026-12-10', '2026-12-11'), 4);
    const res = await demande(app, 'u2', 't1', '2026-12-20', '2026-12-21');
    const mine = await request(app).get('/api/tools/mine').set('X-User-Id', 'u1');
    const req = mine.body.find((t) => t.id === 't1').requests.find((r) => r.id === res.body.id);
    expect(req.borrower.rating).toEqual({ average: 4.5, count: 2 });
  });

  it("prévient l'emprunteur de sa note", async () => {
    const app = createApp();
    await noter(app, await pretRendu(app), 5);
    const res = await request(app).get('/api/notifications').set('X-User-Id', 'u2');
    expect(res.body.items[0]).toMatchObject({ type: 'loan_rated' });
    expect(res.body.items[0].message).toMatch(/5\/5/);
  });
});

describe('GET /api/tools/:id/history (US-14)', () => {
  it('liste les prêts acceptés et rendus, du plus récent au plus ancien', async () => {
    const app = createApp();
    await pretRendu(app, '2026-12-01', '2026-12-02');
    await pretRendu(app, '2026-12-10', '2026-12-11', 'u3');
    const encours = await demande(app, 'u4', 't1', '2026-12-20', '2026-12-21');
    await request(app).post(`/api/loans/${encours.body.id}/accept`).set('X-User-Id', 'u1');
    await demande(app, 'u2', 't1', '2027-01-05', '2027-01-06'); // en attente : exclue
    const res = await request(app).get('/api/tools/t1/history').set('X-User-Id', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.map((l) => l.startDate)).toEqual(['2026-12-20', '2026-12-10', '2026-12-01']);
    expect(res.body.map((l) => l.status)).toEqual(['accepted', 'returned', 'returned']);
  });

  it("exclut les demandes refusées", async () => {
    const app = createApp();
    const loan = await demande(app, 'u2', 't1');
    await request(app).post(`/api/loans/${loan.body.id}/refuse`).set('X-User-Id', 'u1');
    const res = await request(app).get('/api/tools/t1/history').set('X-User-Id', 'u1');
    expect(res.body).toEqual([]);
  });

  it('réservé au propriétaire (403), outil inconnu 404', async () => {
    const app = createApp();
    expect((await request(app).get('/api/tools/t1/history').set('X-User-Id', 'u2')).status).toBe(403);
    expect((await request(app).get('/api/tools/t99/history').set('X-User-Id', 'u1')).status).toBe(404);
  });
});

describe("Interface web : mes outils, historique, note, proposer un outil", () => {
  it('affiche la section Mes outils et le formulaire pour proposer un outil', async () => {
    const app = createApp();
    const page = await request(app).get('/');
    expect(page.text).toContain('id="my-tools"');
    expect(page.text).toContain('id="new-tool"');
    const script = await request(app).get('/main.js');
    expect(script.text).toContain("api('/api/tools/mine')");
    expect(script.text).toContain('/history');
    expect(script.text).toContain('/rating');
  });
});
