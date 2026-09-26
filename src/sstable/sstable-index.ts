export interface SSTableIndexEntry {
    key: string;
    entryIndex: number;
}

export interface SSTableIndexRange {
    start: number;
    end: number;
}

export class SSTableIndex {
    private readonly entries: SSTableIndexEntry[] = [];

    constructor(private readonly interval = 4) {
        if (interval <= 0) {
            throw new Error("SSTable index interval must be greater than zero");
        }
    }

    build(entries: SSTableIndexEntry[]): void {
        this.entries.length = 0;
        for (let i = 0; i < entries.length; i += this.interval) {
            this.entries.push({ key: entries[i]!.key, entryIndex: i });
        }
    }

    findRange(key: string, totalEntries: number): SSTableIndexRange {
        if (this.entries.length === 0) {
            return { start: 0, end: Math.max(0, totalEntries - 1) };
        }

        let low = 0;
        let high = this.entries.length - 1;

        let bestIndex = 0;

        while (low <= high) {
            const mid = Math.floor(low + (high - low) / 2);
            const comparision = this.entries[mid]!.key.localeCompare(key);
            if (comparision <= 0) {
                bestIndex = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const start = this.entries[bestIndex]!.entryIndex;
        const nextIndex = bestIndex + 1;
        const end =
            nextIndex < this.entries.length
                ? this.entries[nextIndex]!.entryIndex - 1
                : totalEntries - 1;

        return { start, end };
    }

    size(): number {
        return this.entries.length;
    }
}
