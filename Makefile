# Makefile for antora-markdown-exporter.
#
# Minimal bundle for explicit package-manager driven development.

PM ?= bun
CLEAN_DIR ?= dist

.PHONY: all install build test check lint fix clean notes help
all: build

install: ## Install dependencies with the configured package manager.
	$(PM) install

build: ## Build the project with the configured package manager.
	$(PM) run build

test: ## Run tests with the configured package manager.
	$(PM) run test

check: ## Run the check script with the configured package manager.
	$(PM) run check

lint: ## Run the lint script with the configured package manager.
	$(PM) run lint

fix: ## Run the fix script with the configured package manager.
	$(PM) run fix

clean: ## Remove generated output.
	rm -rf node_modules dist "$(CLEAN_DIR)"

notes: ## Print the notes directory path.
	@printf "Notes directory: notes\n"

help: ## Show available targets.
	@printf "Available targets:\n  install build test check lint fix clean notes\n"
