SHELL := /bin/bash

push:
	~/bin/offband-push.sh "update"

new-page:
	@./tools/offband.sh new:page "$(title)" "$(path)" "$(desc)"

new-post:
	@./tools/offband.sh new:post "$(title)" "$(desc)"

serve:
	@./tools/offband.sh serve
