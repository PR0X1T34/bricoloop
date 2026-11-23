import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

// Plus petit PNG valide (1 × 1 pixel)
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const png = `data:image/png;base64,${PNG}`;
const ajouter = (app, dataUrl = png, user = 'u1', tool = 't1') =>
  request(app).post(`/api/tools/${tool}/photos`).set('X-User-Id', user).send({ dataUrl });

describe('Photos des outils (US-17)', () => {
  it('ajoute une photo et la sert avec le bon type', async () => {
    const app = createApp();
    const res = await ajouter(app);
    expect(res.status).toBe(201);
    const img = await request(app).get(res.body.url);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(img.body, Buffer.from(PNG, 'base64'))).toBe(0);
  });

  it('montre la photo dans le catalogue et toutes les photos dans la fiche', async () => {
    const app = createApp();
    const a = await ajouter(app);
    await ajouter(app);
    const catalogue = await request(app).get('/api/tools');
    expect(catalogue.body.find((t) => t.id === 't1').photo).toBe(a.body.url);
    expect(catalogue.body.find((t) => t.id === 't2').photo).toBeNull();
    const fiche = await request(app).get('/api/tools/t1');
    expect(fiche.body.photos).toHaveLength(2);
  });

  it("refuse ce qui n'est pas une image autorisée (400), SVG compris", async () => {
    const app = createApp();
    expect((await ajouter(app, 'pas une image')).status).toBe(400);
    expect((await ajouter(app, `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).status).toBe(400);
    expect((await ajouter(app, `data:text/html;base64,${PNG}`)).status).toBe(400);
  });

  it('refuse une photo de plus de 2 Mo (400)', async () => {
    const big = `data:image/jpeg;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')}`;
    expect((await ajouter(createApp(), big)).status).toBe(400);
  });

  it('limite à 4 photos par outil (409)', async () => {
    const app = createApp();
    for (let i = 0; i < 4; i += 1) expect((await ajouter(app)).status).toBe(201);
    expect((await ajouter(app)).status).toBe(409);
  });

  it('supprime une photo', async () => {
    const app = createApp();
    const { body } = await ajouter(app);
    const res = await request(app).delete(`/api/tools/t1/photos/${body.id}`).set('X-User-Id', 'u1');
    expect(res.status).toBe(204);
    expect((await request(app).get(body.url)).status).toBe(404);
  });

  it("seul le propriétaire ajoute ou retire des photos (403)", async () => {
    const app = createApp();
    expect((await ajouter(app, png, 'u2')).status).toBe(403);
    const { body } = await ajouter(app);
    expect((await request(app).delete(`/api/tools/t1/photos/${body.id}`).set('X-User-Id', 'u2')).status).toBe(403);
  });

  it("supprimer l'outil supprime ses photos", async () => {
    const app = createApp();
    const { body } = await ajouter(app, png, 'u1', 't2');
    await request(app).delete('/api/tools/t2').set('X-User-Id', 'u1');
    expect((await request(app).get(body.url)).status).toBe(404);
  });
});
