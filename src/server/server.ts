import Fastify from "fastify";
import type { KVStore } from "../engine/kv-store.js";
import { registerRoutes } from "./routes.js";

export function createServer(store: KVStore) {
    const app = Fastify({ logger: true });
    registerRoutes(app, store);
    return app;
}
