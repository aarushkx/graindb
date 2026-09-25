import { unlink } from "fs/promises";
import { SSTableCatalog, SSTableMetadata } from "../sstable/sstable-catalog.js";
import { SSTableReader } from "../sstable/sstable-reader.js";
import { SSTableEntry } from "../sstable/sstable-record.js";
import { SSTableWriter } from "../sstable/sstable-writer.js";
import { CompactionMerger } from "./compaction-merger.js";

export class CompactionManager {
    private readonly merger = new CompactionMerger();

    constructor(
        private readonly catalog: SSTableCatalog,
        private readonly writer: SSTableWriter,
    ) {}

    async compact(): Promise<void> {
        const tables = this.catalog.getNewestFirst();
        if (tables.length < 2) return;

        const tableEntries: (readonly SSTableEntry[])[] = [];

        for (const table of tables) {
            const reader = await SSTableReader.open(table.filePath);
            tableEntries.push(reader.getAll());
        }

        const mergedEntries = this.merger.merge(tableEntries);
        const newId = this.catalog.nextId();
        const fileName = `${String(newId).padStart(6, "0")}.sst`;
        const filePath = await this.writer.write(fileName, mergedEntries);
        const newTable: SSTableMetadata = {
            id: newId,
            fileName,
            filePath,
        };

        this.catalog.replace(tables, [newTable]);

        for (const table of tables) {
            await unlink(table.filePath);
        }
    }
}
