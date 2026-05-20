---
name: 2d6-mcp-byod
description: BYOD management — sync, list, inspect, search, and troubleshoot personal file ingestion for the 2d6mcp MCP server.
---

# 2D6 BYOD Management

BYOD (Bring Your Own Data) indexes your personal RPG files — PDFs, text, markdown, and HTML. Requires consent (`AGREE_BYOD_USE="true"`) and `BYOD_PATH`.

## BYOD Tools

### syncing Files
```
sync_byod
```
Indexes files from `BYOD_PATH` in time-budgeted batches (default 15s). Returns `complete: false` if more remain — you MUST re-call. Already-indexed files are skipped via mtime+size fingerprinting.

### Listing
```
list_byod_files
```
Returns summary: `total`, `indexed`, `failed` counts, plus array of files with `fileName`, `relativePath`, `ext`, `size`, `chunks`, `ingestedAt`, `status`.

### Inspecting
```
inspect_byod_file(relative_path)
```
Shows how a file was chunked: metadata plus each chunk's `title`, `size`, `chunkIndex`. Titles reveal structure: PDF pages, markdown breadcrumbs, or part numbers.

### Searching
```
query_local_byod(search_term)
```
Full-text search across all indexed files. 20 results max. AND-first with OR fallback for broad queries.

### Single File Syncing
```
sync_file(relative_path)
```
Indexes a single file by its relative path within `BYOD_PATH`. Use for large files that timeout in bulk `sync_byod`, or for selective indexing without a full sync. Already-indexed files (unchanged mtime+size) are skipped.

### Retrieving Full Chunk Content
```
get_byod_chunk(file_path, chunk_index)
```
`query_local_byod` returns search snippets. Use `get_byod_chunk` to retrieve the full chunk content for inference. Pass the file path and chunk index (from search results or `inspect_byod_file`). Essential when you need complete text rather than truncated snippets.

### Clearing
```
clear_byod
```
Deletes the entire index. Recreated on next `sync_byod`. Source files untouched.

## File Handlers

| Ext | Handler | Chunk Strategy |
|-----|---------|---------------|
| `.pdf` | Page-aware parser | One chunk per page |
| `.md`, `.markdown` | Heading-aware parser | One chunk per `#` section with breadcrumb titles |
| `.txt` | Plain text parser | Paragraph-split with first-line title detection |
| `.html`, `.htm` | Tag stripper | Tags removed, then paragraph-split |
| `.json`, `.xml`, `.csv` | Plain text parser | Raw content |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | — | Directory of local source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch (1000–300000) |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Max chunks per file |
| `BYOD_CONTENT_CACHE_PATH` | — | Shared content cache path (deduplicates across workspaces) |

## Workspace Isolation

Each `BYOD_PATH` gets its own isolated database. A shared content cache deduplicates identical files across workspaces — if two workspaces contain the same file, the content is stored only once.

- **Disabled**: Set `AGREE_BYOD_USE="true"` or run `npm run setup`
- **No path**: Set `BYOD_PATH` to your RPG files directory
- **Sync times out**: Re-call `sync_byod` — it continues from where it left off
- **Changes not appearing**: Run `sync_byod` to pick up file modifications
- **Same files keep failing**: Marked as failed in the DB and skipped on subsequent syncs; `clear_byod` to reset
