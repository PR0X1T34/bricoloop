import express from 'express';
import { seedData } from './seed.js';

export function createApp(data = seedData()) {
  const app = express();
  app.use(express.json());
  app.locals.data = data;

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
