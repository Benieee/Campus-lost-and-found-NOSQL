import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(uri: string = env.mongodbUri): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
