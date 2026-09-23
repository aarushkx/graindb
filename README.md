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
