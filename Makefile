# Makefile for antora-markdown-exporter.
#
# Minimal bundle for explicit package-manager driven development.

PM ?= bun
CLEAN_DIR ?= dist

.PHONY: all install build test unit check lint format fix release clean notes help
all: build

install: ## Install dependencies with the configured package manager.
	$(PM) install

build: ## Build the project with the configured package manager.
	$(PM) run build

test: ## Run tests with the configured package manager.
	$(PM) run test

unit: ## Run unit tests with the configured package manager.
	$(PM) run unit

check: ## Run the check script with the configured package manager.
	$(PM) run check

lint: ## Run the lint script with the configured package manager.
	$(PM) run lint

format: ## Run the format script with the configured package manager.
	$(PM) run format

fix: ## Run the fix script with the configured package manager.
	$(PM) run fix

release: ## Run the release script with the configured package manager.
	$(PM) run release

clean: ## Remove generated output.
	rm -rf node_modules dist "$(CLEAN_DIR)"

help: ## Show available targets.
	@printf "Available targets:\n  install build test unit check lint format fix release clean notes\n"
