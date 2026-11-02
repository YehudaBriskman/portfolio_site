# Build stage only - nothing from it ships but dist/. Node 24 because 20 is
# end-of-life; pinned by tag and digest, and Dependabot moves the digest.
FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS builder
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

# Pinned by digest for the same reason as the builder; the floating
# `nginx:alpine` meant a build was as old as whatever the builder had cached.
FROM nginx:alpine@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606 AS runner

# `apk upgrade` because nearly every finding on this image is an Alpine
# package (curl, libexpat, pcre2, libuuid, brotli) fixed upstream before the
# nginx image was republished with it. A rebuild should carry the fix the day
# Alpine ships it, not the day the base image catches up.
RUN apk upgrade --no-cache && apk add --no-cache curl

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
# The API's host, and the default is the Compose/`docker run` case: on a
# user-defined Docker network `api` is the service name and resolves as-is.
#
# In Kubernetes it must be the fully-qualified `api.<namespace>.svc.cluster.local`
# and the web Deployment overrides it per namespace, because nginx's `resolver`
# does not use /etc/resolv.conf's `search` list and a bare `api` is therefore
# looked up as an absolute name with no record. The long explanation is on the
# `set $api_upstream` line in nginx.conf.template.
#
# Declared here rather than left to envsubst's empty default on purpose: this
# is the one place that can state a default at all, and an unset variable
# survives substitution literally and stops nginx at startup.
ENV NGINX_API_HOST=api
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Not under /etc/nginx/templates and not under conf.d, on purpose. templates/
# is envsubst's input and this file has no variables to substitute; conf.d/ is
# globbed in at http level by the base config, which would apply these headers
# a second time outside any server block. snippets/ is only ever reached by the
# explicit includes in the config above.
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
# The request headers every proxy_pass location sends upstream, for the same
# reason and to the same place: proxy_set_header does not inherit either.
COPY proxy-headers.conf /etc/nginx/snippets/proxy-headers.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS http://localhost:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
