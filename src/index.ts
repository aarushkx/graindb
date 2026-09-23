import { PersistentKVStore } from "./engine/persistent-kv-store.js";
import { WAL } from "./wal/wal.js";
import { createServer } from "./server/server.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 8080);

const wal = new WAL("./data/wal.log");
const store = new PersistentKVStore(wal);
await store.initialize();

const server = createServer(store);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}. Shutting down...`);
    try {
        await server.close();
        await store.close();
        console.log("GrainDB shut down successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error during shut down:", error);
        process.exit(1);
    }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
    await server.listen({ host: HOST, port: PORT });
    console.log(`GrainDB is running on http://${HOST}:${PORT}`);
} catch (error) {
    server.log.error(error);
    await store.close();
    process.exit(1);
}
