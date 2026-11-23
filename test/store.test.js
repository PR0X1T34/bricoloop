import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { loadData, saveData } from '../src/store.js';

let dir;
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

describe('Sauvegarde dans un fichier JSON (US-19)', () => {
  it('repart des données de démo si le fichier n\'existe pas', () => {
    dir = mkdtempSync(join(tmpdir(), 'bricoloop-'));
    const data = loadData(join(dir, 'absent.json'));
    expect(data.tools).toHaveLength(8);
  });

  it('retrouve après redémarrage un outil créé et un compte inscrit', async () => {
    dir = mkdtempSync(join(tmpdir(), 'bricoloop-'));
    const file = join(dir, 'db.json');
    const app = createApp(loadData(file), { onChange: (d) => saveData(file, d) });
    await request(app).post('/api/tools').set('X-User-Id', 'u1').send({ name: 'Ponceuse', category: 'Peinture' });
    await request(app).post('/api/auth/register').send({ email: 'emma@exemple.fr', password: 'motdepasse1', firstName: 'Emma', district: 'Port' });

    const restarted = createApp(loadData(file), { allowUserIdHeader: false });
    const catalogue = await request(restarted).get('/api/tools');
    expect(catalogue.body.map((t) => t.name)).toContain('Ponceuse');
    const login = await request(restarted).post('/api/auth/login').send({ email: 'emma@exemple.fr', password: 'motdepasse1' });
    expect(login.status).toBe(200);
  });

  it("n'écrit rien quand la requête échoue", async () => {
    dir = mkdtempSync(join(tmpdir(), 'bricoloop-'));
    const file = join(dir, 'db.json');
    const app = createApp(loadData(file), { onChange: (d) => saveData(file, d) });
    await request(app).post('/api/tools').set('X-User-Id', 'u1').send({ name: 'X', category: 'Peinture' });
    expect(() => readFileSync(file)).toThrow();
  });
});
