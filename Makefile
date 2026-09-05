# defuss-shadcn — maintainer shortcuts (thin wrappers around bun scripts)
# KISS: every target delegates to package.json so there is one source of truth.

.DEFAULT_GOAL := help
.PHONY: help setup dev test test-run coverage e2e lint verify

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Install bun dependencies and Playwright browsers
	bun install
	bunx playwright install

dev: ## Serve the documentation site at http://localhost:3000/
	bun run dev

test: ## Vitest browser-mode UI tests (watch)
	bun run test

test-run: ## Vitest browser-mode UI tests (single run)
	bun run test:run

coverage: ## Vitest UI tests with coverage report
	bun run test:coverage

e2e: ## Component E2E smoke tests (tests/e2e/*.e2e.mjs)
	bun run e2e

lint: ## Lint src/, tests/ and scripts/ with oxlint
	bun run lint

verify: ## Static consistency gate (runs automatically after `make` build)
	bun run verify
