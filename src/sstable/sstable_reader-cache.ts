import { SSTableReader } from "./sstable-reader.js";

export class SSTableReaderCache {
    private readonly readers = new Map<string, Promise<SSTableReader>>();

    async get(filePath: string): Promise<SSTableReader> {
        const cached = this.readers.get(filePath);
        if (cached) return cached;
        const readerPromise = SSTableReader.open(filePath);
        this.readers.set(filePath, readerPromise);

        try {
            return await readerPromise;
        } catch (error) {
            this.readers.delete(filePath);
            throw error;
        }
    }

    invalidate(filePath: string): void {
        this.readers.delete(filePath);
    }

    clear(): void {
        this.readers.clear();
    }

    size(): number {
        return this.readers.size;
    }
}
