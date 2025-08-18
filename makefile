# Offband site Makefile (clean, context-aware)
# -------------------------------------------------
# Default goal shows help.
.DEFAULT_GOAL := help
SHELL := /bin/bash

# --------- Config ---------
SITE_URL       := https://offband.dev
HOST           := deploy@45.79.217.101
DEST           := /var/www/offband

# rsync: keep perms sane for static hosting
RSYNC_FLAGS := -avz --delete \
	--chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r \
	--exclude '.git/' --exclude '.DS_Store' --exclude 'tools/' --exclude 'keys/'

# Security files
SEC_TXT_FILE    := security.txt
WELL_KNOWN_FILE := .well-known/security.txt
PUBKEY_FILE     := keys/offband.asc

# --------- Help ---------
.PHONY: help
help:
	@echo "Offband — make targets"
	@echo
	@echo "  make push            - deploy via rsync to $(HOST):$(DEST)"
	@echo "  make serve           - local preview (http://127.0.0.1:8080)"
	@echo
	@echo "  make new-page        - scaffold a page  (vars: TITLE=, PATH=, DESC=)"
	@echo "  make new-post        - scaffold a post  (vars: TITLE=, DESC=)"
	@echo
	@echo "  make key-show        - list local GPG keys"
	@echo "  make key-export      - export armored key to $(PUBKEY_FILE)  (KEYID=...)"
	@echo
	@echo "  make sec-txt         - (re)generate ./security.txt"
	@echo "  make sec-publish     - copy to .well-known/security.txt"
	@echo "  make sec-verify      - curl+head live security.txt endpoints"
	@echo
	@echo "  make decrypt FILE=x  - decrypt an armored message file"
	@echo "  make decrypt-clip    - decrypt from clipboard (pbpaste)"
	@echo
	@echo "  make doctor          - repo sanity checks"
	@echo "  make doctor-security - security assets checks"

# --------- Deploy ---------
.PHONY: push
.PHONY: push
push:
	@read -p "WARNING: This will push to GitHub and trigger a live deploy. Continue? (y/n) " ans; \
	if [ "$$ans" != "y" ]; then \
	  echo "✗ push aborted"; \
	  exit 1; \
	fi
	@git add -A
	@git commit -m "site update" || echo "✓ nothing to commit"
	@git push origin main
	@echo "✓ pushed to GitHub (deployment will follow)"
# --------- Local preview ---------
.PHONY: serve
serve:
	@echo "→ Serving at http://127.0.0.1:8080 (Ctrl-C to stop)"
	@python3 -m http.server 8080 >/dev/null 2>&1

# --------- Scaffolding (lightweight) ---------
# Keep these minimal for now; templates can evolve later.
.PHONY: new-page
new-page:
	@test -n "$(TITLE)" || (echo "Usage: make new-page TITLE='...' PATH='dir/' DESC='...'"; exit 1)
	@test -n "$(PATH)"  || (echo "Usage: make new-page TITLE='...' PATH='dir/' DESC='...'"; exit 1)
	@mkdir -p "$(PATH)"
	@echo "→ creating $(PATH)/index.html"
		@cat > "$(PATH)/index.html" <<'EOF'
	<!doctype html>
	<html lang="en">
	<head>
	  <meta charset="utf-8" />
	  <meta name="viewport" content="width=device-width, initial-scale=1" />
	  <title>{{TITLE}} — Offband</title>
	  <link rel="stylesheet" href="/assets/site.css" />
	  <script defer src="/assets/include.js"></script>
	</head>
	<body>
	  <div class="page">
	    <aside id="sidebar"></aside>
	    <main class="content">
	      <h1>{{TITLE}}</h1>
	      <p class="lede">{{DESC}}</p>
	      <hr class="dim" />
	      <p>Page scaffold created. Replace this with real content.</p>
	    </main>
	  </div>
	</body>
	</html>
	EOF
	@$(SED) -e 's|{{TITLE}}|$(TITLE)|g' -e 's|{{DESC}}|$(DESC)|g' -i "" "$(PATH)/index.html" 2>/dev/null || \
	  sed -e 's|{{TITLE}}|$(TITLE)|g' -e 's|{{DESC}}|$(DESC)|g' -i "$(PATH)/index.html"
	@echo "✓ new page: $(PATH)/index.html"

