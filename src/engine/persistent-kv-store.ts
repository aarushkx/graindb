import type { KVStore } from "./kv-store.js";
import { WAL } from "../wal/wal.js";
import { WalOperation, type WalRecord } from "../wal/wal-record.js";

export class PersistentKVStore implements KVStore {
    private readonly store = new Map<string, string>();

    constructor(private readonly wal: WAL) {}

    async initialize(): Promise<void> {
        await this.wal.open();
        const records = await this.wal.recover();
        for (const record of records) {
            this.applyRecord(record);
        }
    }

    async put(key: string, value: string): Promise<void> {
        this.validateKey(key);
        this.validateValue(value);

        const record: WalRecord = {
            operation: WalOperation.PUT,
            key,
            value,
        };

        await this.wal.appendAndSync(record);
        this.store.set(key, value);
    }

    async get(key: string): Promise<string | undefined> {
        this.validateKey(key);
        return this.store.get(key);
    }

    async delete(key: string): Promise<boolean> {
        this.validateKey(key);
        if (!this.store.has(key)) return false;

        const record: WalRecord = {
            operation: WalOperation.DELETE,
            key,
        };

        await this.wal.appendAndSync(record);
        this.store.delete(key);

        return true;
    }

    async size(): Promise<number> {
        return this.store.size;
    }

    async close(): Promise<void> {
        await this.wal.close();
    }

    private applyRecord(record: WalRecord): void {
        switch (record.operation) {
            case WalOperation.PUT:
                if (record.value == undefined) {
                    throw new Error("PUT WAL record is missing a value");
                }
                this.store.set(record.key, record.value);
                break;
            case WalOperation.DELETE:
                this.store.delete(record.key);
                break;
            default:
                throw new Error(`Unknown WAL operation: ${record.operation}`);
        }
    }

    private validateKey(key: string): void {
        if (typeof key !== "string" || key.trim().length === 0) {
            throw new Error("Key cannot be empty or whitespace");
        }
    }

    private validateValue(value: string): void {
        if (typeof value !== "string" || value.length === 0) {
            throw new Error("Value cannot be empty");
        }
    }
}
