import process from 'node:process';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function startServer(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await app.close();
        process.exit(0);
      } catch (err) {
        app.log.error(err, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  try {
    const address = await app.listen({ host: config.host, port: config.port });
    app.log.info(`Server listening on ${address}`);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
