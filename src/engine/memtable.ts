export interface MemtableEntry {
    value?: string;
    tombstone: boolean;
}

export class Memtable {
    private readonly store = new Map<string, MemtableEntry>();

    put(key: string, value: string): void {
        this.store.set(key, { value, tombstone: false });
    }

    delete(key: string): void {
        this.store.set(key, { tombstone: true });
    }

    get(key: string): MemtableEntry | undefined {
        return this.store.get(key);
    }

    size(): number {
        return this.store.size;
    }

    entries(): IterableIterator<[string, MemtableEntry]> {
        return this.store.entries();
    }

    clear(): void {
        this.store.clear();
    }

    isEmpty(): boolean {
        return this.store.size === 0;
    }
}
