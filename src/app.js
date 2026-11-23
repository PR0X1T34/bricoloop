import express from 'express';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, seedData } from './seed.js';
import { hashPassword, newToken, verifyPassword, SESSION_DAYS } from './auth.js';

// US-09 : dossier de l'interface web (servie sur /)
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const STATUS_ORDER = { available: 0, lent: 1, unavailable: 2 };


// Deux périodes [début, fin] se chevauchent si chacune commence avant la fin de l'autre (bornes incluses)
function overlaps(a, b) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
const NAME_MIN = 2;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 300;

// US-02 : renvoie { field, error } si invalide, sinon { value } (champs nettoyés)
function validateToolInput(body) {
  const { name, category, description } =
    body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
    return {
      field: 'name',
      error: `Le nom est obligatoire et doit contenir entre ${NAME_MIN} et ${NAME_MAX} caractères`,
    };
  }
  if (!CATEGORIES.includes(category)) {
    return {
      field: 'category',
      error: `La catégorie doit être l'une des suivantes : ${CATEGORIES.join(', ')}`,
    };
  }
  let cleanDescription = '';
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return { field: 'description', error: 'La description doit être un texte' };
    }
    cleanDescription = description.trim();
    if (cleanDescription.length > DESCRIPTION_MAX) {
      return {
        field: 'description',
        error: `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères`,
      };
    }
  }
  return { value: { name: cleanName, category, description: cleanDescription } };
}

function nextToolId(tools) {
  const max = tools.reduce((m, t) => Math.max(m, Number(String(t.id).slice(1)) || 0), 0);
  return `t${max + 1}`;
}

function isValidDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

