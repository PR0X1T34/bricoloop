import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { DEMO_PASSWORD } from '../src/seed.js';

const demande = (app, body = {}, user = 'u2') =>
  request(app).post('/api/loans').set('X-User-Id', user).send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-03', ...body });

describe('Message joint à une demande (US-20)', () => {
  it('le propriétaire voit le message dans Mes outils et dans sa notification', async () => {
    const app = createApp();
    await demande(app, { message: 'Pour monter une étagère samedi' });
    const mine = await request(app).get('/api/tools/mine').set('X-User-Id', 'u1');
    expect(mine.body.find((t) => t.id === 't1').requests[0].message).toBe('Pour monter une étagère samedi');
    const notifs = await request(app).get('/api/notifications').set('X-User-Id', 'u1');
    expect(notifs.body.items[0].loanMessage).toBe('Pour monter une étagère samedi');
  });

  it('refuse un message de plus de 300 caractères (400)', async () => {
    const res = await demande(createApp(), { message: 'a'.repeat(301) });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('message');
  });
});

describe('Annuler sa demande (US-20)', () => {
  it("l'emprunteur annule une demande en attente et le propriétaire est prévenu", async () => {
    const app = createApp();
    const loan = await demande(app);
    const res = await request(app).post(`/api/loans/${loan.body.id}/cancel`).set('X-User-Id', 'u2');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    const notifs = await request(app).get('/api/notifications').set('X-User-Id', 'u1');
    expect(notifs.body.items[0].type).toBe('loan_cancelled');
  });

  it("seul le demandeur peut annuler (403), et seulement en attente (409)", async () => {
    const app = createApp();
    const loan = await demande(app);
    expect((await request(app).post(`/api/loans/${loan.body.id}/cancel`).set('X-User-Id', 'u3')).status).toBe(403);
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    expect((await request(app).post(`/api/loans/${loan.body.id}/cancel`).set('X-User-Id', 'u2')).status).toBe(409);
  });
});

describe("Page d'un outil : état d'usage (US-20)", () => {
  it('montre les réservations à venir et le nombre de prêts, sans nom', async () => {
    const app = createApp();
    const a = await demande(app, { startDate: '2099-01-10', endDate: '2099-01-12' });
    await request(app).post(`/api/loans/${a.body.id}/accept`).set('X-User-Id', 'u1');
    await demande(app, { startDate: '2099-02-01', endDate: '2099-02-02' }, 'u3');
    const res = await request(app).get('/api/tools/t1');
    expect(res.body.activity).toMatchObject({
      timesLent: 1,
      pendingRequests: 1,
      bookings: [{ startDate: '2099-01-10', endDate: '2099-01-12' }],
    });
    expect(JSON.stringify(res.body.activity)).not.toMatch(/Bruno|u2/);
  });

  it('compte les retours et la date du dernier retour', async () => {
    const app = createApp();
    const a = await demande(app, { startDate: '2026-01-05', endDate: '2026-01-06' });
    await request(app).post(`/api/loans/${a.body.id}/accept`).set('X-User-Id', 'u1');
    await request(app).post(`/api/loans/${a.body.id}/return`).set('X-User-Id', 'u1');
    const res = await request(app).get('/api/tools/t1');
    expect(res.body.activity).toMatchObject({ timesLent: 1, timesReturned: 1, lastReturnedOn: '2026-01-06', bookings: [] });
  });

  it('indique le quartier de chaque outil dans le catalogue', async () => {
    const res = await request(createApp()).get('/api/tools');
    expect(res.body.find((t) => t.id === 't1').district).toBe('Centre');
  });

  it("Mes demandes donne le propriétaire de l'outil", async () => {
    const app = createApp();
    await demande(app);
    const res = await request(app).get('/api/loans/mine').set('X-User-Id', 'u2');
    expect(res.body[0].owner).toEqual({ firstName: 'Alice', district: 'Centre' });
  });
});

describe('Mon profil (US-20)', () => {
  it('modifie le prénom et le quartier', async () => {
    const app = createApp();
    const res = await request(app).patch('/api/auth/me').set('X-User-Id', 'u1').send({ district: 'Nouveau quartier' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ firstName: 'Alice', district: 'Nouveau quartier' });
    expect((await request(app).patch('/api/auth/me').set('X-User-Id', 'u1').send({ firstName: 'A' })).body.field).toBe('firstName');
  });

  it('change le mot de passe et ferme les autres sessions', async () => {
    const app = createApp(undefined, { allowUserIdHeader: false });
    const login = () => request(app).post('/api/auth/login').send({ email: 'alice@bricoloop.test', password: DEMO_PASSWORD });
    const a = (await login()).body.token;
    const b = (await login()).body.token;
    const bad = await request(app).post('/api/auth/password').set('Authorization', `Bearer ${a}`).send({ currentPassword: 'faux', newPassword: 'nouveau-mdp' });
    expect(bad.status).toBe(400);
    const ok = await request(app).post('/api/auth/password').set('Authorization', `Bearer ${a}`).send({ currentPassword: DEMO_PASSWORD, newPassword: 'nouveau-mdp' });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a}`)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${b}`)).status).toBe(401);
    expect((await login()).status).toBe(401);
  });

  it('donne mes chiffres', async () => {
    const app = createApp();
    const loan = await demande(app);
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    const alice = await request(app).get('/api/auth/me/stats').set('X-User-Id', 'u1');
    expect(alice.body).toMatchObject({ tools: 2, loansGiven: 1, loansReceived: 0 });
    const bruno = await request(app).get('/api/auth/me/stats').set('X-User-Id', 'u2');
    expect(bruno.body).toMatchObject({ tools: 2, loansGiven: 0, loansReceived: 1 });
  });
});
