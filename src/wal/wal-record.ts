export const WAL_MAGIC = Buffer.from("GRDB");

export const WAL_VERSION = 1;

export enum WalOperation {
    PUT = 1,
    DELETE = 2,
}

export interface WalRecord {
    operation: WalOperation;
    key: string;
    value?: string;
}

const HEADER_SIZE = 14;
const CHECKSUM_SIZE = 4;

export function serializeWalRecord(record: WalRecord): Buffer {
    const keyBuffer = Buffer.from(record.key, "utf-8");
    const valueBuffer =
        record.operation === WalOperation.PUT
            ? Buffer.from(record.value ?? "", "utf-8")
            : Buffer.alloc(0);

    const payloadSize =
        HEADER_SIZE + keyBuffer.length + valueBuffer.length + CHECKSUM_SIZE;

    const buffer = Buffer.alloc(payloadSize);

    let offset = 0;

    // Magic
    WAL_MAGIC.copy(buffer, offset);
    offset += WAL_MAGIC.length;

    // Version
    buffer.writeUInt8(WAL_VERSION, offset);
    offset += 1;

    // Operation
    buffer.writeUInt8(record.operation, offset);
    offset += 1;

    // Key length
    buffer.writeUInt32BE(keyBuffer.length, offset);
    offset += 4;

    // Value length
    buffer.writeUInt32BE(valueBuffer.length, offset);
    offset += 4;

    // Key
    keyBuffer.copy(buffer, offset);
    offset += keyBuffer.length;

    // Value
    valueBuffer.copy(buffer, offset);
    offset += valueBuffer.length;

    // Checksum
    const checksum = calculateChecksum(buffer.subarray(0, offset));
    buffer.writeUInt32BE(checksum, offset);

    return buffer;
}

export function deserializeWalRecord(buffer: Buffer): WalRecord {
    if (buffer.length < HEADER_SIZE + CHECKSUM_SIZE) {
        throw new Error("Buffer too small to be a valid WAL record");
    }

    let offset = 0;

    // Magic
    const magic = buffer.subarray(offset, offset + 4);
    offset += 4;
    if (!magic.equals(WAL_MAGIC)) {
        throw new Error("Invalid WAL magic");
    }

    // Version
    const version = buffer.readUInt8(offset);
    offset += 1;
    if (version !== WAL_VERSION) {
        throw new Error(`Unsupported WAL version: ${version}`);
    }

    // Operation
    const operation = buffer.readUInt8(offset);
    offset += 1;
    if (operation !== WalOperation.PUT && operation !== WalOperation.DELETE) {
        throw new Error(`Invalid WAL operation: ${operation}`);
    }

    // Key length
    const keyLength = buffer.readUInt32BE(offset);
    offset += 4;

    // Value length
    const valueLength = buffer.readUInt32BE(offset);
    offset += 4;

    const expectedLength =
        HEADER_SIZE + keyLength + valueLength + CHECKSUM_SIZE;
    if (buffer.length !== expectedLength) {
        throw new Error("Invalid WAL record length");
    }

    // Key
    const key = buffer.subarray(offset, offset + keyLength).toString("utf-8");
    offset += keyLength;

    // Value
    const value = buffer
        .subarray(offset, offset + valueLength)
        .toString("utf-8");
    offset += valueLength;

    // Checksum
    const storedChecksum = buffer.readUInt32BE(offset);
    const calculatedChecksum = calculateChecksum(buffer.subarray(0, offset));
    if (storedChecksum !== calculatedChecksum) {
        throw new Error("WAL checksum mismatch");
    }

    if (operation === WalOperation.DELETE) {
        return { operation: WalOperation.DELETE, key };
    }

    return { operation: WalOperation.PUT, key, value };
}

export function calculateChecksum(buffer: Buffer): number {
    let checksum = 0;
    for (const byte of buffer) {
        checksum = (checksum + byte) & 0xffffffff; // Keep it within 32 bits
    }
    return checksum;
}
