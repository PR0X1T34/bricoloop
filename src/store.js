// US-19 : sauvegarde des données dans un fichier JSON (l'énoncé autorise mémoire ou fichier JSON)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedData } from './seed.js';

export function loadData(file) {
  if (!existsSync(file)) return seedData();
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const key of ['users', 'tools', 'loans']) {
    if (!Array.isArray(data[key])) throw new Error(`Fichier de données invalide : « ${key} » manquant dans ${file}`);
  }
  return data;
}

export function saveData(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, file);
}

// Regroupe les écritures rapprochées en une seule
export function autoSaver(file, delayMs = 200) {
  let timer = null;
  return (data) => {
    clearTimeout(timer);
    timer = setTimeout(() => saveData(file, data), delayMs);
  };
}
