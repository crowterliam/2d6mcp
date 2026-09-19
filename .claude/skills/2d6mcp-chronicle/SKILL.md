---
name: 2d6mcp-chronicle
description: Chronicle threads, beats, entities, hooks, brief, promote, and extract_candidates for the 2d6mcp MCP server.
---

# Chronicle

Cross-session memory scoped by durable `table_label` (examples: `table-a`, `campaign-label`). Never put private campaign names in git or examples.

## Canon

Agent, transcript, and summary extracts are always `provisional`. Only `chronicle` `action: promote` (operator-approved) flips rows to `confirmed`. Never auto-canon. `chronicle brief` does **not** call an LLM.

## Tool: `chronicle`

| Action | Purpose |
|--------|---------|
| `upsert_thread` / `list_threads` / `get_thread` | Open threads (`open\|dormant\|resolved\|abandoned`) |
| `add_beat` / `list_beats` | Chronological facts (`reveal\|decision\|combat\|travel\|rumour\|loot\|consequence\|note`) |
| `upsert_entity` / `list_entities` / `get_entity` | People, places, factions, items, ships |
| `link` / `unlink` | Relations |
| `upsert_hook` / `list_hooks` | Prep queue (`ready\|used\|burned`) |
| `brief` | Open threads, recent beats, hot entities, ready hooks — **no LLM** |
| `promote` | Provisional → confirmed |
| `search` | LIKE/AND on beat text + entity names |
| `extract_candidates` | Heuristic by default; `use_llm=true` is last resort |
| `export` | Draft markdown to an allowlisted local path. No Discord auto-post |

## Prep

1. `session` start with `table_label`.
2. `chronicle` `brief` for that label. Do not call `synthesize_ruling` for prep.
3. Optional `export` to a path under the project, `BYOD_PATH`, `LIVE_TRANSCRIPT_ALLOW_PATHS`, or `CHRONICLE_EXPORT_ALLOW_PATHS`.

## After a session

1. `session` `summarize` or `end` returns `chronicle_candidates` (provisional JSON, not auto-written as confirmed).
2. Review, then `extract_candidates` with `write=true` if you want them stored.
3. `promote` ids the operator accepts.

## Transcript glue

- `log_transcript` `intent: chronicle` or `beat` writes a provisional beat when `table_label` is set.
- `ingest_live_transcript` `chronicle_hints: true` writes provisional note beats. Default off.

## Extract

`use_llm` defaults false (heuristic). Set true only to compose candidates from unstructured text via the local LLM backends. This is not the mid-session ruling path — keep using `synthesize_ruling` only as last resort for rules questions.
