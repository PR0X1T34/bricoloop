import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { seedData } from '../src/seed.js';

function appAvecPrets() {
  const data = seedData();
  data.loans = [
    { id: 'l1', toolId: 't1', borrowerId: 'u2', startDate: '2026-11-20', endDate: '2026-11-22', status: 'pending' },
    { id: 'l2', toolId: 't3', borrowerId: 'u3', startDate: '2026-11-01', endDate: '2026-11-03', status: 'accepted' },
    { id: 'l3', toolId: 't5', borrowerId: 'u2', startDate: '2026-11-05', endDate: '2026-11-08', status: 'accepted' },
    { id: 'l4', toolId: 't6', borrowerId: 'u2', startDate: '2026-11-12', endDate: '2026-11-13', status: 'refused' },
  ];
  return createApp(data);
}

describe('GET /api/loans/mine (US-08)', () => {
  it('liste mes demandes avec leur statut', async () => {
    const res = await request(appAvecPrets()).get('/api/loans/mine').set('X-User-Id', 'u2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    for (const loan of res.body) {
      expect(loan).toHaveProperty('status');
    }
    expect(res.body.find((l) => l.id === 'l3')).toMatchObject({ status: 'accepted', toolName: 'Rouleau et bac à peinture' });
  });

  it('trie les demandes par date de début', async () => {
    const res = await request(appAvecPrets()).get('/api/loans/mine').set('X-User-Id', 'u2');
    expect(res.body.map((l) => l.startDate)).toEqual(['2026-11-05', '2026-11-12', '2026-11-20']);
  });

  it('ne renvoie que mes demandes', async () => {
    const res = await request(appAvecPrets()).get('/api/loans/mine').set('X-User-Id', 'u2');
    expect(res.body.every((l) => l.borrowerId === 'u2')).toBe(true);
    expect(res.body.map((l) => l.id)).not.toContain('l2');
  });

  it("renvoie une liste vide si je n'ai rien demandé", async () => {
    const res = await request(appAvecPrets()).get('/api/loans/mine').set('X-User-Id', 'u4');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('renvoie 401 sans X-User-Id', async () => {
    const res = await request(appAvecPrets()).get('/api/loans/mine');
    expect(res.status).toBe(401);
  });

  it("renvoie 401 si l'utilisateur est inconnu", async () => {
    const res = await request(appAvecPrets()).get('/api/loans/mine').set('X-User-Id', 'u99');
    expect(res.status).toBe(401);
  });
});
