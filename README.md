# GrainDB

A small persistent key-value database served over HTTP

## Roadmap

### V0

- [x] Init project
- [x] Implement KVStore interface
- [x] Implement in-memory storage using Map
- [x] Add PUT / GET / DELETE endpoints
- [x] Add health and stats endpoints

### V1

- [x] Implement WAL record serialization and deserialization
- [x] Add WAL checksums for record integrity
- [x] Add WAL recovery on startup
- [x] Add persistent KV store backed by WAL
- [x] Add sequential WAL write queue
- [x] Fix append-and-sync to write the WAL record before syncing
- [x] Ensure key/value survives server restart
- [x] Implement graceful shutdown
- [x] Properly close WAL file handles

### V2

- [x] Implement Memtable with value/tombstone states
- [x] Define binary SSTable record format
- [x] Implement SSTable serialization and deserialization
- [x] Implement SSTable writer
- [x] Write SSTables atomically through temporary files
- [x] Sync SSTable files before installation
- [x] Implement SSTable reader
- [x] Validate SSTable magic, version, entry count and checksum
- [x] Implement sorted SSTable entries
- [x] Implement binary-search SSTable lookup
- [x] Implement SSTable catalog
- [x] Check existing SSTables on startup
- [x] Assign monotonically increasing SSTable IDs
- [x] Flush Memtable contents into immutable SSTables
- [x] Support tombstones in Memtable
- [x] Support tombstones in SSTables
- [x] Read from Memtable before SSTables
- [x] Search SSTables from newest to oldest
- [x] Ensure newer SSTable values override older values
- [x] Ensure tombstones hide older values
- [x] Implement WAL checkpointing after successful SSTable flush
- [x] Recover remaining WAL operations into the Memtable
- [x] Preserve SSTables across database restarts
- [x] Support multiple SSTables without overwriting previous files

### V3

- [x] Implement SSTable merging
- [x] Implement safe replacement of compacted SSTables
- [x] Implement automatic compaction triggering
- [x] Integrate compaction with the storage engine
