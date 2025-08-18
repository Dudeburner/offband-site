SHELL := /bin/bash
.DEFAULT_GOAL := help

# Optional: your existing push helper
OFFBAND_PUSH   := $(HOME)/bin/offband-push.sh

# Find operator scripts in common locations (private first)
OFFBAND_CLI    := $(or $(wildcard $(HOME)/offband-tools/offband.sh),\
                       $(wildcard $(HOME)/bin/offband.sh),\
                       $(wildcard ./tools/offband.sh))

OFFBAND_EMAIL  := $(or $(wildcard $(HOME)/offband-tools/offband-email.sh),\
                       $(wildcard $(HOME)/bin/offband-email.sh),\
                       $(wildcard ./tools/offband-email.sh))

define require
	@[[ -n "$($1)" && -x "$($1)" ]] || { \
	  echo "✗ Missing $1 script."; \
	  echo "  Looked at:"; \
	  echo "    $$HOME/offband-tools/$(subst OFFBAND_,offband-,$1)"; \
	  echo "    $$HOME/bin/$(subst OFFBAND_,offband-,$1)"; \
	  echo "    ./tools/$(subst OFFBAND_,offband-,$1)"; \
	  exit 1; }
endef

.PHONY: help doctor push new-page new-post rotate-email serve

help:
	@echo "Targets:"
	@echo "  make push           - deploy via offband-push.sh"
	@echo "  make new-page       - create a page (vars: title, path, desc)"
	@echo "  make new-post       - create a writeup (vars: title, desc)"
	@echo "  make rotate-email   - update obfuscated email (vars: email, file, span)"
	@echo "  make serve          - local preview via offband.sh"
	@echo "  make doctor         - show resolved script paths"

doctor:
	@echo "OFFBAND_CLI:   $(OFFBAND_CLI)";   [ -x "$(OFFBAND_CLI)" ]   && echo "  ✓ executable" || echo "  ✗ not found"
	@echo "OFFBAND_EMAIL: $(OFFBAND_EMAIL)"; [ -x "$(OFFBAND_EMAIL)" ] && echo "  ✓ executable" || echo "  ✗ not found"
	@which rsync >/dev/null 2>&1 && echo "rsync ✓" || echo "rsync ✗"

push:
	@[[ -x "$(OFFBAND_PUSH)" ]] || { echo "✗ Missing $(OFFBAND_PUSH)"; exit 1; }
	@$(OFFBAND_PUSH) "update"

new-page:
	$(call require,OFFBAND_CLI)
	@"$(OFFBAND_CLI)" new:page "$(title)" "$(path)" "$(desc)"

new-post:
	$(call require,OFFBAND_CLI)
	@"$(OFFBAND_CLI)" new:post "$(title)" "$(desc)"

rotate-email:
	$(call require,OFFBAND_EMAIL)
	@"$(OFFBAND_EMAIL)" set "$(email)" "$(file)" "$(span)"

serve:
	$(call require,OFFBAND_CLI)
	@"$(OFFBAND_CLI)" serve
