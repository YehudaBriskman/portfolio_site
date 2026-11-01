# One way to run this repository locally.
#
# A Makefile and not a justfile, which was the nicer-reading option. `just` is
# a Rust binary that is not installed here, so `just up` — the thing that was
# actually asked for — would have failed on the machine it was written for
# until somebody installed a package manager's worth of tooling first. `make`
# is already present on every machine this repo has ever been built on, so
# `make up` works on a clean checkout with nothing fetched. Shipping both was
# the other option and is worse than either: two files describing the same
# commands drift, and the one that drifts is the one nobody runs.
#
# Everything here is a thin wrapper over `docker compose`. That is deliberate:
# the compose files stay the source of truth, so nothing below knows anything
# the files do not, and `docker compose ...` by hand keeps working.
#
#   make           list the targets
#   make up        build, start, wait until the site answers
#   make seed      fixture posts, so /blog renders instead of erroring
#   make check     the gates CI runs on every pull request
#   make down      stop; `make clean` also drops the content store
#
# Requires: docker (with the compose plugin). `make check` additionally needs
# node and npm on the host, because that is what CI runs and the point of the
# target is to run the same thing.

COMPOSE := docker compose -f docker-compose.yml -f docker-compose.dev.yml
SITE    := http://localhost:8080
MAILBOX := http://localhost:8025
COUCH   := http://127.0.0.1:5984

# `up` waits rather than returning the moment Compose has started containers:
# "started" and "answers" are different claims, and the second is the one
# worth making. nginx is up in a second, the API parses its schema and opens
# its port in a few more, and CouchDB is the slow one on a first run.
WAIT_SECONDS := 90

.DEFAULT_GOAL := help
.PHONY: help up build down clean restart logs ps seed check smoke

help: ## Show this list
	@echo "make <target>"
	@echo
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
	  | sort \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-9s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  site      $(SITE)"
	@echo "  mailbox   $(MAILBOX)   (everything the contact form 'sends')"
	@echo "  couchdb   $(COUCH)"

up: ## Build and start everything, then wait for the site to answer
	$(COMPOSE) up -d --build
	@printf 'waiting for %s ' '$(SITE)'
	@for i in $$(seq 1 $(WAIT_SECONDS)); do \
	  code=$$(curl -s -o /dev/null -m 2 -w '%{http_code}' $(SITE)/ 2>/dev/null || true); \
	  if [ "$$code" = "200" ]; then printf ' up\n'; break; fi; \
	  printf '.'; sleep 1; \
	  if [ "$$i" = "$(WAIT_SECONDS)" ]; then \
	    printf ' gave up\n\n'; \
	    echo "The site never answered 200. The API exits at startup if its"; \
	    echo "configuration does not parse, so look there first:"; \
	    echo; \
	    $(COMPOSE) logs --tail=30 api; \
	    exit 1; \
	  fi; \
	done
	@echo
	@echo "  site     $(SITE)"
	@echo "  mailbox  $(MAILBOX)"
	@echo
	@echo "  /blog answers with its error card until there is content:"
	@echo "    make seed"

build: ## Rebuild the images without starting anything
	$(COMPOSE) build

down: ## Stop everything, keep the content store
	$(COMPOSE) down

# `down -v` and not just `down`: the named volume is what survives a `down`,
# and "it still has yesterday's fixtures in it" is the thing this target is
# for. --remove-orphans clears containers left behind by an older compose file.
clean: ## Stop everything and delete the content store
	$(COMPOSE) down -v --remove-orphans

restart: ## Recreate the containers from the current images
	$(COMPOSE) up -d --force-recreate

logs: ## Follow the logs (make logs S=api for one service)
	$(COMPOSE) logs -f --tail=100 $(S)

ps: ## What is running
	$(COMPOSE) ps

# The script's own defaults are already 127.0.0.1:5984 with the dev
# credentials, so nothing is passed to it: a second copy of the password here
# is a second place for it to go stale. It refuses any non-loopback host, by
# design — see its header — which is why this waits on the published port
# rather than reaching into the container.
seed: ## Fill the local content store with fixture posts
	@printf 'waiting for couchdb '
	@for i in $$(seq 1 60); do \
	  if curl -fs -m 2 $(COUCH)/_up >/dev/null 2>&1; then printf ' up\n'; break; fi; \
	  printf '.'; sleep 1; \
	  if [ "$$i" = "60" ]; then printf ' gave up\n'; echo "no couchdb on $(COUCH) — is the stack up? (make up)"; exit 1; fi; \
	done
	node backend/scripts/seed-dev-content.mjs
	@echo
	@echo "  $(SITE)/blog"

# Exactly what .github/workflows/ci.yml runs on a pull request, in the same
# order, so a green `make check` means a green pipeline. `npm ci` rather than
# `npm install` for the same reason CI uses it: the lockfile is the input.
check: ## Run the gates CI runs: lint, typecheck, tests, builds
	cd web && npm ci && npm run lint && npm run typecheck && npm test && npm run build
	cd backend && npm ci && npm run lint --if-present && npm test && npm run build

# Not a test suite — four requests that between them prove the whole chain is
# wired: nginx serves, nginx reaches the API, the API reaches CouchDB, and the
# API is rendering per-URL heads rather than falling back to the plain shell.
smoke: ## Check the running stack end to end
	@set -e; \
	printf '%-34s' 'GET /'; \
	curl -fs -o /dev/null -w '%{http_code}\n' $(SITE)/; \
	printf '%-34s' 'GET /api/blog/posts'; \
	curl -fs $(SITE)/api/blog/posts | head -c 60; echo; \
	printf '%-34s' 'GET /blog (rendered head)'; \
	curl -fs $(SITE)/blog | grep -o '<title>[^<]*</title>' | head -1; \
	printf '%-34s' 'GET /robots.txt'; \
	curl -fs -o /dev/null -w '%{http_code}\n' $(SITE)/robots.txt
