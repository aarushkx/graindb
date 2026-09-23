import type { KVStore } from "./kv-store.js";

export class InMemoryKVStore implements KVStore {
    private readonly store = new Map<string, string>();

    async put(key: string, value: string): Promise<void> {
        this.validateKey(key);
        this.validateValue(value);
        this.store.set(key, value);
    }

    async get(key: string): Promise<string | undefined> {
        this.validateKey(key);
        return this.store.get(key);
    }

    async delete(key: string): Promise<boolean> {
        this.validateKey(key);
        return this.store.delete(key);
    }

    async size(): Promise<number> {
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
