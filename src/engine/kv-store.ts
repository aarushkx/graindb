export interface KVStore {
    put(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | undefined>;
    delete(key: string): Promise<boolean>;
    size(): Promise<number>;
}
