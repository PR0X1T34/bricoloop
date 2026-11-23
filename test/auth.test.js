import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { DEMO_PASSWORD } from '../src/seed.js';

const compte = { email: 'Emma@Exemple.fr', password: 'motdepasse1', firstName: 'Emma', district: 'Saint-Michel' };
const strict = () => createApp(undefined, { allowUserIdHeader: false });

describe('Comptes et connexion (US-18)', () => {
  it('crée un compte et renvoie un jeton de session', async () => {
    const app = strict();
    const res = await request(app).post('/api/auth/register').send(compte);
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.user).toEqual({ id: 'u5', firstName: 'Emma', district: 'Saint-Michel', email: 'emma@exemple.fr' });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.firstName).toBe('Emma');
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    const app = strict();
    await request(app).post('/api/auth/register').send(compte);
    const user = app.locals.data.users.find((u) => u.email === 'emma@exemple.fr');
    expect(JSON.stringify(user)).not.toContain(compte.password);
    expect(user.passwordHash).toMatch(/^scrypt\$/);
  });

  it('valide chaque champ du formulaire (400 avec le champ en cause)', async () => {
    const app = strict();
    const cas = [
      [{ ...compte, email: 'pas-un-email' }, 'email'],
      [{ ...compte, password: 'court' }, 'password'],
      [{ ...compte, firstName: 'E' }, 'firstName'],
      [{ ...compte, district: '' }, 'district'],
    ];
    for (const [body, field] of cas) {
      const res = await request(app).post('/api/auth/register').send(body);
      expect(res.status).toBe(400);
      expect(res.body.field).toBe(field);
    }
  });

  it('refuse un e-mail déjà utilisé (409), sans tenir compte des majuscules', async () => {
    const app = strict();
    await request(app).post('/api/auth/register').send(compte);
    const res = await request(app).post('/api/auth/register').send({ ...compte, email: 'EMMA@exemple.fr' });
    expect(res.status).toBe(409);
  });

  it('connecte un compte de démo avec son mot de passe', async () => {
    const res = await request(strict()).post('/api/auth/login').send({ email: 'alice@bricoloop.test', password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Alice');
  });

  it('refuse un mauvais mot de passe ou un e-mail inconnu avec le même message (401)', async () => {
    const app = strict();
    const a = await request(app).post('/api/auth/login').send({ email: 'alice@bricoloop.test', password: 'faux-mot-de-passe' });
    const b = await request(app).post('/api/auth/login').send({ email: 'personne@bricoloop.test', password: DEMO_PASSWORD });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('la déconnexion invalide le jeton', async () => {
    const app = strict();
    const { body } = await request(app).post('/api/auth/login').send({ email: 'bruno@bricoloop.test', password: DEMO_PASSWORD });
    const auth = { Authorization: `Bearer ${body.token}` };
    await request(app).post('/api/auth/logout').set(auth);
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401);
  });

  it('le jeton permet de demander un emprunt', async () => {
    const app = strict();
    const { body } = await request(app).post('/api/auth/login').send({ email: 'bruno@bricoloop.test', password: DEMO_PASSWORD });
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-02' });
    expect(res.status).toBe(201);
    expect(res.body.borrowerId).toBe('u2');
  });

  it("en mode serveur réel, l'en-tête X-User-Id ne suffit plus (401)", async () => {
    const res = await request(strict())
      .post('/api/loans')
      .set('X-User-Id', 'u2')
      .send({ toolId: 't1', startDate: '2026-12-01', endDate: '2026-12-02' });
    expect(res.status).toBe(401);
  });

  it('un jeton inventé est refusé (401)', async () => {
    const res = await request(strict()).get('/api/auth/me').set('Authorization', `Bearer ${'a'.repeat(64)}`);
    expect(res.status).toBe(401);
  });

  it("n'expose jamais l'e-mail ni le mot de passe dans la liste publique des voisins", async () => {
    const res = await request(strict()).get('/api/users');
    expect(JSON.stringify(res.body)).not.toMatch(/email|password/);
  });
});