// options.allowUserIdHeader : accepte l'en-tête X-User-Id de l'énoncé (tests, démo de l'API).
// Le serveur réel (src/server.js) le désactive : il faut alors un compte et un jeton de session.
// options.onChange : appelé après chaque requête qui modifie les données (sauvegarde sur disque).
export function createApp(data = seedData(), options = {}) {
  const allowUserIdHeader = options.allowUserIdHeader ?? true;
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.static(PUBLIC_DIR));
  app.locals.data = data;
  data.sessions ??= [];
  data.photos ??= [];

  if (options.onChange) {
    app.use((req, res, next) => {
      if (req.method !== 'GET') res.on('finish', () => res.statusCode < 400 && options.onChange(data));
      next();
    });
  }

  // Utilisateur courant : jeton « Authorization: Bearer … », ou X-User-Id si autorisé
  const sessionFor = (req) => {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') ?? '');
    if (!match) return null;
    const session = data.sessions.find((s) => s.token === match[1]);
    if (!session) return null;
    if (Date.now() - Date.parse(session.createdAt) > SESSION_DAYS * 86400000) {
      data.sessions = data.sessions.filter((s) => s !== session);
      return null;
    }
    return session;
  };
  const currentUser = (req) => {
    const session = sessionFor(req);
    if (session) return data.users.find((u) => u.id === session.userId) ?? null;
    if (allowUserIdHeader) return data.users.find((u) => u.id === req.get('X-User-Id')) ?? null;
    return null;
  };
  const publicUser = ({ id, firstName, district, email }) => ({ id, firstName, district, email });

  // US-15 : notifications (en mémoire, comme le reste des données)
  data.notifications ??= [];
  const notify = (userId, type, loan, message) => {
    data.notifications.push({
      id: `n${data.notifications.length + 1}`,
      userId,
      type,
      loanId: loan.id,
      toolId: loan.toolId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    });
  };

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // US-09 : liste des profils pour le sélecteur de l'interface web
  app.get('/api/users', (req, res) => {
    res.status(200).json(data.users.map(({ id, firstName, district }) => ({ id, firstName, district })));
  });

  // US-04 : demander l'emprunt d'un outil
  app.post('/api/loans', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const { toolId, startDate, endDate, message } = req.body ?? {};
    const tool = data.tools.find((t) => t.id === toolId);
    if (!tool) {
      return res.status(404).json({ error: 'Outil introuvable' });
    }
    // US-20 : petit mot facultatif pour le propriétaire
    if (message !== undefined && message !== null && (typeof message !== 'string' || message.trim().length > 300)) {
      return res.status(400).json({ error: 'Le message ne doit pas dépasser 300 caractères', field: 'message' });
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({ error: 'Dates invalides (format AAAA-MM-JJ)' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'La date de fin est antérieure à la date de début' });
    }
    if (tool.ownerId === user.id) {
      return res.status(400).json({ error: 'Impossible de demander son propre outil' });
    }
    if (tool.status === 'unavailable') {
      return res.status(400).json({ error: "L'outil n'est pas disponible" });
    }
    // US-06 : pas de chevauchement avec un prêt déjà accepté
    const conflict = data.loans.some(
      (l) => l.toolId === tool.id && l.status === 'accepted' && overlaps(l, { startDate, endDate }),
    );
    if (conflict) {
      return res.status(409).json({ error: 'Ces dates chevauchent un prêt déjà accepté' });
    }
    const loan = {
      id: `l${data.loans.length + 1}`,
      toolId: tool.id,
      borrowerId: user.id,
      startDate,
      endDate,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    if (typeof message === 'string' && message.trim()) loan.message = message.trim();
    data.loans.push(loan);
    // US-15 : le propriétaire est prévenu qu'on veut emprunter son outil
    notify(
      tool.ownerId,
      'loan_requested',
      loan,
      `${user.firstName} veut emprunter « ${tool.name} » du ${startDate} au ${endDate}.`,
    );
    res.status(201).json(loan);
  });

  // US-05 : accepter ou refuser une demande
  const DECISIONS = { accept: 'accepted', refuse: 'refused' };

  app.post('/api/loans/:id/:decision', (req, res, next) => {
    const newStatus = DECISIONS[req.params.decision];
    if (!newStatus) {
      return next();
    }
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loan = data.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }
    const tool = data.tools.find((t) => t.id === loan.toolId);
    if (!tool || tool.ownerId !== user.id) {
      return res.status(403).json({ error: "Seul le propriétaire de l'outil peut répondre" });
    }
    if (loan.status !== 'pending') {
      return res.status(409).json({ error: "Cette demande n'est plus en attente" });
    }
    // US-06 : on ne peut pas accepter deux prêts qui se chevauchent
    const conflictOnAccept =
      newStatus === 'accepted' &&
      data.loans.some(
        (l) => l.id !== loan.id && l.toolId === loan.toolId && l.status === 'accepted' && overlaps(l, loan),
      );
    if (conflictOnAccept) {
      return res.status(409).json({ error: 'Ces dates chevauchent un prêt déjà accepté' });
    }
    loan.status = newStatus;
    if (newStatus === 'accepted') {
      tool.status = 'lent';
    }
    // US-15 : l'emprunteur est prévenu de la réponse du propriétaire
    notify(
      loan.borrowerId,
      newStatus === 'accepted' ? 'loan_accepted' : 'loan_refused',
      loan,
      `${user.firstName} a ${newStatus === 'accepted' ? 'accepté' : 'refusé'} ta demande pour « ${tool.name} » du ${loan.startDate} au ${loan.endDate}.`,
    );
    res.status(200).json({ ...loan, toolStatus: tool.status });
  });

  // US-15 : mes notifications, les plus récentes d'abord, avec le nombre de non lues
  app.get('/api/notifications', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const items = data.notifications
      .filter((n) => n.userId === user.id)
      .map((n) => {
        const loan = data.loans.find((l) => l.id === n.loanId);
        return { ...n, loanStatus: loan ? loan.status : null, loanMessage: loan?.message ?? null };
      })
      .reverse();
    res.status(200).json({ unread: items.filter((n) => !n.read).length, items });
  });

  // US-15 : marquer toutes mes notifications comme lues
  app.post('/api/notifications/read', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    for (const n of data.notifications) {
      if (n.userId === user.id) n.read = true;
    }
    res.status(200).json({ unread: 0 });
  });

  // US-18 : créer un compte, se connecter, se déconnecter
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const openSession = (user) => {
    const token = newToken();
    data.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    return { token, user: publicUser(user) };
  };

  app.post('/api/auth/register', (req, res) => {
    const { email, password, firstName, district } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof firstName === 'string' ? firstName.trim() : '';
    const cleanDistrict = typeof district === 'string' ? district.trim() : '';
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 120) {
      return res.status(400).json({ error: "L'adresse e-mail n'est pas valide", field: 'email' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir entre 8 et 128 caractères', field: 'password' });
    }
    if (cleanName.length < 2 || cleanName.length > 40) {
      return res.status(400).json({ error: 'Le prénom doit contenir entre 2 et 40 caractères', field: 'firstName' });
    }
    if (cleanDistrict.length < 2 || cleanDistrict.length > 40) {
      return res.status(400).json({ error: 'Le quartier doit contenir entre 2 et 40 caractères', field: 'district' });
    }
    if (data.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail', field: 'email' });
    }
    const max = data.users.reduce((m, u) => Math.max(m, Number(String(u.id).slice(1)) || 0), 0);
    const user = {
      id: `u${max + 1}`,
      firstName: cleanName,
      district: cleanDistrict,
      email: cleanEmail,
      passwordHash: hashPassword(password),
    };
    data.users.push(user);
    res.status(201).json(openSession(user));
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const user = data.users.find((u) => u.email === cleanEmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
    }
    res.status(200).json(openSession(user));
  });

  app.post('/api/auth/logout', (req, res) => {
    const session = sessionFor(req);
    if (session) data.sessions = data.sessions.filter((s) => s !== session);
    res.status(200).json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    res.status(200).json(publicUser(user));
  });

  // US-16 : modifier un outil que je prête (champs envoyés seulement)
  const ownTool = (req, res) => {
    const user = currentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Utilisateur non identifié' });
      return null;
    }
    const tool = data.tools.find((t) => t.id === req.params.id);
    if (!tool) {
      res.status(404).json({ error: 'Outil introuvable' });
      return null;
    }
    if (tool.ownerId !== user.id) {
      res.status(403).json({ error: 'Seul le propriétaire peut modifier cet outil' });
      return null;
    }
    return { user, tool };
  };

  app.patch('/api/tools/:id', (req, res) => {
    const found = ownTool(req, res);
    if (!found) return;
    const { tool } = found;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = validateToolInput({
      name: body.name ?? tool.name,
      category: body.category ?? tool.category,
      description: body.description ?? tool.description,
    });
    if (result.error) {
      return res.status(400).json({ error: result.error, field: result.field });
    }
    if (body.status !== undefined) {
      if (!['available', 'unavailable'].includes(body.status)) {
        return res.status(400).json({ error: 'Le statut doit être « available » ou « unavailable »', field: 'status' });
      }
      if (tool.status === 'lent') {
        return res.status(409).json({ error: "L'outil est prêté : déclarez d'abord son retour" });
      }
      tool.status = body.status;
    }
    Object.assign(tool, result.value);
    res.status(200).json(toolView(tool));
  });

  // US-16 : retirer un outil du prêt
  app.delete('/api/tools/:id', (req, res) => {
    const found = ownTool(req, res);
    if (!found) return;
    const { user, tool } = found;
    if (data.loans.some((l) => l.toolId === tool.id && l.status === 'accepted')) {
      return res.status(409).json({ error: "L'outil est prêté en ce moment : déclarez d'abord son retour" });
    }
    for (const loan of data.loans.filter((l) => l.toolId === tool.id)) {
      loan.toolName = tool.name;
      if (loan.status === 'pending') {
        loan.status = 'refused';
        notify(loan.borrowerId, 'loan_refused', loan, `${user.firstName} a retiré « ${tool.name} » du prêt : ta demande est annulée.`);
      }
    }
    data.photos = data.photos.filter((ph) => ph.toolId !== tool.id);
    data.tools = data.tools.filter((t) => t !== tool);
    res.status(204).end();
  });

  // US-17 : photos des outils (JPEG, PNG, WebP ou GIF, 2 Mo maximum, 4 par outil)
  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
  const PHOTOS_PER_TOOL = 4;
  const photoUrl = (photo) => `/api/photos/${photo.id}`;
  const toolPhotos = (tool) => data.photos.filter((ph) => ph.toolId === tool.id);
  const toolView = (tool) => {
    const owner = data.users.find((u) => u.id === tool.ownerId);
    return {
      id: tool.id,
      ownerId: tool.ownerId,
      name: tool.name,
      category: tool.category,
      description: tool.description ?? '',
      status: tool.status,
      photos: toolPhotos(tool).map((ph) => ({ id: ph.id, url: photoUrl(ph) })),
      owner: owner ? { firstName: owner.firstName, district: owner.district } : null,
      createdAt: tool.createdAt ?? null,
      activity: toolActivity(tool),
    };
  };
  // US-20 : état d'usage public d'un outil (sans le nom des emprunteurs)
  const toolActivity = (tool) => {
    const today = new Date().toISOString().slice(0, 10);
    const loans = data.loans.filter((l) => l.toolId === tool.id);
    const done = loans.filter((l) => l.status === 'returned');
    const bookings = loans
      .filter((l) => l.status === 'accepted' && l.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(({ startDate, endDate }) => ({ startDate, endDate }));
    const scores = done.filter((l) => l.rating).length;
    return {
      timesLent: loans.filter((l) => l.status === 'accepted' || l.status === 'returned').length,
      timesReturned: done.length,
      pendingRequests: loans.filter((l) => l.status === 'pending').length,
      lastReturnedOn: done.map((l) => l.endDate).sort().pop() ?? null,
      bookings,
      ratedLoans: scores,
    };
  };

  app.post('/api/tools/:id/photos', (req, res) => {
    const found = ownTool(req, res);
    if (!found) return;
    const { tool } = found;
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl ?? '');
    if (!match || !PHOTO_TYPES.includes(match[1])) {
      return res.status(400).json({ error: 'La photo doit être une image JPEG, PNG, WebP ou GIF', field: 'dataUrl' });
    }
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) {
      return res.status(400).json({ error: 'La photo doit peser moins de 2 Mo', field: 'dataUrl' });
    }
    if (toolPhotos(tool).length >= PHOTOS_PER_TOOL) {
      return res.status(409).json({ error: `Un outil a au maximum ${PHOTOS_PER_TOOL} photos` });
    }
    const max = data.photos.reduce((m, ph) => Math.max(m, Number(String(ph.id).slice(1)) || 0), 0);
    const photo = { id: `p${max + 1}`, toolId: tool.id, mime: match[1], data: match[2] };
    data.photos.push(photo);
    res.status(201).json({ id: photo.id, url: photoUrl(photo) });
  });

  app.delete('/api/tools/:id/photos/:photoId', (req, res) => {
    const found = ownTool(req, res);
    if (!found) return;
    const photo = data.photos.find((ph) => ph.id === req.params.photoId && ph.toolId === found.tool.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo introuvable' });
    }
    data.photos = data.photos.filter((ph) => ph !== photo);
    res.status(204).end();
  });

  app.get('/api/photos/:photoId', (req, res) => {
    const photo = data.photos.find((ph) => ph.id === req.params.photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo introuvable' });
    }
    res
      .status(200)
      .set({ 'Content-Type': photo.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400' })
      .send(Buffer.from(photo.data, 'base64'));
  });

  // US-01 : consulter le catalogue des outils
  // US-11 : ?q=mot-clé cherche dans le nom et la description (sans tenir compte des majuscules)
  // US-10 : ?category=Perçage ne garde que les outils de cette catégorie (400 si inconnue)
  app.get('/api/tools', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = req.query.category;
    if (category !== undefined && !CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Catégorie inconnue. Catégories autorisées : ${CATEGORIES.join(', ')}`,
        field: 'category',
      });
    }
    const tools = data.tools
      .filter((t) => category === undefined || t.category === category)
      .filter(
        (t) => !q || t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      .map((t) => {
        const first = toolPhotos(t)[0];
        const owner = data.users.find((u) => u.id === t.ownerId);
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          status: t.status,
          photo: first ? photoUrl(first) : null,
          district: owner?.district ?? null,
          createdAt: t.createdAt ?? null,
        };
      });
    res.status(200).json(tools);
  });

  // US-02 : proposer un outil au prêt
  app.post('/api/tools', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const result = validateToolInput(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error, field: result.field });
    }
    const tool = {
      id: nextToolId(data.tools),
      ownerId: user.id,
      ...result.value,
      status: 'available',
      createdAt: new Date().toISOString(),
    };
    data.tools.push(tool);
    res.status(201).location(`/api/tools/${tool.id}`).json(tool);
  });

  // US-13 : note moyenne d'un emprunteur (null s'il n'a jamais été noté)
  const borrowerRating = (userId) => {
    const scores = data.loans.filter((l) => l.borrowerId === userId && l.rating).map((l) => l.rating);
    if (scores.length === 0) return null;
    const average = scores.reduce((s, n) => s + n, 0) / scores.length;
    return { average: Math.round(average * 10) / 10, count: scores.length };
  };
  const loanView = (l) => {
    const borrower = data.users.find((u) => u.id === l.borrowerId);
    return {
      id: l.id,
      startDate: l.startDate,
      endDate: l.endDate,
      status: l.status,
      message: l.message ?? null,
      rating: l.rating ?? null,
      borrower: borrower
        ? { id: borrower.id, firstName: borrower.firstName, district: borrower.district, rating: borrowerRating(borrower.id) }
        : null,
    };
  };

  // US-12 : mes outils, avec le nombre de demandes en attente et le prêt en cours
  app.get('/api/tools/mine', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const tools = data.tools
      .filter((t) => t.ownerId === user.id)
      .map((t) => {
        const loans = data.loans.filter((l) => l.toolId === t.id);
        const pending = loans
          .filter((l) => l.status === 'pending')
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .map(loanView);
        const current = loans.find((l) => l.status === 'accepted');
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          description: t.description ?? '',
          status: t.status,
          photos: toolPhotos(t).map((ph) => ({ id: ph.id, url: photoUrl(ph) })),
          pendingRequests: pending.length,
          requests: pending,
          currentLoan: current ? loanView(current) : null,
        };
      });
    res.status(200).json(tools);
  });

  // US-14 : historique des prêts d'un outil (acceptés et rendus), du plus récent au plus ancien
  app.get('/api/tools/:id/history', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const tool = data.tools.find((t) => t.id === req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Outil introuvable' });
    }
    if (tool.ownerId !== user.id) {
      return res.status(403).json({ error: "Seul le propriétaire peut voir l'historique de ses prêts" });
    }
    const history = data.loans
      .filter((l) => l.toolId === tool.id && (l.status === 'accepted' || l.status === 'returned'))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(loanView);
    res.status(200).json(history);
  });

  // US-13 : noter l'emprunteur après le retour (1 à 5, une seule note par prêt)
  app.post('/api/loans/:id/rating', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loan = data.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Prêt introuvable' });
    }
    const tool = data.tools.find((t) => t.id === loan.toolId);
    if (!tool || tool.ownerId !== user.id) {
      return res.status(403).json({ error: "Seul le propriétaire de l'outil peut noter l'emprunteur" });
    }
    const score = req.body?.score;
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'La note doit être un nombre entier de 1 à 5', field: 'score' });
    }
    if (loan.status !== 'returned') {
      return res.status(409).json({ error: 'On ne peut noter qu’un prêt rendu' });
    }
    if (loan.rating) {
      return res.status(409).json({ error: 'Ce prêt a déjà été noté' });
    }
    loan.rating = score;
    notify(loan.borrowerId, 'loan_rated', loan, `${user.firstName} t'a donné ${score}/5 pour l'emprunt de « ${tool.name} ».`);
    res.status(200).json(loanView(loan));
  });

  // US-08 : voir mes demandes et mes emprunts
  app.get('/api/loans/mine', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loans = data.loans
      .filter((l) => l.borrowerId === user.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((l) => {
        const tool = data.tools.find((t) => t.id === l.toolId);
        const owner = tool && data.users.find((u) => u.id === tool.ownerId);
        const photo = tool && toolPhotos(tool)[0];
        return {
          ...l,
          toolName: tool?.name ?? l.toolName ?? null,
          toolExists: Boolean(tool),
          toolPhoto: photo ? photoUrl(photo) : null,
          owner: owner ? { firstName: owner.firstName, district: owner.district } : null,
        };
      });
    res.status(200).json(loans);
  });

  // US-03 : voir le détail d'un outil
  app.get('/api/tools/:id', (req, res) => {
    const tool = data.tools.find((t) => t.id === req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Outil introuvable' });
    }
    res.status(200).json(toolView(tool));
  });

  // US-20 : l'emprunteur annule sa demande tant qu'elle est en attente
  app.post('/api/loans/:id/cancel', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loan = data.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }
    if (loan.borrowerId !== user.id) {
      return res.status(403).json({ error: 'Seul le demandeur peut annuler sa demande' });
    }
    if (loan.status !== 'pending') {
      return res.status(409).json({ error: "Seule une demande en attente peut être annulée" });
    }
    loan.status = 'cancelled';
    const tool = data.tools.find((t) => t.id === loan.toolId);
    if (tool) {
      notify(tool.ownerId, 'loan_cancelled', loan, `${user.firstName} a annulé sa demande pour « ${tool.name} » du ${loan.startDate} au ${loan.endDate}.`);
    }
    res.status(200).json(loan);
  });

  // US-20 : modifier mon profil (prénom, quartier)
  app.patch('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const { firstName, district } = req.body ?? {};
    const changes = {};
    for (const [field, value, label] of [['firstName', firstName, 'Le prénom'], ['district', district, 'Le quartier']]) {
      if (value === undefined) continue;
      const clean = typeof value === 'string' ? value.trim() : '';
      if (clean.length < 2 || clean.length > 40) {
        return res.status(400).json({ error: `${label} doit contenir entre 2 et 40 caractères`, field });
      }
      changes[field] = clean;
    }
    Object.assign(user, changes);
    res.status(200).json(publicUser(user));
  });

  // US-20 : changer de mot de passe (les autres sessions sont fermées)
  app.post('/api/auth/password', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const { currentPassword, newPassword } = req.body ?? {};
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Le mot de passe actuel est incorrect', field: 'currentPassword' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir entre 8 et 128 caractères', field: 'newPassword' });
    }
    user.passwordHash = hashPassword(newPassword);
    const current = sessionFor(req);
    data.sessions = data.sessions.filter((s) => s.userId !== user.id || s === current);
    res.status(200).json({ ok: true });
  });

  // US-20 : mes chiffres (outils, prêts donnés et reçus, note moyenne)
  app.get('/api/auth/me/stats', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const myToolIds = new Set(data.tools.filter((t) => t.ownerId === user.id).map((t) => t.id));
    const lentOrDone = (l) => l.status === 'accepted' || l.status === 'returned';
    res.status(200).json({
      tools: myToolIds.size,
      loansGiven: data.loans.filter((l) => myToolIds.has(l.toolId) && lentOrDone(l)).length,
      loansReceived: data.loans.filter((l) => l.borrowerId === user.id && lentOrDone(l)).length,
      pendingReceived: data.loans.filter((l) => myToolIds.has(l.toolId) && l.status === 'pending').length,
      pendingSent: data.loans.filter((l) => l.borrowerId === user.id && l.status === 'pending').length,
      rating: borrowerRating(user.id),
    });
  });

  // US-07 : déclarer le retour d'un outil
  app.post('/api/loans/:id/return', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non identifié' });
    }
    const loan = data.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Prêt introuvable' });
    }
    const tool = data.tools.find((t) => t.id === loan.toolId);
    if (!tool || tool.ownerId !== user.id) {
      return res.status(403).json({ error: "Seul le propriétaire de l'outil peut déclarer le retour" });
    }
    if (loan.status !== 'accepted') {
      return res.status(409).json({ error: "Seul un prêt accepté peut être déclaré rendu" });
    }
    loan.status = 'returned';
    tool.status = 'available';
    notify(loan.borrowerId, 'loan_returned', loan, `${user.firstName} a confirmé le retour de « ${tool.name} ». Merci !`);
    res.status(200).json({ ...loan, toolStatus: tool.status });
  });

  return app;
}
