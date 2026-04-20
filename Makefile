# Makefile for antora-markdown-exporter.
#
# Minimal bundle for explicit package-manager driven development.

PACKAGER ?= bun
NODE ?= node
CLEAN_DIR ?= dist

.PHONY: all install build test check lint clean notes help
all: build

install: ## Install dependencies with the configured package manager.
	$(PACKAGER) install

build: ## Build the project with the configured package manager.
	$(PACKAGER) run build

test: ## Run tests with the configured package manager.
	$(PACKAGER) run test

check: ## Run typecheck or check when configured.
	@if $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'typecheck') ? 0 : 1)"; then \
		$(PACKAGER) run typecheck; \
	elif $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'check') ? 0 : 1)"; then \
		$(PACKAGER) run check; \
	else \
		printf "Skipping check: no typecheck or check script defined in package.json\n"; \
	fi

lint: ## Run lint when configured.
	@if $(NODE) -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts,'lint') ? 0 : 1)"; then \
		$(PACKAGER) run lint; \
	else \
		printf "Skipping lint: no lint script defined in package.json\n"; \
	fi

clean: ## Remove generated output.
	rm -rf node_modules dist "$(CLEAN_DIR)"

notes: ## Print the notes directory path.
	@printf "Notes directory: notes\n"

help: ## Show available targets.
	@printf "Available targets:\n  install build test check lint clean notes\n"
