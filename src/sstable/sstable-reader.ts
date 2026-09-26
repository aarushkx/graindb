import { readFile } from "node:fs/promises";
import {
    SSTABLE_CHECKSUM_SIZE,
    SSTABLE_HEADER_SIZE,
    SSTABLE_MAGIC,
    SSTABLE_VERSION,
    calculateSSTableChecksum,
    deserializeSSTableEntry,
    type SSTableEntry,
} from "./sstable-record.js";
import { SSTableIndex } from "./sstable-index.js";
import { BloomFilter } from "./bloom-filter.js";

export class SSTableReader {
    private readonly index = new SSTableIndex(4);
    private readonly bloomFilter: BloomFilter;

    private constructor(
        private readonly filePath: string,
        private readonly entries: SSTableEntry[],
    ) {
        this.index.build(
            entries.map((entry, entryIndex) => ({
                key: entry.key,
                entryIndex,
            })),
        );

        this.bloomFilter = new BloomFilter(entries.length);
        for (const entry of entries) {
            this.bloomFilter.add(entry.key);
        }
    }

    static async open(filePath: string): Promise<SSTableReader> {
        const buffer = await readFile(filePath);

        if (buffer.length < SSTABLE_HEADER_SIZE + SSTABLE_CHECKSUM_SIZE) {
            throw new Error("Buffer too small to be a valid SSTable file");
        }

        let offset = 0;

        // Magic
        const magic = buffer.subarray(offset, offset + 4);
        offset += 4;
        if (!magic.equals(SSTABLE_MAGIC)) {
            throw new Error("Invalid SSTable magic");
        }

        // Version
        const version = buffer.readUInt8(offset);
        offset += 1;
        if (version !== SSTABLE_VERSION) {
            throw new Error(`Unsupported SSTable version: ${version}`);
        }

        // Number of entries
        const numEntries = buffer.readUint32BE(offset);
        offset += 4;

        const entries: SSTableEntry[] = [];

        let prevKey: string | undefined;

        for (let i = 0; i < numEntries; i++) {
            const result = deserializeSSTableEntry(buffer, offset);
            const entry = result.entry;

            if (
                prevKey !== undefined &&
                prevKey.localeCompare(entry.key) >= 0
            ) {
                throw new Error("SSTable entries are not sorted");
            }

            entries.push(entry);
            prevKey = entry.key;
            offset = result.nextOffset;
        }

        const checksumOffest = buffer.length - SSTABLE_CHECKSUM_SIZE;

        if (offset !== checksumOffest) {
            throw new Error("Invalid SSTable trailing data");
        }

        const storedChecksum = buffer.readUint32BE(checksumOffest);
        const calculatedhecksum = calculateSSTableChecksum(
            buffer.subarray(0, checksumOffest),
        );

        if (storedChecksum !== calculatedhecksum) {
            throw new Error("SSTable checksum mismatch");
        }

        return new SSTableReader(filePath, entries);
    }

    get(key: string): SSTableEntry | undefined {
        if (this.entries.length === 0) return undefined;

        // Bloom filter
        if (!this.bloomFilter.mightContain(key)) {
            return undefined;
        }

        const range = this.index.findRange(key, this.entries.length);

        let low = range.start;
        let high = range.end;
        while (low <= high) {
            const mid = Math.floor(low + (high - low) / 2);
            const entry = this.entries[mid]!;
            const comparision = entry.key.localeCompare(key);
            if (comparision === 0) return entry;
            if (comparision < 0) low = mid + 1;
            else high = mid - 1;
        }
        return undefined;
    }

    getAll(): readonly SSTableEntry[] {
        return [...this.entries];
    }

    getPath(): string {
        return this.filePath;
    }
}

function parseSSTable(buffer: Buffer): SSTableEntry[] {
    if (buffer.length < SSTABLE_HEADER_SIZE + SSTABLE_CHECKSUM_SIZE) {
        throw new Error("Buffer too small to be a valid SSTable file");
    }

    let offset = 0;

    // Magic
    const magic = buffer.subarray(offset, offset + 4);
    offset += 4;
    if (!magic.equals(SSTABLE_MAGIC)) {
        throw new Error("Invalid SSTable magic");
    }

    // Version
    const version = buffer.readUInt8(offset);
    offset += 1;
    if (version !== SSTABLE_VERSION) {
        throw new Error(`Unsupported SSTable version: ${version}`);
    }

    // Number of entries
    const numEntries = buffer.readUint32BE(offset);
    offset += 4;

    const entries: SSTableEntry[] = [];
    for (let i = 0; i < numEntries; i++) {
        const { entry, nextOffset } = deserializeSSTableEntry(buffer, offset);
        entries.push(entry);
        offset = nextOffset;

        // SSTable entries must remain sorted
        if (i > 0) {
            const prev = entries[i - 1]!;
            const curr = entries[i]!;
            if (prev.key >= curr.key) {
                throw new Error("SSTable entries are not sorted");
            }
        }
    }

    const checksumOffset = buffer.length - SSTABLE_CHECKSUM_SIZE;
    if (offset !== checksumOffset) {
        throw new Error("Unexpected data after SSTable entries");
    }

    const storedChecksum = buffer.readUint32BE(checksumOffset);
    const calculatedChecksum = calculateSSTableChecksum(
        buffer.subarray(0, checksumOffset),
    );
    if (storedChecksum !== calculatedChecksum) {
        throw new Error("SSTable checksum mismatch");
    }

    return entries;
}
