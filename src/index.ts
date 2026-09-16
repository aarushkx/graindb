import { InMemoryKVStore } from "./engine/in-memory-kv-store.js";
import { createServer } from "./server/server.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 8080);

const store = new InMemoryKVStore();
const server = createServer(store);

try {
    await server.listen({ host: HOST, port: PORT });
    console.log(`GrainDB is running on http://${HOST}:${PORT}`);
} catch (error) {
    server.log.error(error);
    process.exit(1);
}
