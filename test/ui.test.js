import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { formatError, statusLabel } from '../public/ui.js';

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

    it('401 : invite à choisir son profil', () => {
      expect(formatError(401, { error: 'Utilisateur non identifié' })).toMatch(/^Choisis d'abord ton profil/);
    });

    it("reste lisible si l'API ne renvoie pas de message", () => {
      expect(formatError(500, null)).toBe('Erreur 500 : Erreur inattendue du serveur');
    });
  });
});
