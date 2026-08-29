# /byod — BYOD Index Management

Manage your personal RPG file index in 2d6mcp.

## Usage

```
/byod sync     → sync/index files from BYOD_PATH
/byod file <path> → index a single file by relative path
/byod list     → list all indexed files
/byod inspect <path> → show chunks for a specific file
/byod get <path> <index> → retrieve full chunk content
/byod search <term>   → full-text search
/byod clear    → delete the index (start fresh)
```

## Examples

```
/byod sync
/byod file "supplements/large-book.pdf"
/byod list
/byod inspect "supplements/combat-rules.md"
/byod get "supplements/combat-rules.md" 3
/byod search "initiative"
/byod clear
```

## Behaviour

- `sync`: Indexes files in time-budgeted batches. Returns `complete: false` if more files remain — re-run.
- `file`: Calls `sync_byod` with `relative_path`. Useful for large files that timeout during bulk sync.
- `list`: Shows all files with status, chunk counts, and ingestion dates
- `inspect`: Calls `list_byod_files` with `relative_path` to show how a file was chunked
- `get`: Retrieves full chunk content (up to 8KB) by file path and chunk index. Use after `search` returns snippets.
- `search`: Full-text search across all indexed files
- `clear`: Deletes the database. Next sync starts from zero.
