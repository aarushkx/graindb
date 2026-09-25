import { mkdir, open, rename } from "node:fs/promises";
import {
    SSTABLE_CHECKSUM_SIZE,
    SSTABLE_MAGIC,
    SSTABLE_VERSION,
    calculateSSTableChecksum,
    serializeSSTableEntry,
    type SSTableEntry,
} from "./sstable-record.js";

export class SSTableWriter {
    constructor(private readonly dir: string) {}

    async write(fileName: string, entries: SSTableEntry[]): Promise<string> {
        this.validateEntries(entries);
        await mkdir(this.dir, { recursive: true });

        const finalPath = `${this.dir}/${fileName}`;
        const tempPath = `${finalPath}.tmp`;

        const handle = await open(tempPath, "w");

        try {
            const header = Buffer.alloc(9);
            let offset = 0;

            // Magic
            SSTABLE_MAGIC.copy(header, offset);
            offset += SSTABLE_MAGIC.length;

            // Version
            header.writeUInt8(SSTABLE_VERSION, offset);
            offset += 1;

            // Number of entries
            header.writeUInt32BE(entries.length, offset);

            await handle.write(header);

            let checksum = calculateSSTableChecksum(header);

            for (const entry of entries) {
                const entryBuffer = serializeSSTableEntry(entry);
                await handle.write(entryBuffer);
                checksum = updateChecksum(checksum, entryBuffer);
            }
            const checksumBuffer = Buffer.alloc(SSTABLE_CHECKSUM_SIZE);
            checksumBuffer.writeUint32BE(checksum, 0);

            await handle.write(checksumBuffer);
            await handle.sync();
        } finally {
            await handle.close();
        }

        // The temp file is fully written and synced
        // Renaming atomically makes the final SSTable visible to readers
        await rename(tempPath, finalPath);
        return finalPath;
    }

    private validateEntries(entries: SSTableEntry[]): void {
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry) {
                throw new Error(`Missing SSTable entry at index ${i}`);
            }
            if (entry.key.trim().length === 0) {
                throw new Error("SSTable key cannot be empty");
            }
            if (!entry.tombstone && entry.value === undefined) {
                throw new Error(`SSTable entry "${entry.key}" has no value`);
            }
            if (entry.tombstone && entry.value !== undefined) {
                throw new Error(`Tombstone "${entry.key}" cannot have a value`);
            }
            if (i > 0 && entries[i - 1]!.key >= entry.key) {
                throw new Error("SSTable entries must be sorted by key");
            }
        }
    }
}

function updateChecksum(curr: number, buffer: Buffer): number {
    let checksum = curr;
    for (const byte of buffer) {
        checksum = (checksum + byte) & 0xffffffff; // Keep it within 32 bits
    }
    return checksum;
}
