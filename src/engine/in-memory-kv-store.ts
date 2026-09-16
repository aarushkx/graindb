import type { KVStore } from "./kv-store.js";

export class InMemoryKVStore implements KVStore {
    private store: Map<string, string>;

    constructor() {
        this.store = new Map<string, string>();
    }

    put(key: string, value: string): void {
        this.validateKey(key);
        this.validateValue(value);
        this.store.set(key, value);
    }

    get(key: string): string | undefined {
        this.validateKey(key);
        return this.store.get(key);
    }

    delete(key: string): boolean {
        this.validateKey(key);
        return this.store.delete(key);
    }

    size(): number {
        return this.store.size;
    }

    private validateKey(key: string): void {
        if (typeof key !== "string" || key.trim().length === 0) {
            throw new Error("Key cannot be empty or whitespace");
        }
    }

    private validateValue(value: string): void {
        if (typeof value !== "string" || value.length === 0) {
            throw new Error("Value cannot be empty");
        }
    }
}
