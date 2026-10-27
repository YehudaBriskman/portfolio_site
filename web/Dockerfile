FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# npm ci, not npm i: `npm i` re-resolves from the ranges in package.json and
# ignores package-lock.json, so the image was free to pick up a different tree
# than anyone had tested — the lockfile was being carried into the build and
# then disregarded. --legacy-peer-deps turned out to be unnecessary too; the
# dependency graph resolves clean without it.
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner

RUN apk add --no-cache curl

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
# Pre-compress once at build time; nginx serves these via gzip_static.
RUN find /usr/share/nginx/html -type f \
      \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' -o -name '*.html' \) \
      -exec gzip -9 -k -f {} \;
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS http://localhost:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
