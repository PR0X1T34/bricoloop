import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

function chercher(q) {
  return request(createApp()).get('/api/tools').query({ q });
}

describe('GET /api/tools?q= (US-11)', () => {
  it('trouve un outil par son nom', async () => {
    const res = await chercher('tondeuse');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.id)).toEqual(['t4']);
  });

  it('cherche aussi dans la description', async () => {
    const res = await chercher('batteries');
    expect(res.body.map((t) => t.id)).toEqual(['t7']);
  });

  it('ne tient pas compte des majuscules', async () => {
    const minuscules = await chercher('perceuse');
    const majuscules = await chercher('PERCEUSE');
    expect(minuscules.body.map((t) => t.id)).toEqual(['t1']);
    expect(majuscules.body).toEqual(minuscules.body);
  });

  it('renvoie tous les outils qui correspondent', async () => {
    const res = await chercher('à');
    const ids = res.body.map((t) => t.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t5');
    expect(ids).not.toContain('t2');
  });

  it('renvoie une liste vide si rien ne correspond', async () => {
    const res = await chercher('tronçonneuse');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('renvoie tout le catalogue si le mot-clé est vide', async () => {
    const res = await chercher('  ');
    expect(res.body).toHaveLength(8);
  });

  it('garde les outils disponibles en premier', async () => {
    const res = await chercher('e');
    const statuses = res.body.map((t) => t.status);
    const firstNotAvailable = statuses.findIndex((s) => s !== 'available');
    expect(firstNotAvailable).toBeGreaterThan(-1);
    expect(statuses.slice(firstNotAvailable)).not.toContain('available');
  });
});
