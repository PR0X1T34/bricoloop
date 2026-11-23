// US-09 : fonctions d'affichage, sans DOM (testées dans test/ui.test.js)

export const STATUS_LABELS = {
  available: 'Disponible',
  lent: 'Prêté',
  unavailable: 'Indisponible',
  pending: 'En attente',
  accepted: 'Acceptée',
  refused: 'Refusée',
  returned: 'Rendu',
  cancelled: 'Annulée',
};

const ERROR_TITLES = {
  400: 'Demande invalide',
  401: "Connecte-toi d'abord",
  403: 'Action non autorisée',
  404: 'Introuvable',
  409: 'Impossible pour ces dates',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

// Transforme une réponse d'erreur de l'API en message lisible pour l'utilisateur
export function formatError(status, body) {
  const title = ERROR_TITLES[status] ?? `Erreur ${status}`;
  const detail = body && typeof body.error === 'string' ? body.error : 'Erreur inattendue du serveur';
  return `${title} : ${detail}`;
}

// « 1 outil », « 3 outils »
export function plural(n, word) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

// US-13 : note moyenne d'un emprunteur, ex. « ★ 4,5 (2 notes) »
export function ratingText(rating) {
  if (!rating) return 'pas encore noté';
  return `★ ${String(rating.average).replace('.', ',')} (${plural(rating.count, 'note')})`;
}
