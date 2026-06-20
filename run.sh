#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

NODE_MODVER=$(node -e "process.stdout.write(process.versions.modules)")
BUILD_DIR="$SCRIPT_DIR/node_modules/better-sqlite3/build/Release"
ABI_FILE="$BUILD_DIR/.node-abi"

if [ -f "$ABI_FILE" ]; then
  BUILT_ABI=$(cat "$ABI_FILE")
else
  BUILT_ABI=""
fi

if [ "$NODE_MODVER" != "$BUILT_ABI" ]; then
  rm -f "$BUILD_DIR/better_sqlite3.node"
  echo "2d6mcp: Node ABI changed (${BUILT_ABI:-none} -> $NODE_MODVER), rebuilding..." >&2
  npm rebuild better-sqlite3 --silent 2>&1
  echo "$NODE_MODVER" > "$ABI_FILE"
fi

exec node "$SCRIPT_DIR/packages/server/dist/index.js" "$@"
