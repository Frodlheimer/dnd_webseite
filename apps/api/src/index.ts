import 'dotenv/config';

import { buildServer } from './server.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const start = async (): Promise<void> => {
  const app = await buildServer();

  try {
    await app.listen({
      host,
      port
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
