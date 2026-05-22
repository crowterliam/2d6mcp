# syntax=docker/dockerfile:1
# Build context: project root (fly.toml is at root, pointing here)
FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace root config for dependency resolution
COPY package.json package-lock.json tsconfig.base.json ./

# Copy bridge package.json (workspace dep)
COPY apps/bridge/package.json ./apps/bridge/

# Install production deps (npm workspaces resolve to root node_modules)
RUN npm install --production --ignore-scripts

# Copy bridge source
COPY apps/bridge/tsconfig.json ./apps/bridge/
COPY apps/bridge/src ./apps/bridge/src

# Build bridge TypeScript
RUN cd apps/bridge && npx tsc

# ── Runtime ──
FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bridge/package.json ./package.json
COPY --from=build /app/apps/bridge/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
