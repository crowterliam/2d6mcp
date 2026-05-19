# 2D6 BYOD Management

BYOD (Bring Your Own Data) lets you index and search your personal RPG files — PDFs, text files, markdown, and HTML documents. This is optional and requires explicit consent.

## BYOD Tools

### syncing Files
```
sync_byod
```
Indexes all supported files from your `BYOD_PATH` directory. Runs in time-budgeted batches (default 15 seconds per call). Returns progress with a `complete` flag.

**Critical**: If `complete` is `false`, you MUST call `sync_byod` again to continue. The tool skips files that haven't changed since the last sync, so subsequent calls are fast until they reach new files.

**Startup behaviour**: The server runs an automatic sync on startup. If your BYOD directory is large, the initial sync may be incomplete. Check `list_byod_files` to verify coverage.

### Listing Indexed Files
```
list_byod_files
```
Returns a summary of all files in the index:
- `total`: Total files tracked
- `indexed`: Successfully indexed files with chunk counts
- `failed`: Files that could not be parsed
- `files[]`: Array with `fileName`, `relativePath`, `ext`, `size`, `chunks`, `ingestedAt`, `status`

Use this to understand what content is available for search.

### Inspecting a File
```
inspect_byod_file(relative_path)
```
Shows how a specific file was split into chunks:
- File metadata (name, size, status)
- Each chunk with `title`, `size`, `chunkIndex`

Titles reveal the document structure: PDF pages, markdown heading breadcrumbs, or plain text part numbers.

### Searching BYOD Content
```
query_local_byod(search_term)
```
Full-text search across all indexed files. Returns up to 20 matching chunks with highlighted snippets and file paths.

### Clearing the Index
```
clear_byod
```
Deletes the entire BYOD database. Use this to start fresh — all indexed files are forgotten. The database is recreated on the next `sync_byod` call. Does not touch your source files.

## Supported File Types

| Extension | Handler | Chunk Strategy |
|-----------|---------|---------------|
| `.pdf` | Page-aware PDF parser | One chunk per page (split if page exceeds chunk size) |
| `.md`, `.markdown` | Heading-aware markdown parser | One chunk per heading section with breadcrumb titles |
| `.txt` | Plain text parser | Paragraph-based splitting with first-line title detection |
| `.html`, `.htm` | HTML tag stripper | Tags removed, then paragraph-split |
| `.json`, `.xml`, `.csv` | Plain text parser | Raw text content |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Set to `"true"` to enable |
| `BYOD_PATH` | — | Absolute path to your RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between consecutive chunks |
| `BYOD_MAX_FILES` | `2000` | Maximum files to process per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Maximum chunks from any single file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Milliseconds per sync batch (1000–300000) |

## Typical Session Workflow

1. **Start of session**: Run `list_byod_files` to check what's indexed
2. **Added new files?**: Run `sync_byod`. Repeat if `complete` is `false`
3. **Need a rule?**: Try `query_ogl_rules` first, then `query_local_byod`
4. **Index seems stale?**: Files whose mtime or size changed are automatically re-ingested on sync
5. **Start fresh after reorganisation?**: `clear_byod` then `sync_byod`

## Troubleshooting

**"BYOD Mode is disabled"**: Set `AGREE_BYOD_USE="true"` and restart the server, or run `npm run setup` to create the consent token.

**"No BYOD_PATH set"**: Configure the `BYOD_PATH` environment variable pointing to your RPG files directory. The path must exist.

**Sync completes with 0 files**: Check that `BYOD_PATH` contains supported file types (`.pdf`, `.md`, `.txt`, `.html`). Files starting with `.` are skipped.

**Same files keep failing**: Corrupt PDFs or unreadable files are marked as failed in the database and skipped on subsequent syncs. Run `clear_byod` to reset if the files have been fixed.

**Sync times out before completing**: This is normal for large directories. The tool returns `complete: false` — call `sync_byod` again to continue where it left off. Each call skips already-indexed files.

**Changes not showing up in search**: Run `sync_byod` to pick up file changes. The fingerprint (mtime + size) detects modifications automatically.