.PHONY: new-post
new-post:
	@test -n "$(TITLE)" || (echo "Usage: make new-post TITLE='...' DESC='...'"; exit 1)
	@mkdir -p writeups/posts
	@slug=$$(echo "$(TITLE)" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-|-$//g'); \
	  f="writeups/posts/$${slug}.html"; \
	  echo "→ creating $$f"; \
	  cat > "$$f" <<'EOF'
	<!doctype html>
	<html lang="en">
	<head>
	  <meta charset="utf-8" />
	  <meta name="viewport" content="width=device-width, initial-scale=1" />
	  <title>{{TITLE}} — Offband</title>
	  <link rel="stylesheet" href="/assets/site.css" />
	  <script defer src="/assets/include.js"></script>
	</head>
	<body>
	  <div class="page">
	    <aside id="sidebar"></aside>
	    <main class="content">
	      <h1>{{TITLE}}</h1>
	      <p class="lede">{{DESC}}</p>
	      <hr class="dim" />
	      <article>
	        <p>Writeup scaffold created. Replace with content.</p>
	      </article>
	    </main>
	  </div>
	</body>
	</html>
	EOF
	@slug=$$(echo "$(TITLE)" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-|-$//g'); \
	  f="writeups/posts/$${slug}.html"; \
	  $(SED) -e 's|{{TITLE}}|$(TITLE)|g' -e 's|{{DESC}}|$(DESC)|g' -i "" "$$f" 2>/dev/null || \
	  sed    -e 's|{{TITLE}}|$(TITLE)|g' -e 's|{{DESC}}|$(DESC)|g' -i "$$f"; \
	  echo "✓ new post: $$f"

# Detect sed flavor once (macOS vs GNU)
SED := $(shell command -v gsed >/dev/null 2>&1 && echo gsed || echo sed)

# --------- PGP helpers ---------
.PHONY: key-show
key-show:
	@gpg --list-keys
	@echo
	@echo "Tip: make key-export KEYID=<fingerprint|uid>"

.PHONY: key-export
key-export:
	@test -n "$$KEYID" || (echo "Usage: make key-export KEYID=<fingerprint|uid>"; exit 1)
	@mkdir -p keys
	@gpg --armor --export "$$KEYID" > $(PUBKEY_FILE)
	@echo "✓ exported to $(PUBKEY_FILE)"

# --------- security.txt ---------
.PHONY: sec-txt
sec-txt:
		@cat > $(SEC_TXT_FILE) <<'EOF'
	Contact: mailto:security@offband.dev
	Contact: https://offband.dev/connect/
	Encryption: https://offband.dev/keys/offband.asc
	Preferred-Languages: en
	Policy: https://offband.dev/security/
	Acknowledgments: https://offband.dev/security/logs/
	Canonical: https://offband.dev/.well-known/security.txt
	Hiring: https://offband.dev/connect/
	EOF
	@echo "✓ wrote $(SEC_TXT_FILE)"

.PHONY: sec-publish
sec-publish: sec-txt
	@mkdir -p .well-known
	@cp $(SEC_TXT_FILE) .well-known/security.txt
	@echo "✓ published to .well-known/security.txt"

.PHONY: sec-verify
sec-verify:
	@echo "→ verifying live endpoints:"
	@-curl -sSfL $(SITE_URL)/.well-known/security.txt | head -n 6
	@-curl -sSfL $(SITE_URL)/security.txt          | head -n 6
	@echo "✓ verify done"

# --------- Decrypt helpers ---------
.PHONY: decrypt
decrypt:
	@test -n "$(FILE)" || (echo "Usage: make decrypt FILE=<path.asc>"; exit 1)
	@export GPG_TTY=$$(tty); gpgconf --kill gpg-agent; gpg --decrypt "$(FILE)"

.PHONY: decrypt-clip
decrypt-clip:
	@export GPG_TTY=$$(tty); gpgconf --kill gpg-agent; \
	pbpaste > /tmp/offband_msg.asc; \
	gpg --decrypt /tmp/offband_msg.asc

# --------- Doctors ---------
.PHONY: doctor
doctor:
	@test -f assets/site.css || (echo "✗ Missing assets/site.css"; exit 1)
	@test -f index.html      || (echo "✗ Missing index.html"; exit 1)
	@test -d assets          || (echo "✗ Missing assets/ dir"; exit 1)
	@test -d components      || (echo "✗ Missing components/ dir"; exit 1)
	@test -d security        || (echo "✗ Missing security/ dir"; exit 1)
	@test -d writeups        || (echo "✗ Missing writeups/ dir"; exit 1)
	@echo "✓ doctor ok"

.PHONY: doctor-security
doctor-security:
	@test -f "$(PUBKEY_FILE)"    || (echo "✗ Missing $(PUBKEY_FILE) — run: make key-export"; exit 1)
	@test -f "$(SEC_TXT_FILE)"    || (echo "✗ Missing $(SEC_TXT_FILE) — run: make sec-txt"; exit 1)
	@test -f "$(WELL_KNOWN_FILE)" || (echo "✗ Missing $(WELL_KNOWN_FILE) — run: make sec-publish"; exit 1)
	@echo "✓ doctor-security ok"
