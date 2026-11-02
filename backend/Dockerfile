# Node 24 rather than 20: 20 left support at the end of April 2026, and an
# end-of-life runtime stops receiving the fixes the scan below gates on.
#
# Tag AND digest. The tag says what it is; the digest says which build of it,
# so two builds of one commit get the same base. Dependabot (docker ecosystem)
# moves the digest when upstream republishes the tag, so the pin does not rot.
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV UPLOADS_DIR=/app/uploads

COPY package*.json ./
# npm is needed to install and never again: the container runs `node`, not
# npm. Left in, it was most of the image scan - its own bundled tar, glob,
# minimatch, cross-spawn and sigstore carried a CRITICAL and a dozen HIGHs
# that no change to this package's dependencies can reach. So it is deleted
# in the same layer that used it (yarn and corepack with it), and whatever
# npm ships next is not in the image to be found.
RUN npm ci --omit=dev \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
           /root/.npm

COPY --from=builder /app/dist ./dist
# tsc emits only JavaScript, so the OG card's fonts and metrics are copied in
# beside it. Without these the card renderer throws on first use.
COPY src/assets ./dist/assets
COPY src/uploads ./uploads

# `apk upgrade` as well as the add: the digest above is only as fresh as the
# last Dependabot bump, and Alpine publishes OpenSSL and friends between
# those. Upgrading here means a rebuild picks up a fixed libssl the day it
# exists rather than the day the base image is republished. The cost is that
# the OS layer is not byte-reproducible from the commit alone; the digest
# still fixes everything else, and the scan judges what was actually built.
RUN apk upgrade --no-cache && apk add --no-cache curl

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/server.js"]
