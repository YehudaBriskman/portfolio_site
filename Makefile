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
#
# The /api/ check asserts on the response *body*, and that is the point of
# this target rather than a refinement of it. Every HTML route proxies to the
# API's renderer under `error_page 500 502 503 504 = @spa`, so when the API is
# unreachable the visitor is handed the bare SPA shell with a 200 and nothing
# anywhere reports a problem. This target therefore passed green throughout
# the preprod outage where nginx could not resolve the api Service and
# answered 502 to every single /api/ request.
#
# It was blind to that 502 for a second and independent reason, worth keeping
# in mind before anyone writes another check here: the line was
# `curl -fs ... | head -c 60`, and a pipeline's exit status is the last
# command's, so curl's failure was discarded by `head` and `set -e` never had
# anything to act on. Run against preprod while it was still broken, the old
# recipe exited 0 and printed an empty line where the posts belonged. That is
# why the body is captured into a variable and matched here.
#
# The /blog check asserts on the body for the same reason and a different
# failure: an empty content store. It used to print whatever <title> came
# back, and the SPA shell has a perfectly good <title> of its own, so a
# fallback was indistinguishable from a render. It now requires the heading
# the renderer emits, which the built index.html does not contain anywhere.
smoke: ## Check the running stack end to end
	@set -e; \
	printf '%-34s' 'GET /'; \
	curl -fsS -o /dev/null -w '%{http_code}\n' $(SITE)/; \
	printf '%-34s' 'GET /api/blog/posts (body)'; \
	body=$$(curl -sS -m 10 $(SITE)/api/blog/posts || true); \
	case "$$body" in \
	  *'"ok":true'*'"slug"'*) \
	    printf 'ok, %s posts\n' "$$(printf '%s' "$$body" | grep -o '"slug"' | wc -l | tr -d ' ')";; \
	  *) printf 'FAIL\n\n'; \
	     echo '  /api/blog/posts did not answer with posts. First 200 bytes:'; \
	     printf '    %s\n\n' "$$(printf '%s' "$$body" | head -c 200)"; \
	     echo '  An empty body is nginx unable to reach the API (502) — check'; \
	     echo '  that NGINX_API_HOST names a host nginx can resolve absolutely.'; \
	     echo '  A 404, or an items list with nothing in it, is a content store'; \
	     echo '  with no documents: run `make seed`.'; \
	     exit 1;; \
	esac; \
	printf '%-34s' 'GET /blog (rendered, not shell)'; \
	blog=$$(curl -sS -m 10 $(SITE)/blog || true); \
	case "$$blog" in \
	  *'<h1>Blogs</h1>'*) \
	    printf 'ok, %s\n' "$$(printf '%s' "$$blog" | grep -o '<title>[^<]*</title>' | head -1)";; \
	  *) printf 'FAIL\n\n'; \
	     echo '  /blog came back without the rendered <h1>, so nginx fell back'; \
	     echo '  to @spa and served the bare shell — with a 200. The built'; \
	     echo '  index.html contains no <h1> at all, which is exactly what'; \
	     echo '  makes the fallback detectable from the body and not from the'; \
	     echo '  status. The <title> is not enough on its own: the shell ships'; \
	     echo '  one, so the old check here accepted the fallback as a pass.'; \
	     exit 1;; \
	esac; \
	printf '%-34s' 'GET /robots.txt'; \
	curl -fsS -o /dev/null -w '%{http_code}\n' $(SITE)/robots.txt
