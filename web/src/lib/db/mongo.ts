import "server-only";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { env } from "@/lib/env";

// Serverless functions and dev HMR re-evaluate modules, so connections are
// cached on globalThis to avoid exhausting the Atlas M0 connection limit.
const g = globalThis as unknown as {
  _mongoClient?: MongoClient;
  _mongoosePromise?: Promise<typeof mongoose>;
};

/** Native driver client — used by better-auth. Connects lazily on first op. */
export function mongoClient(): MongoClient {
  g._mongoClient ??= new MongoClient(env().MONGODB_URI, { maxPoolSize: 5 });
  return g._mongoClient;
}

/** Mongoose connection — used by the app's domain models. Await before querying. */
export function connectDB(): Promise<typeof mongoose> {
  g._mongoosePromise ??= mongoose
    .connect(env().MONGODB_URI, { maxPoolSize: 5, bufferCommands: false })
    .catch((err) => {
      g._mongoosePromise = undefined;
      throw err;
    });
  return g._mongoosePromise;
}
