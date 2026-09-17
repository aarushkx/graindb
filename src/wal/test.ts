import { WAL } from "./wal.js";
import { WalOperation } from "./wal-record.js";

const wal = new WAL("./data/wal.log");

await wal.open();

await wal.append({
    operation: WalOperation.PUT,
    key: "grass",
    value: "green",
});
await wal.append({
    operation: WalOperation.PUT,
    key: "sky",
    value: "blue",
});
await wal.append({
    operation: WalOperation.DELETE,
    key: "sky",
});

await wal.sync();
await wal.close();

console.log("WAL records written successfully.");
