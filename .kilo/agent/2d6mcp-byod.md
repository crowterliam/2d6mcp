# 2D6 BYOD Management

BYOD (Bring Your Own Data) lets you index and search your personal RPG files — PDFs, text files, markdown, and HTML documents. This is optional and requires explicit consent.

## BYOD Tools

### Syncing Files
```
sync_byod
```
Indexes all supported files from your `BYOD_PATH` directory. Runs in time-budgeted batches (default 15 seconds per call). Returns progress with a `complete` flag.

**Critical**: If `complete` is `false`, you MUST call `sync_byod` again to continue. The tool skips files that haven't changed since the last sync, so subsequent calls are fast until they reach new files.

**Startup behaviour**: The server runs an automatic sync on startup. If your BYOD directory is large, the initial sync may be incomplete. Check `list_byod_files` to verify coverage.

### Syncing a Single File
```
sync_file(relative_path)
```
Indexes a single file by its relative path within `BYOD_PATH`. Useful for large PDFs that timeout during bulk sync, or to selectively re-index a modified file without running a full sync.

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

### Retrieving Full Chunk Content
```
get_byod_chunk(relative_path, chunk_index)
```
Retrieves the full content of a specific chunk by file path and chunk index. Use after `query_local_byod` returns snippets — the search tool returns highlighted snippets, but this tool returns the complete chunk text (up to 8KB) for full inference.

### Searching BYOD Content
```
query_local_byod(search_term)
```
Full-text search across all indexed files. Returns up to 20 matching chunks with highlighted snippets and file paths. When the session has a `byod_system` set, `synthesize_ruling` and `resolve_from_context` automatically filter results to that system — but `query_local_byod` searches everything, giving you unfiltered access when you need it.

### Clearing the Index
```
clear_byod
```
Deletes the entire BYOD database. Use this to start fresh — all indexed files are forgotten. The database is recreated on the next `sync_byod` call. Does not touch your source files.

## BYOD System Filter

When you start a session with a `byod_system` parameter, all subsequent `synthesize_ruling` and `resolve_from_context` calls filter BYOD search results to files whose names contain the specified system. This prevents wrong-system contamination — e.g., Call of Cthulhu sessions won't accidentally draw rulings from Trail of Cthulhu or Traveller content.

```
session_start(name: "Session 1", byod_system: "call of cthulhu")
```

The filter matches any filename containing ALL words from the system name (case-insensitive):
- `"call of cthulhu"` matches `Call_of_Cthulhu_Swamp_Song.pdf` ✓, `Trail_of_Cthulhu_bookmarked.pdf` ✗
- `"traveller"` matches `TheTravellerBook.pdf` ✓, `Cepheus_Engine_SRD.pdf` ✗

When `byod_system` is not set, all BYOD content is searched — use this when you want to draw from multiple systems or are unsure which PDF contains the answer.

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
| `BYOD_PATH` | `.reference/` (auto-discovered) | Absolute or relative path to your RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between consecutive chunks |
| `BYOD_MAX_FILES` | `2000` | Maximum files to process per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Maximum chunks from any single file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Milliseconds per sync batch (1000–300000) |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content-addressable cache path |

**Note on BYOD_PATH**: If `BYOD_PATH` is not set via environment variable, the server auto-discovers a `.reference` directory in the project root. If `.reference` exists and contains files, it's used automatically. Set `BYOD_PATH` explicitly to override.

## Workspace Isolation

Each `BYOD_PATH` directory gets its own isolated database (`byod_ws_<hash>.db`). Multiple workspaces pointing to different directories never cross-pollinate. However, a shared content-addressable cache (`content_cache.db`, keyed by SHA-256 of file bytes) stores parsed chunks that are reused across all workspaces. Identical files in different workspaces are parsed only once.

The sync process uses a 3-tier check to avoid unnecessary work:
1. **Fingerprint skip** — mtime + size comparison (fast, no file read)
2. **Content cache hit** — SHA-256 lookup (skip parsing, reuse cached chunks)
3. **Full parse** — read and parse the file, store in content cache

## Typical Session Workflow

1. **Start of session**: Run `list_byod_files` to check what's indexed
2. **Start session tracking**: `session_start(name: "Session 12", byod_system: "call of cthulhu")`
3. **Added new files?**: Run `sync_byod`. Repeat if `complete` is `false`
4. **Need a rule?**: Try `synthesize_ruling` for natural-language questions — it auto-searches OGL/DW/BYOD with the system filter applied
5. **Search manually**: Use `query_ogl_rules`, `query_dw_rules`, or `query_local_byod` for direct search
6. **Need full text?**: Use `get_byod_chunk(path, index)` to retrieve complete chunk content after search returns snippets
7. **Index seems stale?**: Files whose mtime or size changed are automatically re-ingested on sync
8. **Start fresh after reorganisation?**: `clear_byod` then `sync_byod`

## Session + BYOD Integration

The session management tools integrate with BYOD to maintain game context:

- `session_start(byod_system: "traveller")` scopes future BYOD rulings to Traveller content
- `synthesize_ruling(session_id: "abc")` reads the session's `byod_system` and filters accordingly
- `resolve_from_context(session_id: "abc")` uses recent transcript to auto-detect the rules question, then synthesizes with the session's BYOD scope
- `log_transcript` logs table discussion — use in combination with audio transcription or manual entry
- `transcribe_audio(session_id: "abc", file_path: "session.flac")` transcribes audio into the session in chunks, each auto-logged

## Troubleshooting

**"BYOD Mode is disabled"**: Set `AGREE_BYOD_USE="true"` and restart the server, or run `npm run setup` to create the consent token.

**"No BYOD_PATH set"**: The server tries `.reference/` in the project root automatically. If that doesn't exist, set `BYOD_PATH` explicitly. Files starting with `.` are skipped.

**Sync completes with 0 files**: Check that `BYOD_PATH` contains supported file types (`.pdf`, `.md`, `.txt`, `.html`).

**Same files keep failing**: Corrupt PDFs or unreadable files are marked as failed in the database and skipped on subsequent syncs. Run `clear_byod` to reset if the files have been fixed.

**Sync times out before completing**: This is normal for large directories. The tool returns `complete: false` — call `sync_byod` again to continue where it left off. Each call skips already-indexed files.

**Changes not showing up in search**: Run `sync_byod` to pick up file changes. The fingerprint (mtime + size) detects modifications automatically.

**Wrong system results appearing**: Start the session with `byod_system` set to your game system (e.g., `"call of cthulhu"`). This filters BYOD results in `synthesize_ruling` and `resolve_from_context` to only files matching that system name.
