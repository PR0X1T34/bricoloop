import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { formatError, plural, ratingText, statusLabel } from '../public/ui.js';

describe("Interface web du parcours d'emprunt (US-09)", () => {
  describe('depuis une page : profil, catalogue, fiche, demande', () => {
    it('sert la page web sur / avec le profil, le catalogue, la fiche et mes demandes', async () => {
      const res = await request(createApp()).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('id="profile"');
      expect(res.text).toContain('id="catalogue"');
      expect(res.text).toContain('id="detail"');
      expect(res.text).toContain('id="mine"');
      expect(res.text).toContain('src="/main.js"');
    });

    it('sert le script du parcours (catalogue → fiche → demande)', async () => {
      const res = await request(createApp()).get('/main.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
      expect(res.text).toContain("api('/api/tools')");
      expect(res.text).toContain('/api/tools/${');
      expect(res.text).toContain("api('/api/loans'");
    });

    it('fournit la liste des profils à choisir (GET /api/users)', async () => {
      const res = await request(createApp()).get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4);
      expect(res.body[0]).toEqual({ id: 'u1', firstName: 'Alice', district: 'Centre' });
    });

    it('affiche les statuts en français', () => {
      expect(statusLabel('available')).toBe('Disponible');
      expect(statusLabel('lent')).toBe('Prêté');
      expect(statusLabel('pending')).toBe('En attente');
    });
  });

  describe("les erreurs de l'API sont affichées en clair", () => {
    it("400 : affiche le message renvoyé par l'API", () => {
      expect(formatError(400, { error: 'La date de fin est antérieure à la date de début' })).toBe(
        'Demande invalide : La date de fin est antérieure à la date de début',
      );
    });

    it('409 : affiche le conflit de dates', () => {
      expect(formatError(409, { error: 'Ces dates chevauchent un prêt déjà accepté' })).toBe(
        'Impossible pour ces dates : Ces dates chevauchent un prêt déjà accepté',
      );
    });

    it('401 : invite à se connecter (US-18 : les profils sont devenus des comptes)', () => {
      expect(formatError(401, { error: 'Utilisateur non identifié' })).toMatch(/^Connecte-toi d'abord/);
    });

    it('accorde les mots et affiche la note moyenne', () => {
      expect(plural(1, 'outil')).toBe('1 outil');
      expect(plural(3, 'outil')).toBe('3 outils');
      expect(ratingText({ average: 4.5, count: 2 })).toBe('★ 4,5 (2 notes)');
      expect(ratingText(null)).toBe('pas encore noté');
    });

    it("reste lisible si l'API ne renvoie pas de message", () => {
      expect(formatError(500, null)).toBe('Erreur 500 : Erreur inattendue du serveur');
    });
  });
});

describe('Interface web : comptes, modification, photos (US-16 à US-18)', () => {
  it('propose la connexion et la création de compte', async () => {
    const page = await request(createApp()).get('/');
    expect(page.text).toContain('id="login-form"');
    expect(page.text).toContain('id="register-form"');
  });

  it('permet de modifier, supprimer et ajouter des photos depuis Mes outils', async () => {
    const script = await request(createApp()).get('/main.js');
    expect(script.text).toContain("method: 'PATCH'");
    expect(script.text).toContain("method: 'DELETE'");
    expect(script.text).toContain('/photos');
    expect(script.text).toContain("api('/api/auth/login'");
  });

  it('sert la feuille de style', async () => {
    const res = await request(createApp()).get('/style.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/css/);
  });
});

describe('Interface web : une page par onglet (US-20)', () => {
  it('a une page pour le catalogue, un outil, mes outils, mes demandes, les notifications, le compte et la connexion', async () => {
    const page = await request(createApp()).get('/');
    for (const name of ['catalogue', 'outil', 'modifier', 'proposer', 'mes-outils', 'demandes', 'notifications', 'compte', 'connexion', 'introuvable']) {
      expect(page.text).toContain(`data-page="${name}"`);
    }
  });

  it("affiche l'état d'un outil, ses réservations et permet d'annuler une demande", async () => {
    const script = await request(createApp()).get('/main.js');
    expect(script.text).toContain('tool.activity');
    expect(script.text).toContain('/cancel');
    expect(script.text).toContain("api('/api/auth/me/stats')");
  });
});
