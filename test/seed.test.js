import { describe, it, expect } from 'vitest';
import { seedData, CATEGORIES } from '../src/seed.js';

describe('Données de démo (T-03)', () => {
  const data = seedData();

  it('contient 4 voisins et 8 outils', () => {
    expect(data.users).toHaveLength(4);
    expect(data.tools).toHaveLength(8);
  });

  it('couvre au moins 3 catégories autorisées', () => {
    const cats = new Set(data.tools.map((t) => t.category));
    expect(cats.size).toBeGreaterThanOrEqual(3);
    for (const c of cats) expect(CATEGORIES).toContain(c);
  });
});
