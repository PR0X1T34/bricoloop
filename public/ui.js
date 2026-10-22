// US-09 : fonctions d'affichage, sans DOM (testées dans test/ui.test.js)

export const STATUS_LABELS = {
  available: 'Disponible',
  lent: 'Prêté',
  unavailable: 'Indisponible',
  pending: 'En attente',
  accepted: 'Acceptée',
  refused: 'Refusée',
  returned: 'Rendu',
};

const ERROR_TITLES = {
  400: 'Demande invalide',
  401: "Choisis d'abord ton profil",
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
