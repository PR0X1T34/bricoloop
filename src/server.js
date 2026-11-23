import { createApp } from './app.js';
import { autoSaver, loadData } from './store.js';

const port = process.env.PORT || 3000;
// US-19 : données conservées entre deux redémarrages (DATA_FILE=memory pour tout garder en mémoire)
const file = process.env.DATA_FILE || 'data/bricoloop.json';
const persist = file !== 'memory';

// US-18 : sur le vrai serveur, il faut un compte ; X-User-Id seulement si ALLOW_USER_ID_HEADER=1
const app = createApp(persist ? loadData(file) : undefined, {
  allowUserIdHeader: process.env.ALLOW_USER_ID_HEADER === '1',
  onChange: persist ? autoSaver(file) : undefined,
});

app.listen(port, () => {
  console.log(`BricoLoop sur http://localhost:${port}${persist ? ` (données : ${file})` : ''}`);
});
