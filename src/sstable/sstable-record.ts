export const SSTABLE_MAGIC = Buffer.from("GRST");
export const SSTABLE_VERSION = 1;
export const SSTABLE_HEADER_SIZE = 9;
export const SSTABLE_CHECKSUM_SIZE = 4;

export interface SSTableEntry {
    key: string;
    value?: string;
    tombstone: boolean;
}

export function serializeSSTableEntry(entry: SSTableEntry): Buffer {
    const keyBuffer = Buffer.from(entry.key, "utf-8");
    const valueBuffer =
        entry.tombstone || entry.value === undefined
            ? Buffer.alloc(0)
            : Buffer.from(entry.value, "utf-8");

    const entrySize =
        4 + // key length
        4 + // value length
        1 + // flags
        keyBuffer.length +
        valueBuffer.length;

    const buffer = Buffer.alloc(entrySize);

    let offset = 0;

    // Key length
    buffer.writeUInt32BE(keyBuffer.length, offset);
    offset += 4;

    // Value length
    buffer.writeUInt32BE(valueBuffer.length, offset);
    offset += 4;

    // Flags
    buffer.writeUInt8(entry.tombstone ? 1 : 0, offset);
    offset += 1;

    // Key
    keyBuffer.copy(buffer, offset);
    offset += keyBuffer.length;

    // Value
    valueBuffer.copy(buffer, offset);

    return buffer;
}

export function deserializeSSTableEntry(
    buffer: Buffer,
    offset: number,
): { entry: SSTableEntry; nextOffset: number } {
    const minSize = 9;
    if (buffer.length - offset < minSize) {
        throw new Error("Buffer too small to be a valid SSTable entry");
    }

    let pos = offset;

    const keyLength = buffer.readUint32BE(pos);
    pos += 4;

    const valueLength = buffer.readUint32BE(pos);
    pos += 4;

    const flags = buffer.readUInt8(pos);
    pos += 1;

    if (flags & ~1) {
        throw new Error(`Invalid SSTable entry flagsL: ${flags}`);
    }

    const entryLength = 9 + keyLength + valueLength;
    if (buffer.length - offset < entryLength) {
        throw new Error("Buffer too small to be a valid SSTable entry");
    }

    const key = buffer.subarray(pos, pos + keyLength).toString("utf-8");
    pos += keyLength;

    const value =
        valueLength > 0
            ? buffer.subarray(pos, pos + valueLength).toString("utf-8")
            : undefined;
    pos += valueLength;

    const tombstone = flags === 1;

    if (key.length === 0) {
        throw new Error("SSTable entry key cannot be empty");
    }
    if (tombstone && value !== undefined) {
        throw new Error("Tombstone cannot contain a value");
    }
    if (!tombstone && value === undefined) {
        throw new Error("Non-tombstone entry must contain a value");
    }

    return {
        entry: {
            key,
            ...(value !== undefined ? { value } : {}),
            tombstone,
        },
        nextOffset: pos,
    };
}

export function calculateSSTableChecksum(buffer: Buffer): number {
    let checksum = 0;
    for (const byte of buffer) {
        checksum = (checksum + byte) & 0xffffffff; // Keep it within 32 bits
    }
    return checksum;
}
