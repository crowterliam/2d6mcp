# syntax=docker/dockerfile:1
# Build context: project root. Bridge must be pre-built: npm run build (or at
# minimum: cd apps/bridge && npx tsc) before running flyctl deploy.
FROM node:22-alpine

WORKDIR /app

# Copy workspace root config for dependency resolution
COPY package.json package-lock.json ./
COPY apps/bridge/package.json ./apps/bridge/

# Install production deps (npm workspaces resolve to root node_modules)
RUN npm install --production --ignore-scripts

# Copy pre-built bridge output (built locally with tsc before deploy)
COPY apps/bridge/dist ./dist
COPY apps/bridge/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/index.js"]
