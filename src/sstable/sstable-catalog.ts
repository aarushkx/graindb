import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface SSTableMetadata {
    id: number;
    fileName: string;
    filePath: string;
}

export class SSTableCatalog {
    private tables: SSTableMetadata[] = [];

    constructor(private readonly dir: string) {}

    async initialize(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
        const files = await readdir(this.dir);
        this.tables = files
            .filter((fileName) => /^\d{6}\.sst$/.test(fileName))
            .map((fileName) => {
                const id = Number(fileName.slice(0, 6));

                return {
                    id,
                    fileName,
                    filePath: join(this.dir, fileName),
                };
            })
            .sort((a, b) => a.id - b.id);
    }

    nextId(): number {
        if (this.tables.length === 0) return 1;
        return this.tables[this.tables.length - 1]!.id + 1;
    }

    add(metadata: SSTableMetadata): void {
        this.tables.push(metadata);
        this.tables.sort((a, b) => a.id - b.id);
    }

    replace(
        oldTables: readonly SSTableMetadata[],
        newTables: readonly SSTableMetadata[],
    ): void {
        const oldIds = new Set<number>(oldTables.map((table) => table.id));
        this.tables = this.tables
            .filter((table) => !oldIds.has(table.id))
            .concat(newTables)
            .sort((a, b) => a.id - b.id);
    }

    getNewestFirst(): readonly SSTableMetadata[] {
        return [...this.tables].reverse();
    }

    getOldestFirst(): readonly SSTableMetadata[] {
        return [...this.tables];
    }

    count(): number {
        return this.tables.length;
    }
}
