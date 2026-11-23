import { hashPassword } from './auth.js';

// Comptes de démo : mot de passe commun (calculé une seule fois au chargement)
export const DEMO_PASSWORD = 'bricoloop';
const DEMO_HASH = hashPassword(DEMO_PASSWORD);

export const CATEGORIES = ['Perçage', 'Jardinage', 'Peinture', 'Nettoyage', 'Mesure', 'Autre'];

export function seedData() {
  return {
    users: [
      { id: 'u1', firstName: 'Alice', district: 'Centre', email: 'alice@bricoloop.test', passwordHash: DEMO_HASH },
      { id: 'u2', firstName: 'Bruno', district: 'Gare', email: 'bruno@bricoloop.test', passwordHash: DEMO_HASH },
      { id: 'u3', firstName: 'Chloé', district: 'Vieux Port', email: 'chloe@bricoloop.test', passwordHash: DEMO_HASH },
      { id: 'u4', firstName: 'Driss', district: 'Les Halles', email: 'driss@bricoloop.test', passwordHash: DEMO_HASH },
    ],
    tools: [
      { id: 't1', ownerId: 'u1', name: 'Perceuse à percussion', category: 'Perçage', description: 'Bosch 750 W, coffret de forets inclus', status: 'available' },
      { id: 't2', ownerId: 'u1', name: 'Niveau laser', category: 'Mesure', description: 'Portée 15 m', status: 'available' },
      { id: 't3', ownerId: 'u2', name: 'Taille-haie électrique', category: 'Jardinage', description: 'Lame 50 cm', status: 'available' },
      { id: 't4', ownerId: 'u2', name: 'Tondeuse', category: 'Jardinage', description: 'Thermique, bac 60 L', status: 'unavailable' },
      { id: 't5', ownerId: 'u3', name: 'Rouleau et bac à peinture', category: 'Peinture', description: 'Kit complet murs et plafonds', status: 'available' },
      { id: 't6', ownerId: 'u3', name: 'Nettoyeur haute pression', category: 'Nettoyage', description: 'Kärcher 130 bars', status: 'available' },
      { id: 't7', ownerId: 'u4', name: 'Visseuse sans fil', category: 'Perçage', description: '18 V, 2 batteries', status: 'available' },
      { id: 't8', ownerId: 'u4', name: 'Échelle télescopique', category: 'Autre', description: '3,80 m', status: 'available' },
    ],
    loans: [],
  };
}
