# Offband Makefile — one-command push + optional deploy
# -----------------------------------------------------
SHELL := /bin/bash

# ---- repo -------------------------------------------------
BRANCH      ?= main
REMOTE      ?= origin
M           ?= site update          # commit message when not provided: make push M="message"

# ---- server (only used by deploy/* targets) ---------------
SSH_USER    ?= deploy
SSH_HOST    ?= 45.79.217.101
SSH         := ssh -o StrictHostKeyChecking=accept-new $(SSH_USER)@$(SSH_HOST)
WEBROOT     ?= /var/www/offband

# default help
.DEFAULT_GOAL := help

# ----------------- helpers -----------------
define CONFIRM
	@read -r -p "$(1) (y/n) " ans; case $$ans in y|Y) : ;; *) echo "Aborted."; exit 1;; esac
endef

# Return 0 if there’s anything staged or unstaged
dirty = test -n "$$(git status --porcelain)"

# ----------------- targets ------------------

## push: stage, commit (if needed), push to GitHub (no server login)
push: preflight
	$(call CONFIRM,WARNING: This will push to GitHub and trigger the live deploy pull)
	@set -e; \
	git add -A; \
	if git diff --cached --quiet; then \
	  echo "No local changes to commit."; \
	else \
	  git commit -m "$(M)"; \
	fi; \
	git push $(REMOTE) $(BRANCH); \
	echo "✓ pushed to GitHub (deployment will follow)"

## deploy: clean, idempotent server sync (git fetch/reset/clean + nginx reload)
deploy: preflight
	$(call CONFIRM,This will sync the server to origin/$(BRANCH) and reload nginx)
	@$(SSH) 'set -euo pipefail; \
	  cd $(WEBROOT); \
	  git fetch $(REMOTE) || git fetch origin; \
	  git reset --hard $$(git rev-parse --verify --quiet $(REMOTE)/$(BRANCH) || git rev-parse --verify origin/$(BRANCH)); \
	  git clean -fd; \
	  sudo systemctl reload nginx || sudo nginx -s reload || true; \
	  git log -1 --oneline; \
	  echo "✓ server synced to origin/$(BRANCH)"'

## push-deploy: push then deploy (with both confirmations)
push-deploy: push deploy

## doctor: show resolved paths / vars (debug)
doctor:
	@echo "REMOTE     : $(REMOTE)"
	@echo "BRANCH     : $(BRANCH)"
	@echo "SSH        : $(SSH)"
	@echo "WEBROOT    : $(WEBROOT)"
	@echo "MESSAGE    : $(M)"

## preflight: sanity checks (clean repo, correct branch present)
preflight:
	@git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo."; exit 1; }
	@git rev-parse --abbrev-ref HEAD | grep -qx '$(BRANCH)' || { \
	  echo "You are not on '$(BRANCH)'. Use: git switch $(BRANCH)"; exit 1; }
	@git remote | grep -qx '$(REMOTE)' || { echo "Remote '$(REMOTE)' not found."; exit 1; }

# ----- convenience: local preview via offband.sh if you keep one (optional) -----
## serve: local preview if you keep a script at tools/offband.sh
serve:
	@./tools/offband.sh serve || echo "No local preview script; skipping."


## decrypt: GPG decrypt a message (FILE=path.asc) or from clipboard (macOS)
decrypt:
	@set -euo pipefail; \
	if [ -n "$${FILE:-}" ]; then \
	  IN="$$FILE"; \
	else \
	  if command -v pbpaste >/dev/null 2>&1; then \
	    IN="$$(mktemp -t offband.asc)"; \
	    pbpaste > "$$IN"; \
	  else \
	    echo "No FILE= provided and pbpaste not available. Use: make decrypt FILE=msg.asc"; exit 1; \
	  fi; \
	fi; \
	OUT="decrypted-$$(date -u +%Y%m%dT%H%M%SZ).txt"; \
	echo "→ decrypting $$IN"; \
	if gpg --decrypt "$$IN" > "$$OUT"; then \
	  echo "✓ decrypted to $$OUT"; \
	  echo "-----"; \
	  sed -n '1,200p' "$$OUT"; \
	  test -z "$${FILE:-}" && rm -f "$$IN" || true; \
	else \
	  echo "✗ decrypt failed — check that your private key is imported and trusted."; \
	  exit 1; \
	fi

## key-fpr: show local secret-key fingerprints (useful to confirm)
key-fpr:
	@gpg --list-secret-keys --keyid-format=long

## key-export: export armored PUBLIC key (UID='email@offband.dev', OUT=keys/offband.asc)
key-export:
	@test -n "$${UID:-}" || { echo "Usage: make key-export UID='security@offband.dev' [OUT=keys/offband.asc]"; exit 1; }
	@OUT="$${OUT:-keys/offband.asc}"; \
	mkdir -p "$$(dirname "$$OUT")"; \
	gpg --armor --export "$$UID" > "$$OUT"; \
	echo "✓ public key exported to $$OUT"

	
# ----- help -----
help:
	@echo "Targets:"
	@echo "  make push         - stage, commit if needed, push to GitHub"
	@echo "  make deploy       - clean sync server to origin/$(BRANCH) and reload nginx"
	@echo "  make push-deploy  - push then deploy (two confirmations)"
	@echo "  make doctor       - print resolved variables"
	@echo "  make serve        - optional local preview (if tools/offband.sh exists)"

.PHONY: push deploy push-deploy doctor preflight help serve

.PHONY: audit
audit: ## run local project checks (lint, links, security.txt, pgp wiring)
	@tools/audit.sh
