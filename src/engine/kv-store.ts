export interface KVStore {
    put(key: string, value: string): void;
    get(key: string): string | undefined;
    delete(key: string): boolean;
    size(): number;
}
