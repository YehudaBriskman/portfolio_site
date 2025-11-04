FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV UPLOADS_DIR=/app/uploads

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/uploads ./uploads

RUN apk add --no-cache curl

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/server.js"]
