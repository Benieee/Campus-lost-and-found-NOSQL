import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { createApp } from './app';
import { seedDatabase } from './seed/seed';

async function bootstrap() {
  await connectDatabase();
  if (process.env.AUTO_SEED_DEMO === 'true') {
    await seedDatabase({ reset: false });
  }
  const app = createApp();

  const server = app.listen(env.port, env.host, () => {
    console.log(`Bugema Campus Lost & Found API listening on http://${env.host}:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error instanceof Error ? error.message : error);
  process.exit(1);
});
