# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Copy workspace root files for npm install
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/bridge/package.json ./apps/bridge/

# Install dependencies (workspaces will link)
RUN npm install --production --ignore-scripts

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/bridge ./apps/bridge

# Build bridge
RUN cd apps/bridge && npx tsc

# Run bridge
WORKDIR /app/apps/bridge
EXPOSE 3000
CMD ["node", "dist/index.js"]
