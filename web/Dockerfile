# Build stage only - nothing from it ships but dist/. Node 24 because 20 is
# end-of-life; pinned by tag and digest, and Dependabot moves the digest.
FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS builder
WORKDIR /app

COPY package*.json ./
# npm ci, not npm i: `npm i` re-resolves from the ranges in package.json and
# ignores package-lock.json, so the image was free to pick up a different tree
# than anyone had tested — the lockfile was being carried into the build and
# then disregarded. --legacy-peer-deps turned out to be unnecessary too; the
# dependency graph resolves clean without it.
RUN npm ci

COPY . .
# The commit this image is, written into the shell as <meta name="build-sha">
# by vite.config.ts so the Deploy job can ask a pod which build it serves
# (#200). An ARG is in the environment of the RUN below and nowhere else, and
# it costs no cache: `COPY . .` above already changes on every commit.
ARG BUILD_SHA=dev
RUN npm run build

# Pinned by digest for the same reason as the builder; the floating
# `nginx:alpine` meant a build was as old as whatever the builder had cached.
FROM nginx:alpine@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606 AS runner

# `apk upgrade` because nearly every finding on this image is an Alpine
# package (curl, libexpat, pcre2, libuuid, brotli) fixed upstream before the
# nginx image was republished with it. A rebuild should carry the fix the day
# Alpine ships it, not the day the base image catches up.
#
# The layer is cached by its text, and its text does not change when Alpine
# ships a fix, so a cached build keeps the packages of the day it was first
# built (2026-11-10: libxslt 1.1.43-r3 kept, r4 fixed two HIGHs, Scan image
# failed on main). Bump this date to force a fresh `apk upgrade`.
ARG APK_REFRESH=2026-11-10
RUN echo "apk refresh ${APK_REFRESH}" && apk upgrade --no-cache && apk add --no-cache curl

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
# Whether the admin gate's identity headers reach the API through this nginx:
# `on` keeps preprod's admin working (its gate runs in Traefik, in front of
# here), and production's public web Deployment sets `off`. Why, at the maps in
# nginx.conf.template. Declared for the same reason as NGINX_API_HOST: unset,
# it would survive envsubst literally and stop nginx at startup.
ENV NGINX_FORWARD_IDENTITY=on
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
