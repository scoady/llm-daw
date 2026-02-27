ARG REGISTRY=registry.registry.svc.cluster.local:5000
FROM ${REGISTRY}/mirror/node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npx tsc

FROM ${REGISTRY}/mirror/node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist/
EXPOSE 4000
CMD ["node", "dist/index.js"]
