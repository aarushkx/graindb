import { PersistentKVStore } from "./engine/persistent-kv-store.js";
import { WAL } from "./wal/wal.js";
import { createServer } from "./server/server.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 8080);

const wal = new WAL("./data/wal.log");
const store = new PersistentKVStore(wal);
await store.initialize();

const server = createServer(store);

try {
    await server.listen({ host: HOST, port: PORT });
    console.log(`GrainDB is running on http://${HOST}:${PORT}`);
} catch (error) {
    server.log.error(error);
    await store.close();
    process.exit(1);
}
