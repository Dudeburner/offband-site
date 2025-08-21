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
SSH_TTY     ?= ssh -t $(SSH_USER)@$(SSH_HOST)
WEBROOT     ?= /srv/site

# default help
.DEFAULT_GOAL := help

# ----------------- helpers -----------------
define CONFIRM
	@read -r -p "$(1) (y/n) " ans; case $$ans in y|Y) : ;; *) echo "Aborted."; exit 1;; esac
endef

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

## deploy: manual server sync (force git fetch/reset/clean + nginx reload) — bypasses queue
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

.PHONY: deploy-now
## deploy-now: push directly via systemd pull (immediate), then show recent logs
deploy-now: preflight
	$(call CONFIRM,This will start site-update.service on the server)
	@$(SSH_TTY) 'set -euo pipefail; \
	  sudo systemctl start deploy-offband.service; \
	  echo "→ last 50 lines"; \
	  sudo journalctl -u deploy-offband.service -n 50 -o cat --since "-5 min" || true; \
	  echo "✓ deploy requested"'

.PHONY: tail
## tail: follow logs for deploy process (/var/log/deploy_offband.log)
tail:
	@$(SSH_TTY) 'sudo tail -F /var/log/deploy_offband.log'

## push-deploy: push then deploy (with both confirmations)
push-deploy: push deploy

## doctor: show resolved paths / vars (debug)
doctor:
	@echo "REMOTE     : $(REMOTE)"
	@echo "BRANCH     : $(BRANCH)"
	@echo "SSH        : $(SSH)"
	@echo "WEBROOT    : $(WEBROOT)"
	@echo "MESSAGE    : $(M)"

.PHONY: log
## log: create a UTC security log entry (M="short title")
log:
	@test -n "$(M)" || { echo "Usage: make log M=\"short title\""; exit 1; }
	@./scripts/new-log.sh "$(M)"
	@echo "✓ log created → security/logs/index.html"

## preflight: sanity checks (clean repo, correct branch present)
preflight:
	@git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo."; exit 1; }
	@git rev-parse --abbrev-ref HEAD | grep -qx '$(BRANCH)' || { \
	  echo "You are not on '$(BRANCH)'. Use: git switch $(BRANCH)"; exit 1; }
	@git remote | grep -qx '$(REMOTE)' || { echo "Remote '$(REMOTE)' not found."; exit 1; }

# ----- convenience: local preview via offband.sh if you keep one (optional) -----
## serve: local static preview on :8080
serve:
	@echo "Serving http://127.0.0.1:8080 (Ctrl-C to stop)"
	@python3 -m http.server 8080


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
## help: show available targets (auto-generated)
help:
	@# detect color support
	@if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then \
	  BOLD="$$(tput bold)"; DIM="$$(tput dim)"; RESET="$$(tput sgr0)"; BLUE="$$(tput setaf 4)"; GREEN="$$(tput setaf 2)"; \
	else \
	  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; \
	fi; \
	echo "$${BOLD}Offband Make targets$${RESET}"; \
	echo "$${DIM}Tip:$${RESET} run '$${BOLD}make -n <target>$${RESET}' for a dry run (no commands executed)."; \
	echo; \
	grep -E '^[a-zA-Z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk -v B="$$BOLD" -v R="$$RESET" -v C="$$BLUE" 'BEGIN{FS=":.*?## "}{printf "  %s%-18s%s %s\n", C,$$1,R,$$2}'; \
	echo; \
	echo "$${BOLD}Key flows$${RESET}"; \
	echo "  $${GREEN}deploy$${RESET}      Manual sync on server (force git fetch/reset/clean + nginx reload). Bypasses queue."; \
	echo "  $${GREEN}deploy-now$${RESET}  Immediate pull via systemd on the server, then shows recent logs."; \
	echo; \
	echo "$${BOLD}Examples$${RESET}"; \
	echo "  make push            # commit+push to GitHub"; \
	echo "  make deploy-now      # trigger server pull now (will prompt for sudo on server)"; \
	echo "  make tail            # live-follow site-update.service logs"; \
	echo "  make log M=\"Fixed hero spacing\"  # add a UTC security log entry"; \
	echo "  make audit           # strict pre-publish checks"; \
	echo
	
