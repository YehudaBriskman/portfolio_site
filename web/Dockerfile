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
# A template, not a finished config: the base image's entrypoint runs envsubst
# over /etc/nginx/templates and writes the result into conf.d. The filter keeps
# it to NGINX_* so nginx's own $uri, $request_id and $api_upstream are not
# eaten by the substitution.
# The base image can fill NGINX_LOCAL_RESOLVERS from /etc/resolv.conf, but
# only if asked: its helper returns early unless this is set.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
ENV NGINX_ENVSUBST_FILTER=NGINX_
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Not under /etc/nginx/templates and not under conf.d, on purpose. templates/
# is envsubst's input and this file has no variables to substitute; conf.d/ is
# globbed in at http level by the base config, which would apply these headers
# a second time outside any server block. snippets/ is only ever reached by the
# explicit includes in the config above.
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS http://localhost:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
