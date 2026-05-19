# /byod — BYOD Index Management

Manage your personal RPG file index in 2d6mcp.

## Usage

```
/byod sync     → sync/index files from BYOD_PATH
/byod list     → list all indexed files
/byod inspect <path> → show chunks for a specific file
/byod search <term>   → full-text search
/byod clear    → delete the index (start fresh)
```

## Examples

```
/byod sync
/byod list
/byod inspect "supplements/combat-rules.md"
/byod search "initiative"
/byod clear
```

## Behaviour

- `sync`: Indexes files in time-budgeted batches. Returns `complete: false` if more files remain — re-run.
- `list`: Shows all files with status, chunk counts, and ingestion dates
- `inspect`: Shows how a file was chunked (page boundaries for PDFs, headings for markdown)
- `search`: Full-text search across all indexed files
- `clear`: Deletes the database. Next sync starts from zero.
