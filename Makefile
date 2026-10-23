.PHONY: preview check tunnel

preview:
	python3 scripts/preview.py

check:
	python3 scripts/check_site.py

tunnel:
	node scripts/tunel.mjs
