import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { seedDatabase } from '../src/seed/seed';

async function runDemo() {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await connectDatabase(uri);
  await seedDatabase({ reset: true });

  const app = createApp();
  const server = app.listen(env.port, env.host, () => {
    console.log(`[Demo Mode] In-memory MongoDB started and seeded with fictional data.`);
    console.log(`[Demo Mode] API & built frontend running at http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Stopping demo server...`);
    server.close(async () => {
      await disconnectDatabase();
      await mongo.stop();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

runDemo().catch((error) => {
  console.error('Demo startup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
