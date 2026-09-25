import { SSTableEntry } from "../sstable/sstable-record.js";

export class CompactionMerger {
    merge(tables: readonly (readonly SSTableEntry[])[]): SSTableEntry[] {
        const seenKeys = new Set<string>();
        const mergedEntries: SSTableEntry[] = [];

        for (const entries of tables) {
            for (const entry of entries) {
                if (seenKeys.has(entry.key)) continue;
                seenKeys.add(entry.key);
                if (entry.tombstone) continue;
                if (entry.value === undefined) continue;
                mergedEntries.push({
                    key: entry.key,
                    value: entry.value,
                    tombstone: false,
                });
            }
        }

        return mergedEntries.sort((a, b) => a.key.localeCompare(b.key));
    }
}
