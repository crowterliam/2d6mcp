# syntax=docker/dockerfile:1
# stdio MCP server. Build from the repository root:
#   docker build -t 2d6mcp .
#   docker run -i --rm 2d6mcp

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY data ./data

RUN npm ci && npm run build

ENV NODE_ENV=production

CMD ["node", "packages/server/dist/index.js"]
