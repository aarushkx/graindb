import { mkdir, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import {
    deserializeWalRecord,
    serializeWalRecord,
    type WalRecord,
} from "./wal-record.js";

const HEADER_SIZE = 14;
const CHECKSUM_SIZE = 4;

export class WAL {
    private fileHandle: FileHandle | undefined;

    // We perform multiple concurrent writes sequentially
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(private readonly filePath: string) {}

    async open(): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.fileHandle = await open(this.filePath, "a+");
    }

    async append(record: WalRecord): Promise<void> {
        this.writeQueue = this.writeQueue.then(async () => {
            await this.appendInternal(record);
        });
        await this.writeQueue;
    }

    async appendAndSync(record: WalRecord): Promise<void> {
        this.writeQueue = this.writeQueue.then(async () => {
            if (!this.fileHandle) {
                throw new Error("WAL is not open");
            }
            await this.appendInternal(record);
            await this.fileHandle.sync();
        });
        await this.writeQueue;
    }

    private async appendInternal(record: WalRecord): Promise<void> {
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

    async recover(): Promise<WalRecord[]> {
        if (!this.fileHandle) {
            throw new Error("WAL is not open");
        }

        await this.writeQueue;

        const buffer = await this.fileHandle.readFile();
        const records: WalRecord[] = [];

        let offset = 0;
        let validBytes = 0;

        while (offset < buffer.length) {
            const remaining = buffer.length - offset;

            // We don't even have enough bytes to read the header
            if (remaining < HEADER_SIZE) break;

            const keyLength = buffer.readUInt32BE(offset + 6);
            const valueLength = buffer.readUInt32BE(offset + 10);

            const recordLength =
                HEADER_SIZE + keyLength + valueLength + CHECKSUM_SIZE;

            // The record extends beyond the end of file
            // The process probably crashed during the write
            if (remaining < recordLength) break;

            const recordBuffer = buffer.subarray(offset, offset + recordLength);

            const record = deserializeWalRecord(recordBuffer);
            records.push(record);

            offset += recordLength;
            validBytes = offset;
        }

        // Remove an incomplete final record, if one exists
        if (validBytes < buffer.length) {
            await this.fileHandle.truncate(validBytes);
        }
        return records;
    }

    async close(): Promise<void> {
        if (!this.fileHandle) return;
        await this.fileHandle.close();
        this.fileHandle = undefined;
    }
}
