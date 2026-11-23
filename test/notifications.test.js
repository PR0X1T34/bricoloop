import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

// t1 (Perceuse) appartient à u1 (Alice) ; u2 (Bruno) l'emprunte
const demande = (app, user = 'u2') =>
  request(app)
    .post('/api/loans')
    .set('X-User-Id', user)
    .send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-03' });
const notifs = (app, user) => request(app).get('/api/notifications').set('X-User-Id', user);

describe('Notifications (US-15)', () => {
  it('prévient le propriétaire quand quelqu\'un demande son outil', async () => {
    const app = createApp();
    const loan = await demande(app);
    const res = await notifs(app, 'u1');
    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(1);
    expect(res.body.items[0]).toMatchObject({ type: 'loan_requested', loanId: loan.body.id, read: false, loanStatus: 'pending' });
    expect(res.body.items[0].message).toBe('Bruno veut emprunter « Perceuse à percussion » du 2026-12-01 au 2026-12-03.');
  });

  it("ne montre pas la notification aux autres voisins", async () => {
    const app = createApp();
    await demande(app);
    const bruno = await notifs(app, 'u2');
    const chloe = await notifs(app, 'u3');
    expect(bruno.body.items).toEqual([]);
    expect(chloe.body.items).toEqual([]);
  });

  it("prévient l'emprunteur quand sa demande est acceptée", async () => {
    const app = createApp();
    const loan = await demande(app);
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    const res = await notifs(app, 'u2');
    expect(res.body.items[0].type).toBe('loan_accepted');
    expect(res.body.items[0].message).toBe('Alice a accepté ta demande pour « Perceuse à percussion » du 2026-12-01 au 2026-12-03.');
  });

  it("prévient l'emprunteur quand sa demande est refusée", async () => {
    const app = createApp();
    const loan = await demande(app);
    await request(app).post(`/api/loans/${loan.body.id}/refuse`).set('X-User-Id', 'u1');
    const res = await notifs(app, 'u2');
    expect(res.body.items[0].type).toBe('loan_refused');
    expect(res.body.items[0].message).toMatch(/a refusé ta demande/);
  });

  it("indique l'état actuel de la demande dans la notification du propriétaire", async () => {
    const app = createApp();
    const loan = await demande(app);
    await request(app).post(`/api/loans/${loan.body.id}/accept`).set('X-User-Id', 'u1');
    const res = await notifs(app, 'u1');
    expect(res.body.items[0].loanStatus).toBe('accepted');
  });

  it("ne crée pas de notification si la demande est invalide", async () => {
    const app = createApp();
    await demande(app, 'u1'); // Alice demande son propre outil : 400
    const res = await notifs(app, 'u1');
    expect(res.body.items).toEqual([]);
  });

  it('classe les notifications de la plus récente à la plus ancienne', async () => {
    const app = createApp();
    await demande(app, 'u2');
    await demande(app, 'u3');
    const res = await notifs(app, 'u1');
    expect(res.body.items.map((n) => n.message.split(' ')[0])).toEqual(['Chloé', 'Bruno']);
  });

  it('marque toutes mes notifications comme lues', async () => {
    const app = createApp();
    await demande(app);
    const read = await request(app).post('/api/notifications/read').set('X-User-Id', 'u1');
    expect(read.status).toBe(200);
    const res = await notifs(app, 'u1');
    expect(res.body.unread).toBe(0);
    expect(res.body.items.every((n) => n.read)).toBe(true);
  });

  it('renvoie 401 sans utilisateur identifié', async () => {
    const app = createApp();
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).post('/api/notifications/read')).status).toBe(401);
  });

  it("affiche les notifications dans l'interface web", async () => {
    const app = createApp();
    const page = await request(app).get('/');
    expect(page.text).toContain('id="notif-list"');
    const script = await request(app).get('/main.js');
    expect(script.text).toContain("api('/api/notifications')");
  });
});
