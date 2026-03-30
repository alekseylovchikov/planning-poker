import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let db = null;

export async function getDb() {
  if (!db) {
    const client = new MongoClient(process.env.MONGODB_URI);

    await client.connect();

    db = client.db('planning-poker');
  }

  return db;
}
