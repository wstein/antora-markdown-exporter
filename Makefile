# Makefile for antora-markdown-exporter.
#
# Minimal bundle for explicit package-manager driven development.

PM ?= bun
CLEAN_DIR ?= dist

.PHONY: all install build docs pdf markdown test unit integration reference inspect-report check lint format fix release clean notes help
all: build

install: ## Install dependencies with the configured package manager.
	$(PM) install

build: ## Build the project with the configured package manager.
	$(PM) run build

docs: ## Build the Antora documentation site with the configured package manager.
	$(PM) run docs:build

pdf: ## Build the assembled documentation PDF with the configured package manager.
	$(PM) run pdf:build

markdown: ## Export Antora module pages to Markdown with the configured package manager.
	$(PM) run export:modules -- $(ARGS)

test: ## Run tests with the configured package manager.
	$(PM) run test

unit: ## Run unit tests with the configured package manager.
	$(PM) run unit

integration: ## Run integration tests with the configured package manager.
	$(PM) run integration

reference: ## Run reference compatibility tests with the configured package manager.
	$(PM) run reference

inspect-report: ## Emit a machine-readable inspection report for INPUT with the configured package manager.
	$(PM) run inspect:report -- $(INPUT)

check: ## Run the check script with the configured package manager.
	$(PM) run check

lint: ## Run the lint script with the configured package manager.
	$(PM) run lint

format: ## Run the format script with the configured package manager.
	$(PM) run format

fix: ## Run the fix script with the configured package manager.
	$(PM) run fix

release: ## Run the develop/tag release wizard with the configured package manager.
	$(PM) run release -- $(VERSION) $(if $(YES),--yes)

clean: ## Remove generated output.
	rm -rf node_modules dist "$(CLEAN_DIR)"

help: ## Show available targets.
	@printf "Available targets:\n  install build docs pdf markdown test unit integration reference inspect-report check lint format fix release clean notes\n"
