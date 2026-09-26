export class BloomFilter {
    private readonly bits: Uint8Array;
    private readonly bitCount: number;

    constructor(
        expectedItems: number,
        private readonly bitsPerItem = 10,
        private readonly hashCount = 6,
    ) {
        if (expectedItems < 0) {
            throw new Error("Expected item count cannot be negative");
        }
        if (bitsPerItem <= 0) {
            throw new Error("Bits per item must be greater than zero");
        }
        if (hashCount <= 0) {
            throw new Error("Hash count must be greater than zero");
        }

        this.bitCount = Math.max(1, expectedItems * bitsPerItem);
        const byteCount = Math.ceil(this.bitCount / 8);
        this.bits = new Uint8Array(byteCount);
    }

    add(key: string): void {
        for (let i = 0; i < this.hashCount; i++) {
            const index = this.getBitIndex(key, i);
            this.setBit(index);
        }
    }

    mightContain(key: string): boolean {
        for (let i = 0; i < this.hashCount; i++) {
            const index = this.getBitIndex(key, i);
            if (!this.getBit(index)) return false;
        }
        return true;
    }

    private getBitIndex(key: string, seed: number): number {
        const hash = this.hash(key, seed);
        return hash % this.bitCount;
    }

    private hash(key: string, seed: number): number {
        let hash = 2166136261 ^ seed;
        for (let i = 0; i < key.length; i++) {
            hash ^= key.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    private setBit(index: number): void {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        const currentByte = this.bits[byteIndex];

        if (currentByte === undefined) {
            throw new Error(`Bit index out of range: ${index}`);
        }

        this.bits[byteIndex] = currentByte | (1 << bitIndex);
    }

    private getBit(index: number): boolean {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        const currByte = this.bits[byteIndex];
        if (currByte === undefined) return false;
        return (currByte & (1 << bitIndex)) !== 0;
    }
}
