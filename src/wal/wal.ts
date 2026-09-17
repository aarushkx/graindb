import { mkdir, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { serializeWalRecord, type WalRecord } from "./wal-record.js";

export class WAL {
    private fileHandle: FileHandle | undefined;

    constructor(private readonly filePath: string) {}

    async open(): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.fileHandle = await open(this.filePath, "a+");
    }

    async append(record: WalRecord): Promise<void> {
        if (!this.fileHandle) {
            throw new Error("WAL is not open");
        }
        const buffer = serializeWalRecord(record);
        await this.fileHandle.write(buffer);
    }

    async sync(): Promise<void> {
        if (!this.fileHandle) {
            throw new Error("WAL is not open");
        }
        await this.fileHandle.sync();
    }

    async close(): Promise<void> {
        if (!this.fileHandle) return;
        await this.fileHandle.close();
        this.fileHandle = undefined;
    }
}
