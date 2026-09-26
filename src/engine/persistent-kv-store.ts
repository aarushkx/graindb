import type { KVStore } from "./kv-store.js";
import { WAL } from "../wal/wal.js";
import { WalOperation, type WalRecord } from "../wal/wal-record.js";
import { SSTableWriter } from "../sstable/sstable-writer.js";
import { SSTableEntry } from "../sstable/sstable-record.js";
import { SSTableCatalog } from "../sstable/sstable-catalog.js";
import { Memtable } from "./memtable.js";
import { SSTableReader } from "../sstable/sstable-reader.js";
import { CompactionManager } from "../compaction/compaction-manager.js";
import { AsyncMutex } from "./async-mutex.js";

export class PersistentKVStore implements KVStore {
    private readonly memtable = new Memtable();
    private readonly sstableWriter: SSTableWriter;
    private readonly sstableCatalog: SSTableCatalog;
    private readonly compactionManager: CompactionManager;
    private readonly writeMutex = new AsyncMutex();

    constructor(
        private readonly wal: WAL,
        sstableDir = "./data/sstables",
        private readonly memtableFlushThreshold = 1000,
        private readonly compactionThreshold = 4,
    ) {
        this.sstableWriter = new SSTableWriter(sstableDir);
        this.sstableCatalog = new SSTableCatalog(sstableDir);
        this.compactionManager = new CompactionManager(
            this.sstableCatalog,
            this.sstableWriter,
        );
    }

    async initialize(): Promise<void> {
        await this.wal.open();
        await this.sstableCatalog.initialize();
        const records = await this.wal.recover();
        for (const record of records) {
            this.applyRecord(record);
        }
    }

    async put(key: string, value: string): Promise<void> {
        const release = await this.writeMutex.acquire();

        try {
            this.validateKey(key);
            this.validateValue(value);

            const record: WalRecord = {
                operation: WalOperation.PUT,
                key,
                value,
            };
            await this.wal.appendAndSync(record);
            this.memtable.put(key, value);
            await this.flushIfNeeded();
        } finally {
            release();
        }
    }

    async get(key: string): Promise<string | undefined> {
        this.validateKey(key);

        // Check memtable entry
        const memtableEntry = this.memtable.get(key);
        if (memtableEntry) {
            if (memtableEntry.tombstone) return undefined;
            return memtableEntry.value;
        }

        // Search SSTables from newest to oldest
        const tables = this.sstableCatalog.getNewestFirst();
        for (const table of tables) {
            const reader = await SSTableReader.open(table.filePath);
            const entry = reader.get(key);
            if (!entry) continue;
            if (entry.tombstone) return undefined;
            return entry.value;
        }

        return undefined;
    }

    async delete(key: string): Promise<boolean> {
        const release = await this.writeMutex.acquire();

        try {
            this.validateKey(key);

            // Check whether the key currently exists anywhere in the DB
            const existing = await this.get(key);
            if (existing === undefined) return false;

            const record: WalRecord = {
                operation: WalOperation.DELETE,
                key,
            };

            await this.wal.appendAndSync(record);
            this.memtable.delete(key);
            await this.flushIfNeeded();

            return true;
        } finally {
            release();
        }
    }

    async size(): Promise<number> {
        const keys = new Set<string>();
        const tables = this.sstableCatalog.getOldestFirst();

        for (const table of tables) {
            const reader = await SSTableReader.open(table.filePath);
            for (const entry of reader.getAll()) {
                if (entry.tombstone) keys.delete(entry.key);
                else keys.add(entry.key);
            }
        }

        for (const [key, entry] of this.memtable.entries()) {
            if (entry.tombstone) keys.delete(key);
            else keys.add(key);
        }

        return keys.size;
    }

    async close(): Promise<void> {
        await this.wal.close();
    }

    private async flushIfNeeded(): Promise<void> {
        if (this.memtable.size() < this.memtableFlushThreshold) return;
        await this.flushMemtable();
    }

    private async flushMemtable(): Promise<void> {
        if (this.memtable.isEmpty()) return;

        const entries: SSTableEntry[] = [...this.memtable.entries()]
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, entry]) => ({
                key,
                ...(entry.value !== undefined ? { value: entry.value } : {}),
                tombstone: entry.tombstone,
            }));

        const id = this.sstableCatalog.nextId();
        const fileName = `${String(id).padStart(6, "0")}.sst`;
        const filePath = await this.sstableWriter.write(fileName, entries);
        this.sstableCatalog.add({ id, fileName, filePath });
        await this.wal.checkpoint();
        this.memtable.clear();
        await this.compactIfNeeded();
    }

    private async compactIfNeeded(): Promise<void> {
        if (this.sstableCatalog.count() < this.compactionThreshold) return;
        await this.compactionManager.compact();
    }

    private applyRecord(record: WalRecord): void {
        switch (record.operation) {
            case WalOperation.PUT:
                if (record.value == undefined) {
                    throw new Error("PUT WAL record is missing a value");
                }
                this.memtable.put(record.key, record.value);
                break;
            case WalOperation.DELETE:
                this.memtable.delete(record.key);
                break;
            default:
                throw new Error(`Unknown WAL operation: ${record.operation}`);
        }
    }

    private validateKey(key: string): void {
        if (key.trim().length === 0) {
            throw new Error("Key cannot be empty");
        }
    }

    private validateValue(value: string): void {
        if (value.length === 0) {
            throw new Error("Value cannot be empty");
        }
    }
}