.PHONY: push deploy deploy-now push-deploy doctor preflight help serve log audit

## audit: run comprehensive project checks (fail on drift)
.PHONY: audit
audit:
	@echo "== audit =="

	@# 0) required components exist
	@test -f .well-known/security.txt || { echo "✗ missing .well-known/security.txt"; exit 1; }
	@test -f keys/offband.asc || { echo "✗ missing keys/offband.asc"; exit 1; }
	@test -f assets/site.css || { echo "✗ missing assets/site.css"; exit 1; }
	@test -f components/topbar.html || { echo "✗ missing components/topbar.html"; exit 1; }
	@test -f components/sidebar.html || { echo "✗ missing components/sidebar.html"; exit 1; }
	@test -f components/footer.html || { echo "✗ missing components/footer.html"; exit 1; }
	@echo "✓ required files present"

	@# 1) security.txt content sanity (Contact + Encryption link)
	@grep -Eq '^Contact:[[:space:]]*(mailto:|https?://)' .well-known/security.txt || { echo "✗ .well-known/security.txt missing Contact"; exit 1; }
	@grep -Eq '^Encryption:[[:space:]]*(https?://|/keys/offband\.asc)' .well-known/security.txt || { echo "✗ .well-known/security.txt missing Encryption"; exit 1; }
	@echo "✓ security.txt content ok"

	@# 2) no legacy /security.txt links outside tools/.git/.well-known/makefile
	@LEGACY=$$(grep -R -nF 'href="/security.txt"' . \
	  --binary-files=without-match --exclude-dir=tools --exclude-dir=.git --exclude='.well-known' --exclude='makefile' || true); \
	if [ -n "$$LEGACY" ]; then echo "$$LEGACY"; echo "✗ legacy /security.txt links found (use /.well-known/security.txt)"; exit 1; else echo "✓ no legacy /security.txt links"; fi

	@# 3) PGP key referenced from primary pages
	@REFS=$$(grep -R -nF '/keys/offband.asc' connect/index.html security/index.html 2>/dev/null || true); \
	if [ -z "$$REFS" ]; then echo "✗ connect/ or security/ do not reference /keys/offband.asc"; exit 1; else echo "✓ pages reference /keys/offband.asc"; fi

	@# 4) writeups fragments: must be <article id=\"post\"> only (no full-page tags)
	@OK=1; for f in writeups/posts/*.html; do \
	  [ -f "$$f" ] || continue; \
	  grep -q '<article class="card prose" id="post">' "$$f" || { echo "✗ missing article wrapper: $$f"; OK=0; }; \
	  grep -Eq '<html|<head|<body' "$$f" && { echo "✗ fragment contains full-page tags: $$f"; OK=0; }; \
	done; \
	if [ $$OK -eq 1 ]; then echo "✓ writeups fragments ok"; else exit 1; fi

	@# 6) hero branding structure on key pages (logo + <span class="brand-name"> inside the <h1 class="brandmark"> block)
	@for p in index.html connect/index.html security/index.html security/logs/index.html; do \
	  [ -f "$$p" ] || continue; \
	  if awk 'BEGIN{flag=0} /<h1 class="brandmark">/{flag=1} flag{print} /<\/h1>/{if(flag){exit}}' "$$p" | grep -q '<span class="brand-name">'; then \
	    echo "✓ hero ok: $$p"; \
	  else \
	    echo "✗ hero brand missing <span class=\"brand-name\">: $$p"; exit 1; \
	  fi; \
	done

	@# 7) CSS helper: if any page uses grid-2, ensure .grid-2 exists in site.css
	@if grep -R -q 'class="[^"]*grid-2' . --include='*.html' --exclude-dir=.git --exclude-dir=tools 2>/dev/null; then \
	  grep -q '\.grid-2' assets/site.css || { echo "✗ .grid-2 used but missing CSS helper"; exit 1; }; \
	  echo "✓ grid-2 helper present"; \
	else echo "· grid-2 not used (skip)"; fi

	@# 8) asset links in HTML: every href/src starting with /assets/ must exist
	@MISSING=0; \
	FILES=$$(find . \( -path './.git' -o -path './tools' \) -prune -o -type f -name '*.html' -print); \
	REFS=$$(grep -hoE '(href|src)="/assets/[^"]+' $$FILES 2>/dev/null | sed -E 's/.*="//'); \
	for ref in $$REFS; do \
	  path="$${ref#/}"; \
	  [ -f "$$path" ] || { echo "✗ missing asset: $$ref (looked for $$path)"; MISSING=1; }; \
	done; \
	[ $$MISSING -eq 0 ] && echo "✓ asset links resolve" || exit 1

	@# 9) no stray /tools/ links in public pages (should be /security/tools/)
	@sh -c 'if grep -R -n "href=\"/tools/\"" -- . --exclude-dir=tools --exclude-dir=.git --exclude=makefile --exclude=.well-known 2>/dev/null; then echo "✗ found /tools/ links in pages (use /security/tools/)"; exit 1; else echo "✓ no stray /tools/ links"; fi'

	@# 10) scripts sanity: new-log.sh exists, is executable, has shebang
	@test -f scripts/new-log.sh || { echo "✗ missing scripts/new-log.sh"; exit 1; }
	@test -x scripts/new-log.sh || { echo "✗ scripts/new-log.sh is not executable (chmod +x)"; exit 1; }
	@head -1 scripts/new-log.sh | grep -q '^#!/' || { echo "✗ scripts/new-log.sh missing shebang"; exit 1; }
	@echo "✓ scripts/new-log.sh ok"

	@# 11) secret scan: obvious private keys or cloud secrets should never be present
	@sh -c 'if grep -R -nE "-----BEGIN (RSA |OPENSSH |DSA |EC )?PRIVATE KEY-----|AWS_SECRET_ACCESS_KEY|aws_secret_access_key" -- . --exclude-dir=.git --exclude-dir=tools --exclude-dir=private --binary-files=without-match 2>/dev/null; then echo "✗ potential secret material detected in repo"; exit 1; else echo "✓ no obvious secrets found"; fi'

	@# 12) permissions: PGP public key should not be group/world-writable (accept 600/640/644)
	@sh -c 'if [ -f keys/offband.asc ]; then M=$$(stat -f "%p" keys/offband.asc 2>/dev/null | sed -E "s/^.*([0-7]{3})$$/\\1/"); case "$$M" in 600|640|644) echo "✓ key file perms ok ($$M)";; *) echo "✗ keys/offband.asc perms are $$M (expected 600/640/644)"; exit 1;; esac; fi'
	
	@# 13) security.txt Expires sanity (if present): must be RFC3339 Zulu and not in the past (macOS/BSD date)
	@sh -c 'EXP="$$(grep -E "^Expires:" .well-known/security.txt | sed -E "s/^Expires:[[:space:]]*//")"; if [ -n "$$EXP" ]; then if date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$$EXP" "+%s" >/dev/null 2>&1; then NOW=$$(date -u "+%s"); TGT=$$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$$EXP" "+%s"); if [ "$$TGT" -le "$$NOW" ]; then echo "✗ .well-known/security.txt Expires is in the past"; exit 1; else echo "✓ security.txt Expires ok"; fi; else echo "✗ .well-known/security.txt Expires has invalid format (use YYYY-MM-DDThh:mm:ssZ)"; exit 1; fi; else echo "· security.txt has no Expires (ok, but consider adding one)"; fi'

	@echo "✓ audit complete"
